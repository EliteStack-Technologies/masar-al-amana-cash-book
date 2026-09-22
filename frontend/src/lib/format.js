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
 * Mirrors the server's computeAmounts() so the New Transaction form can show
 * a live preview before anything is saved.
 */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function preview({ requestedAmount, commissionPercent, commissionType, ownerSharePercent }) {
  const requested = round2(requestedAmount || 0);
  const commissionAmount = round2((requested * (Number(commissionPercent) || 0)) / 100);
  const isIncluded = commissionType === 'included';

  const customerReceived = isIncluded ? round2(requested - commissionAmount) : requested;
  const cardAmount = isIncluded ? requested : round2(requested + commissionAmount);
  const ownerCommission = round2((commissionAmount * (Number(ownerSharePercent) || 0)) / 100);

  return {
    commissionAmount,
    customerReceived,
    cardAmount,
    ownerCommission,
    companyCommission: round2(commissionAmount - ownerCommission),
    // What the card company pays back to you: customer's cash + your share.
    settlementAmount: round2(customerReceived + ownerCommission),
  };
}
