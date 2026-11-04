import { BatchRequestResult, BatchSubRequest } from "@/types";
import { API } from "@/utils/api";

// CARE's default MAX_REQUESTS_PER_BATCH_REQUEST.
const BATCH_SIZE = 20;

export type BatchOutcome = {
  succeeded: string[];
  // Includes requests rolled back because another request in the same batch failed.
  failed: string[];
  errors: Record<string, string>;
};

export class BatchFailure extends Error {
  failed: string[];

  constructor(failed: string[]) {
    super("Some batched requests failed");
    this.failed = failed;
  }
}

const errorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") return undefined;
  const errors = data as Record<string, unknown>;
  const first =
    errors.non_field_errors ?? errors.detail ?? Object.values(errors)[0];
  const message = Array.isArray(first) ? first[0] : first;
  return typeof message === "string" ? message : undefined;
};

/**
 * Runs requests through CARE's batch API in sequential chunks. Each chunk is
 * atomic on the server, but chunks are independent of each other.
 */
export async function runBatched(
  requests: BatchSubRequest[],
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { succeeded: [], failed: [], errors: {} };

  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((request) => request.reference_id);
    try {
      await API.batch(chunk);
      outcome.succeeded.push(...ids);
    } catch (error: any) {
      outcome.failed.push(...ids);
      const results: BatchRequestResult[] = error?.error?.results ?? [];
      for (const result of results) {
        if (result.status_code > 299) {
          outcome.errors[result.reference_id] =
            errorMessage(result.data) ?? `HTTP ${result.status_code}`;
        }
      }
    }
  }

  return outcome;
}
