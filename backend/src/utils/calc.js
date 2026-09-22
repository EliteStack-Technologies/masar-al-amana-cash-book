// Money helpers. Everything is rounded to 2 decimals at each step so the
// stored numbers always add up to what the UI shows.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Derives every money field on a transaction from the four inputs the
 * shop owner actually types.
 *
 * commissionType 'included' -> commission is taken OUT of what the customer asked for.
 *   ask 1000 @ 30%  -> customer gets 700,  card is swiped for 1000
 * commissionType 'excluded' -> commission is added ON TOP of the swipe.
 *   ask 1000 @ 30%  -> customer gets 1000, card is swiped for 1300
 */
export function computeAmounts({
  requestedAmount,
  commissionPercent,
  commissionType,
  ownerSharePercent = 50,
}) {
  const requested = round2(requestedAmount);
  const pct = Number(commissionPercent);
  const ownerPct = Number(ownerSharePercent);

  const commissionAmount = round2((requested * pct) / 100);
  const isIncluded = commissionType === 'included';

  const customerReceived = isIncluded ? round2(requested - commissionAmount) : requested;
  const cardAmount = isIncluded ? requested : round2(requested + commissionAmount);

  const ownerCommission = round2((commissionAmount * ownerPct) / 100);
  // Subtract rather than recompute so the two shares always sum to the total.
  const companyCommission = round2(commissionAmount - ownerCommission);

  // What the card company actually pays back into the owner's account: the
  // cash the customer received plus the owner's share of the commission. The
  // company keeps its own share. (= cardAmount - companyCommission.)
  const settlementAmount = round2(customerReceived + ownerCommission);

  return {
    commissionAmount,
    customerReceived,
    cardAmount,
    ownerCommission,
    companyCommission,
    settlementAmount,
  };
}
