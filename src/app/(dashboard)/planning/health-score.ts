export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rule-based health score:
 * - Target calories 2400 kcal/day with 20% tolerance. Beyond that, penalty up to 35 pts.
 * - Protein target >= 70g. Deficit penalized up to 35 pts.
 * - Salt upper limit 12g. Excess penalized up to 30 pts.
 */
export function computeHealthScore(calories: number, protein: number, salt: number) {
  const targetCal = 2400;
  const calTolerance = 0.2 * targetCal;
  const calPenaltyRatio = Math.max(0, Math.abs(calories - targetCal) - calTolerance) / targetCal;
  const calPenalty = clamp(calPenaltyRatio * 35, 0, 35);

  const proteinMin = 70;
  const proteinPenaltyRatio = protein < proteinMin ? (proteinMin - protein) / 25 : 0;
  const proteinPenalty = clamp(proteinPenaltyRatio * 35, 0, 35);

  const saltMax = 12;
  const saltPenaltyRatio = salt > saltMax ? (salt - saltMax) / 6 : 0;
  const saltPenalty = clamp(saltPenaltyRatio * 30, 0, 30);

  const score = 100 - (calPenalty + proteinPenalty + saltPenalty);
  return Math.round(clamp(score, 0, 100));
}
