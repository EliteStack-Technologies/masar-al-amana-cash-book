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

export function preview({
  swipedAmount,
  givenAmount,
  custPercent,
  commissionType = 'included',
  supplierPercent,
}) {
  const excluded = commissionType === 'excluded';
  const supplierPct = Number(supplierPercent) || 0;

  let swiped;
  let given;
  let chargeToCustomer;

  if (has(swipedAmount) && has(givenAmount)) {
    swiped = round2(swipedAmount);
    given = round2(givenAmount);
    chargeToCustomer = round2(swiped - given);
  } else if (excluded) {
    given = round2(givenAmount || 0);
    chargeToCustomer = round2((given * (Number(custPercent) || 0)) / 100);
    swiped = round2(given + chargeToCustomer);
  } else {
    swiped = round2(swipedAmount || 0);
    chargeToCustomer = round2((swiped * (Number(custPercent) || 0)) / 100);
    given = round2(swiped - chargeToCustomer);
  }

  const base = excluded ? given : swiped;
  const supplierFee = round2((swiped * supplierPct) / 100);

  return {
    swipedAmount: swiped,
    givenAmount: given,
    chargeToCustomer,
    custPercent: base ? round2((chargeToCustomer / base) * 100) : 0,
    commissionType: excluded ? 'excluded' : 'included',
    supplierPercent: round2(supplierPct),
    supplierFee,
    supplierAccount: round2(swiped - supplierFee),
    margin: round2(chargeToCustomer - supplierFee),
  };
}

/**
 * The other half of the deal: the figure the form derives from the amount the
 * owner typed. Included -> the cash to hand over; excluded -> the swipe.
 */
export const counterFor = (amount, pct, commissionType) => {
  const a = round2(amount || 0);
  const charge = round2((a * (Number(pct) || 0)) / 100);
  return commissionType === 'excluded' ? round2(a + charge) : round2(a - charge);
};

/** The rate implied when the owner rounds that derived figure by hand. */
export const rateFor = (amount, counter, commissionType) => {
  const a = round2(amount || 0);
  if (!a) return 0;
  const charge = commissionType === 'excluded' ? round2(counter - a) : round2(a - counter);
  return round2((charge / a) * 100);
};
