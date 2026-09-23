// Money helpers. Everything is rounded to 2 decimals at each step so the
// stored numbers always add up to what the UI shows.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const has = (v) => v !== undefined && v !== null && v !== '';

/**
 * Money maths in integers, so no binary-float drift leaks into an amount:
 * amounts in fils (1/100 AED) and rates in 1/10,000 of a percent, so a rate is
 * used as typed, never rounded. A fils x rate product is exact.
 */
const fils = (n) => Math.round((Number(n) || 0) * 100);
const rateUnits = (pct) => Math.round((Number(pct) || 0) * 10000);

/** amount x pct%, rounded half-up to a whole dirham, returned in fils. */
const wholeDirhamsOf = (amountFils, ru) => Math.floor((amountFils * ru + 50000000) / 100000000) * 100;

/** amount x pct%, rounded half-up to the fil, returned in fils. */
const filsOf = (amountFils, ru) => Math.floor((amountFils * ru + 500000) / 1000000);

/**
 * Card-swipe maths, exactly as the shop's Card Swipe Details sheet does it.
 * The customer charge is the rate of the amount the owner typed:
 *
 *   'included' - the amount is what the card is swiped for, and the charge
 *                comes out of it, rounded to the nearest whole dirham:
 *                4,311 @ 2.57% -> 110.79 -> charge 111, cash 4,200
 *   'excluded' - the amount is the cash the customer walks away with, and the
 *                charge goes on top. The rate is applied twice: once on the
 *                cash, then again on the cash plus that first charge, and
 *                the second charge is what is added (each to the fil). The
 *                swipe is then rounded to the nearest whole dirham and the
 *                charge is whatever that leaves over the cash:
 *                4,200 @ 2.57% -> 107.94 -> 4,307.94 x 2.57% = 110.71,
 *                4,310.71 -> swipe 4,311, charge 111
 *
 * Either way cash + charge = swipe. The supplier (card company) keeps its
 * rate of the swipe, to the fil, and pays the rest into the owner's account;
 * the margin is the charge less that fee.
 */
function swipeMaths({ swipedAmount, givenAmount, custPercent, commissionType, supplierPercent }) {
  const excluded = commissionType === 'excluded';
  const cr = rateUnits(custPercent);
  const sr = rateUnits(supplierPercent);
  // Without a rate (a legacy row), the stored pair is the truth.
  const byRate = has(custPercent);

  let swipe; // fils
  let cash; // fils
  if (excluded) {
    cash = fils(givenAmount);
    if (byRate) {
      const firstCharge = filsOf(cash, cr);
      const secondCharge = filsOf(cash + firstCharge, cr);
      // Swiped in whole dirhams, half-up.
      swipe = Math.floor((cash + secondCharge + 50) / 100) * 100;
    } else {
      swipe = fils(swipedAmount);
    }
  } else {
    swipe = fils(swipedAmount);
    cash = byRate ? swipe - wholeDirhamsOf(swipe, cr) : fils(givenAmount);
  }

  const charge = swipe - cash; // fils
  const fee = filsOf(swipe, sr);

  return {
    swipedAmount: swipe / 100,
    givenAmount: cash / 100,
    chargeToCustomer: charge / 100,
    custPercent: byRate ? cr / 10000 : cash ? round2((charge / cash) * 100) : 0,
    commissionType: excluded ? 'excluded' : 'included',
    supplierPercent: sr / 10000,
    supplierFee: fee / 100,
    supplierAccount: (swipe - fee) / 100,
    margin: (charge - fee) / 100,
  };
}

/** swipeMaths() plus the settlement side, which only the server tracks. */
export function computeAmounts({
  swipedAmount,
  givenAmount,
  custPercent,
  commissionType = 'included',
  supplierPercent = 0,
  settlementAmount,
}) {
  const amounts = swipeMaths({ swipedAmount, givenAmount, custPercent, commissionType, supplierPercent });
  // settlementAmount is what actually landed - banks round down - so profit
  // is only real once it is known.
  const settled = has(settlementAmount) ? round2(settlementAmount) : null;

  return {
    ...amounts,
    settlementAmount: settled,
    profit: settled === null ? null : round2(settled - amounts.givenAmount),
  };
}
