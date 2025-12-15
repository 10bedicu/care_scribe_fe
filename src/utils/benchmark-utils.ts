type Entry = Record<string, any>;

function customMatchScore(a: Entry, b: Entry): number {
  if (!a || !b) return 0;

  // Match by `code.code` – must match exactly
  const codeMatch = a.code?.code === b.code?.code;
  if (!codeMatch) return 0;

  let score = 0;

  // Clinical status (exact)
  if (a.clinical_status === b.clinical_status) score += 1;

  // Verification status (exact)
  if (a.verification_status === b.verification_status) score += 1;

  // Severity (soft match)
  if (a.severity === b.severity) score += 1;
  else score += 0.5; // similar enough

  // Category
  if (a.category === b.category) score += 1;

  // Onset datetime is ignored

  // Max score per object = 4
  return score / 4; // normalized per-object score [0.0 – 1.0]
}

export function calculateSimilarityScore(arr1: Entry[], arr2: Entry[]): number {
  if (arr1.length === 0) return 0;

  const arr2Copy = [...arr2];
  let totalScore = 0;

  for (const obj1 of arr1) {
    let bestScore = 0;
    let bestIndex = -1;

    for (let i = 0; i < arr2Copy.length; i++) {
      const score = customMatchScore(obj1, arr2Copy[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestScore > 0) {
      totalScore += bestScore;
      arr2Copy.splice(bestIndex, 1); // avoid re-matching
    }
  }

  const normalizedScore = (totalScore / arr1.length) * 3;
  return normalizedScore;
}
