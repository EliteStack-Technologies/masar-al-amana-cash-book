// Money helpers. Everything is rounded to 2 decimals at each step so the
// stored numbers always add up to what the UI shows.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const has = (v) => v !== undefined && v !== null && v !== '';

/**
 * Card-swipe maths, in the same shape as the shop's own sheet.
 *
 * The owner types one amount and the rate charged on it. `commissionType`
 * says which end of the deal that amount is:
 *
 *   'included' - the amount is what the card is swiped for, and the charge
 *                comes out of it.   1,000 @ 3% -> swipe 1,000, cash 970
 *   'excluded' - the amount is the cash the customer walks away with, and the
 *                charge goes on top. 1,000 @ 3% -> swipe 1,030, cash 1,000
 *
 * Either way the shop rounds the other figure to something tidy in practice,
 * so once both amounts are known they are the truth and the rate is derived
 * back from them - against the amount that was typed, so a 3% deal still
 * reads as 3% however the counter-amount was nudged.
 *
 * The supplier (card company) always keeps its percentage of the *swipe* and
 * pays the rest into the owner's account. `settlementAmount` is what actually
 * landed - banks round down - so profit is only real once it is known.
 */
export function computeAmounts({
  swipedAmount,
  givenAmount,
  custPercent,
  commissionType = 'included',
  supplierPercent = 0,
  settlementAmount,
}) {
  const excluded = commissionType === 'excluded';
  const supplierPct = Number(supplierPercent) || 0;

  let swiped;
  let given;
  let chargeToCustomer;

  if (has(swipedAmount) && has(givenAmount)) {
    // Both known (an edit, or a re-save): they are the truth.
    swiped = round2(swipedAmount);
    given = round2(givenAmount);
    chargeToCustomer = round2(swiped - given);
  } else if (excluded) {
    // The cash is the anchor; the charge goes on top of it.
    given = round2(givenAmount);
    chargeToCustomer = round2((given * (Number(custPercent) || 0)) / 100);
    swiped = round2(given + chargeToCustomer);
  } else {
    // The swipe is the anchor; the charge comes out of it.
    swiped = round2(swipedAmount);
    chargeToCustomer = round2((swiped * (Number(custPercent) || 0)) / 100);
    given = round2(swiped - chargeToCustomer);
  }

  // The rate is always read against the amount the owner typed.
  const base = excluded ? given : swiped;
  const custPct = base ? round2((chargeToCustomer / base) * 100) : 0;

  const supplierFee = round2((swiped * supplierPct) / 100);
  // What the card company should pay into the account, and what the deal is
  // worth before the bank's rounding.
  const supplierAccount = round2(swiped - supplierFee);
  const margin = round2(chargeToCustomer - supplierFee);

  const settled = has(settlementAmount) ? round2(settlementAmount) : null;

  return {
    swipedAmount: swiped,
    givenAmount: given,
    chargeToCustomer,
    custPercent: custPct,
    commissionType: excluded ? 'excluded' : 'included',
    supplierPercent: round2(supplierPct),
    supplierFee,
    supplierAccount,
    margin,
    settlementAmount: settled,
    // Actual profit, only once the money has landed.
    profit: settled === null ? null : round2(settled - given),
  };
}
