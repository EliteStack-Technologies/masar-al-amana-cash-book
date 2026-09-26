/** Every amount in the book is UAE dirhams. */
export const CURRENCY = 'AED';

const aed = new Intl.NumberFormat('en-AE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const aedCompact = new Intl.NumberFormat('en-AE', {
  maximumFractionDigits: 0,
});

/** AED 123,456.00 */
export const money = (n) => `${CURRENCY} ${aed.format(Number(n) || 0)}`;

/** AED 123,456 — for tiles and buttons where decimals only add noise. */
export const moneyShort = (n) => `${CURRENCY} ${aedCompact.format(Math.round(Number(n) || 0))}`;

/**
 * Short form for tight tiles, in the K / L / Cr the shop counts in:
 *   950 -> AED 950.00 · 85,498 -> AED 85.5K · 2,50,000 -> AED 2.5L · 8,38,99,546 -> AED 8.39Cr
 * Up to two decimals, trailing zeros dropped; the sign is kept.
 */
export const moneyCompact = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a < 1000) return money(v);
  const [div, unit] = a >= 1e7 ? [1e7, 'Cr'] : a >= 1e5 ? [1e5, 'L'] : [1e3, 'K'];
  const short = Math.floor((a / div) * 100) / 100; // never rounds up past the real figure
  return `${CURRENCY} ${v < 0 ? '-' : ''}${short.toFixed(2).replace(/\.?0+$/, '')}${unit}`;
};

/**
 * A vendor ledger balance in words: + the card company has paid extra,
 * - it has paid short and still owes it.
 */
export const balanceText = (balance) => {
  if (!balance) return 'No balance';
  return balance > 0 ? `Paid extra ${money(balance)}` : `Short ${money(-balance)}`;
};

export const dateTime = (d) =>
  d
    ? new Intl.DateTimeFormat('en-AE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(new Date(d))
    : '—';

export const dateOnly = (d) =>
  d
    ? new Intl.DateTimeFormat('en-AE', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(new Date(d))
    : '—';

export const timeOnly = (d) =>
  d
    ? new Intl.DateTimeFormat('en-AE', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(new Date(d))
    : '—';

/** Today as YYYY-MM-DD in the browser's own timezone. */
export const todayInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const thisMonthInput = () => todayInput().slice(0, 7);

/** Value for a <input type="datetime-local"> from a Date or ISO string. */
export const toLocalInput = (d) => {
  const dt = d ? new Date(d) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`;
};


/**
 * Mirrors the server's computeAmounts() so the swipe form can show a live
 * preview before anything is saved. See backend/src/utils/calc.js for what
 * commissionType means.
 */
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

export const preview = ({ swipedAmount, givenAmount, custPercent, commissionType = 'included', supplierPercent }) =>
  swipeMaths({ swipedAmount, givenAmount, custPercent, commissionType, supplierPercent });

/**
 * The other half of the deal: the figure the form derives from the amount the
 * owner typed. Included -> the cash to hand over; excluded -> the swipe.
 */
export const counterFor = (amount, pct, commissionType) => {
  const r = swipeMaths({
    swipedAmount: amount,
    givenAmount: amount,
    custPercent: Number(pct) || 0,
    commissionType,
  });
  return commissionType === 'excluded' ? r.swipedAmount : r.givenAmount;
};
