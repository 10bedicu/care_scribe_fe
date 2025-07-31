import { z } from "zod";

export const clinicalDrug = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the full clinical-drug concept** \
(including strength & dose form) — **NOT** the ingredient-only code. \
Example: "376771007" for "Zinc 25 mg oral capsule".`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** — must include:  
   - Ingredient name (e.g. "Zinc")  
   - Exact numeric strength (e.g. "25 mg")  
   - **Dosage form with route** (e.g. "oral capsule", "intravenous solution")  
   Example: "Zinc 25 mg oral capsule"

2. **Fully specified name** — include the full formulation (e.g. salt/ester), strength, route, and dosage form.  
   Example: "Zinc (as zinc acetate) 25 mg oral capsule"

⚠️ Do **not** return vague or incomplete forms like "tablet" or "capsule". Always include the **route** (e.g. "oral", "intravenous") to ensure precision.`,
      ),
  });

export const allergyDisposition = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the allergy or intolerance finding** — \
must come from the <substance> hierarchy. \
Example: **"418085001"** for **"citrus fruit"**, \
used here to model **“bitter orange”**.`, // 418085001 = Allergy to citrus fruit [oai_citation:0‡ceds.ed.gov](https://ceds.ed.gov/element/001283?utm_source=chatgpt.com)
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** - “bitter orange”  
2. **Fully specified name (FSN)** - “citrus fruit”.  `,
      ),
  });

export const finding = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the clinical finding** — \
must come from the <clinical finding> hierarchy (root = 404684003). \
Example: **"386661006"** for **"Fever"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide the preferred term first, followed by alternate display names`,
      ),
  });

export const instruction = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the additional dosage instruction** — \
must come from the <additional dosage instructions> hierarchy (root = 419492006). \
Example: **"311504000"** for **"With or after food (qualifier value)"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** – “With or after food”  
2. **Fully specified name (FSN)** – “With or after food (qualifier value)”.`,
      ),
  });

export const indicatorReason = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the clinical indication / reason** — \
must come from the <clinical finding> hierarchy (root = 404684003). \
Example: **"195967001"** for **"Asthma (disorder)"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** – “Asthma”  
2. **Fully specified name (FSN)** – “Asthma (disorder)”.`,
      ),
  });

export const site = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the anatomical site of administration** — \
must come from the <anatomical structure> hierarchy (root = 91723000). \
Example: **"35259002"** for **"Structure of deltoid muscle (body structure)"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** – “Deltoid muscle”  
2. **Fully specified name (FSN)** – “Structure of deltoid muscle (body structure)”.`,
      ),
  });

export const dosageRoute = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the route of administration** — \
must come from the <route of administration value> hierarchy (root = 284009009). \
Example: **"26643006"** for **"Oral route (qualifier value)"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** – “Oral route”  
2. **Fully specified name (FSN)** – “Oral route (qualifier value)”.`,
      ),
  });

export const dosageMethod = () =>
  z.object({
    code: z.string().describe(
      `The SNOMED CT concept identifier **for the method of administration** — \
must come from the <dose form administration method> hierarchy (root = 736665006). \
Example: **"421521009"** for **"Swallow – dosing instruction imperative (qualifier value)"**.`,
    ),

    display_names: z
      .array(z.string())
      .nonempty()
      .describe(
        `Provide display names in this order:  
1. **Preferred term** – “Swallow”  
2. **Fully specified name (FSN)** – “Swallow – dosing instruction imperative (qualifier value)”.`,
      ),
  });
