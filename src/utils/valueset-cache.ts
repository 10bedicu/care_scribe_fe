import {
  Code,
  EnrichedValueSet,
  FormQuestion,
  KnownTerminology,
  ScribeField,
  ScribeQuestionnaire,
  TERMINOLOGY_URI_TO_KNOWN,
  ValueSetFilter,
} from "@/types";
import { API } from "./api";
import { z } from "zod";

/**
 * Maximum number of concepts at which we will inline a value set as a
 * literal enum in the scribe prompt. Beyond this we fall back to
 * code+display_names (tier 2) or display_names only (tier 3) resolution.
 */
export const VALUESET_INLINE_THRESHOLD = 50;

const cache = new Map<string, EnrichedValueSet>();
const inflight = new Map<string, Promise<EnrichedValueSet>>();

function collectValueSetSlugs(
  questionnaires: ScribeQuestionnaire[],
): Set<string> {
  const slugs = new Set<string>();
  const walk = (items: (ScribeField | ScribeQuestionnaire)[]) => {
    for (const item of items) {
      if ("questions" in item) {
        walk(item.questions);
        continue;
      }
      const vs = item.question.answer_value_set;
      if (
        vs &&
        (item.question.type === "choice" || item.question.type === "quantity")
      ) {
        slugs.add(vs);
      }
    }
  };
  for (const qn of questionnaires) walk(qn.questions);
  return slugs;
}

async function fetchEnrichedValueSet(slug: string): Promise<EnrichedValueSet> {
  // Probe the value set in parallel: definition gives us include/exclude
  // rules (system + filters); a bounded expand tells us whether the value
  // set is small enough to inline.
  const [defResult, probeResult] = await Promise.allSettled([
    API.valuesets.get(slug),
    API.valuesets.expand(slug, "", VALUESET_INLINE_THRESHOLD + 1),
  ]);

  const definition = defResult.status === "fulfilled" ? defResult.value : null;
  const probe =
    probeResult.status === "fulfilled" ? probeResult.value.results : [];

  const inlineConcepts: Code[] | null =
    probe.length > 0 && probe.length <= VALUESET_INLINE_THRESHOLD
      ? probe.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display,
        }))
      : null;

  // Determine the dominant coding system: prefer the definition's
  // include rules; fall back to systems seen in the probe results.
  const includeSystems = definition
    ? Array.from(
        new Set(
          definition.compose.include.map((i) => i.system).filter(Boolean),
        ),
      )
    : Array.from(new Set(probe.map((c) => c.system).filter(Boolean)));

  const systemUri = includeSystems.length === 1 ? includeSystems[0] : null;
  const knownSystem: KnownTerminology | null = systemUri
    ? (TERMINOLOGY_URI_TO_KNOWN[systemUri] ?? null)
    : null;

  const filters = definition
    ? definition.compose.include.flatMap((i) => i.filter ?? [])
    : [];

  return {
    slug,
    definition,
    inlineConcepts,
    knownSystem,
    systemUri,
    filters,
  };
}

/**
 * Fetches and caches metadata for every `answer_value_set` referenced in
 * the given questionnaires. Safe to call repeatedly — already-cached
 * slugs and in-flight requests are deduplicated. Failures are swallowed
 * and recorded as an empty (Tier 3) enrichment so callers always get a
 * usable record from {@link getEnrichedValueSet}.
 */
export async function prefetchValueSets(
  questionnaires: ScribeQuestionnaire[],
): Promise<void> {
  const slugs = collectValueSetSlugs(questionnaires);
  await Promise.all(
    Array.from(slugs).map(async (slug) => {
      if (cache.has(slug)) return;
      let promise = inflight.get(slug);
      if (!promise) {
        promise = fetchEnrichedValueSet(slug).catch((err) => {
          console.warn(`Failed to enrich value set "${slug}"`, err);
          return {
            slug,
            definition: null,
            inlineConcepts: null,
            knownSystem: null,
            systemUri: null,
            filters: [],
          } satisfies EnrichedValueSet;
        });
        inflight.set(slug, promise);
      }
      const enriched = await promise;
      cache.set(slug, enriched);
      inflight.delete(slug);
    }),
  );
}

export function getEnrichedValueSet(slug: string): EnrichedValueSet | null {
  return cache.get(slug) ?? null;
}

// ---------------------------------------------------------------------------
// Schema building for `choice` questions that reference a value set.
// ---------------------------------------------------------------------------

/**
 * The Zod shapes produced by {@link buildValueSetSchema} for a single
 * (non-repeats) choice are one of:
 *   - Tier 1 (inline enum):     `z.string()`  -> the display string
 *   - Tier 2 / Tier 3:          `{ display_names[] }`
 *
 * Tier 2 and Tier 3 share the same shape: we never ask the model to
 * invent a code (it will hallucinate). The difference is the prompt
 * description — Tier 2 includes "supporting info" about the coding
 * system and its filters so the model can bias its paraphrases toward
 * canonical terminology (e.g. SNOMED-style phrasing) even though it
 * doesn't produce the code itself.
 *
 * Post-processing in {@link cleanAIResponse} normalises all tiers into
 * a `Code` (`{ system, code, display }`) via either inline-concept
 * lookup (Tier 1) or `searchByDisplay` (Tier 2/3) before writing back
 * into the form.
 */

const KNOWN_SYSTEM_SUPPORTING_INFO: Record<
  KnownTerminology,
  (filters: ValueSetFilter[]) => string
> = {
  SNOMED: (filters) => {
    const isA = filters.find(
      (f) => f.property === "concept" && f.op === "is-a",
    );
    return `Backed by SNOMED CT${
      isA ? ` (concepts under root ${isA.value})` : ""
    } — favour the canonical SNOMED preferred-term phrasing.`;
  },
  LOINC: () =>
    `Backed by LOINC — favour the canonical LOINC long common name phrasing.`,
  UCUM: () =>
    `Backed by UCUM — favour canonical UCUM unit phrasing (e.g. "mg", "mm[Hg]", "L/min").`,
};

function describeFilters(filters: ValueSetFilter[]): string {
  if (!filters.length) return "";
  return ` Filters: ${filters
    .map((f) => `${f.property} ${f.op} ${f.value}`)
    .join("; ")}.`;
}

function displayNamesPrompt(supportingInfo?: string): string {
  const base = `Resolve the value the clinician stated into 1-5 candidate display strings, in decreasing order of confidence. The first must be the clinician's exact wording; the rest should be medically-equivalent paraphrases / synonyms. These are fuzzy-matched against the value set to resolve the canonical code — do not invent a code yourself.`;
  return supportingInfo
    ? `${base}\n\nSupporting info: ${supportingInfo}`
    : base;
}

export function buildValueSetSchema(
  slug: string,
  repeats: boolean,
): z.ZodTypeAny {
  const enriched = getEnrichedValueSet(slug);

  // Tier 1: small enough to inline as a hard enum.
  if (enriched?.inlineConcepts && enriched.inlineConcepts.length) {
    const displays = enriched.inlineConcepts.map((c) => c.display ?? c.code);
    const enumDesc = `ENUM TYPE -- ONLY CHOOSE FROM: ${displays.join(" | ")}`;
    const one = z.string().describe(enumDesc);
    return repeats ? z.array(one).describe(enumDesc) : one;
  }

  // Tier 2 / Tier 3: same shape (display strings only), different prompt.
  // We never ask the model to invent a code — Tier 2 just adds supporting
  // info about the backing system so paraphrase choices align with the
  // canonical terminology, improving fuzzy-match accuracy downstream.
  let supportingInfo: string | undefined;
  if (enriched?.knownSystem) {
    supportingInfo =
      KNOWN_SYSTEM_SUPPORTING_INFO[enriched.knownSystem](enriched.filters) +
      describeFilters(enriched.filters);
  } else if (enriched?.systemUri) {
    supportingInfo = `Backed by ${enriched.systemUri}.${describeFilters(
      enriched.filters,
    )}`;
  }

  const one = z.object({
    display_names: z
      .array(z.string())
      .nonempty()
      .describe(displayNamesPrompt(supportingInfo)),
  });
  return repeats ? z.array(one) : one;
}

/**
 * Given a model response for a value-set field, resolve it to a `Code`
 * (or `Code[]` for repeats). Returns `null` for unresolvable entries.
 *
 * Resolution paths:
 *   - Tier 1: model returned a display string -> match against cached
 *     inline concepts (exact, case-insensitive); fall back to search.
 *   - Tier 2/3: model returned `{ display_names: string[] }` -> fuzzy
 *     search via the value-set expansion endpoint.
 */
export async function resolveValueSetResponse(
  slug: string,
  raw: unknown,
  repeats: boolean,
  // injected to avoid a circular import with response-utils
  searchByDisplay: (slug: string, displays: string[]) => Promise<Code | null>,
): Promise<Code | Code[] | null> {
  const enriched = getEnrichedValueSet(slug);
  const items = repeats ? (Array.isArray(raw) ? raw : []) : [raw];

  const resolved = await Promise.all(
    items.map(async (item): Promise<Code | null> => {
      if (item == null) return null;

      // Tier 1 — model returned a display string; map to the inlined concept.
      if (typeof item === "string") {
        const match = enriched?.inlineConcepts?.find(
          (c) => (c.display ?? c.code).toLowerCase() === item.toLowerCase(),
        );
        if (match) return match;
        // Fall through to search by the string as a display.
        return searchByDisplay(slug, [item]);
      }

      if (typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const displayNames = Array.isArray(obj.display_names)
        ? (obj.display_names.filter((d) => typeof d === "string") as string[])
        : [];

      if (displayNames.length) {
        return searchByDisplay(slug, displayNames);
      }
      return null;
    }),
  );

  if (repeats) {
    return resolved.filter((c): c is Code => c !== null);
  }
  return resolved[0] ?? null;
}

// ---------------------------------------------------------------------------
// Schema building for `quantity` questions.
// ---------------------------------------------------------------------------

/**
 * Build the Zod schema asked of the AI for a `quantity` question. The
 * shape mirrors care_fe's `ResponseValue` for type "quantity":
 *   `{ value: number, unit: { code, display }, coding?: Code-ish }`
 *
 * `unit.system` is omitted from the schema and stamped post-AI in
 * cleanAIResponse, since care_fe wires every quantity question's unit
 * picker to the UCUM ValueSet.
 *
 * When the question has an `answer_value_set` (the "Type" picker in the
 * UI — e.g. the medication for a strength field), `coding` is embedded
 * using the same tiered value-set schema as choice questions and
 * resolved to a canonical `Code` post-AI.
 */
export function buildQuantitySchema(
  question: FormQuestion,
  repeats: boolean,
): z.ZodTypeAny {
  const baseShape: Record<string, z.ZodTypeAny> = {
    value: z.number().describe("The numeric value."),
    unit: z
      .object({
        code: z
          .string()
          .describe('UCUM code (e.g. "mg", "%", "mm[Hg]", "L/min").'),
        display: z
          .string()
          .describe('Human-readable unit name (e.g. "milligram", "percent").'),
      })
      .describe(
        "Unit of measurement using UCUM. Use canonical UCUM codes; match the unit indicated on the question label when one is given.",
      ),
  };

  if (question.answer_value_set) {
    // Reuse the tiered value-set pipeline (inline enum / display_names);
    // resolved to a canonical `Code` post-AI in cleanAIResponse.
    baseShape.coding = buildValueSetSchema(question.answer_value_set, false);
  }

  const one = z.object(baseShape);
  return repeats ? z.array(one) : one;
}
