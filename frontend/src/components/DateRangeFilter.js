'use client';

import { Field } from '@/components/ui';

/**
 * True when `date` falls on or between the YYYY-MM-DD days `from` and `to`
 * (in the browser's own day). Either end may be empty.
 */
export const inDateRange = (date, from, to) => {
  if (!date) return !from && !to;
  const t = new Date(date).getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
};

/**
 * From / To day pickers with a Clear link. Both are optional: leave them
 * empty to see everything.
 */
export function DateRangeFilter({ from, to, onChange, label = 'Filter by date' }) {
  const active = Boolean(from || to);
  return (
    <div className="card space-y-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="colhead">{label}</span>
        {active && (
          <button type="button" onClick={() => onChange({ from: '', to: '' })} className="colhead !text-stamp-500">
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="From">
          <input className="field ref" type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} />
        </Field>
        <Field label="To">
          <input className="field ref" type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
