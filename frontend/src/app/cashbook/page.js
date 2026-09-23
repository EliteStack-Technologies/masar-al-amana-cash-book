'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly, timeOnly, todayInput } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Field, Figure, Segmented, Skeleton, cx } from '@/components/ui';
import { IconList } from '@/components/Icons';

/** How each kind of line reads in the book. */
const KINDS = {
  opening: { label: 'Opening', tone: 'text-leaf-500 dark:text-leaf-400' },
  swipe: { label: 'Swipe', tone: 'text-ink-500 dark:text-ink-300' },
  settlement: { label: 'Settlement', tone: 'text-leaf-500 dark:text-leaf-400' },
  loan: { label: 'Loan in', tone: 'text-leaf-500 dark:text-leaf-400' },
  repayment: { label: 'Repaid', tone: 'text-stamp-500 dark:text-stamp-400' },
  income: { label: 'Income', tone: 'text-leaf-500 dark:text-leaf-400' },
  expense: { label: 'Expense', tone: 'text-stamp-500 dark:text-stamp-400' },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'swipe', label: 'Swipes' },
  { value: 'loan', label: 'Loans' },
  { value: 'income', label: 'In/Out' },
];

/** YYYY-MM-DD for a stored date, in the browser's own timezone. */
const dayOf = (d) => {
  const dt = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

/** The month-to-date window the book opens on. */
const monthStart = () => `${todayInput().slice(0, 7)}-01`;

export default function CashbookPage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayInput);
  const [kind, setKind] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // null = closed, {} = a new opening balance, a ledger row = editing that one.
  const [opening, setOpening] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setData(null);
    setError('');
    api(`/cashbook${qs({ from, to })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [from, to, reload]);

  const openingSaved = () => {
    setOpening(null);
    setReload((n) => n + 1);
  };

  const shown = !data
    ? []
    : data.ledger.filter((r) => {
        if (!kind) return true;
        if (kind === 'swipe') return r.kind === 'swipe' || r.kind === 'settlement';
        if (kind === 'loan') return r.kind === 'loan' || r.kind === 'repayment';
        return r.kind === 'income' || r.kind === 'expense' || r.kind === 'opening';
      });

  return (
    <AppShell
      title="Cash book"
      subtitle={data ? `${data.count} entries · ${dateOnly(from)} to ${dateOnly(to)}` : 'Loading…'}
    >
      <div className="space-y-4">
        {data && (
          <Card className="p-0 rise">
            <div className="grid grid-cols-3">
              <div className="border-r border-[var(--rule)] p-3.5">
                <Figure label="Opening" value={money(data.opening)} />
              </div>
              <div className="border-r border-[var(--rule)] p-3.5">
                <Figure label="In" value={money(data.totalIn)} tone="leaf" />
              </div>
              <div className="p-3.5">
                <Figure label="Out" value={money(data.totalOut)} tone="stamp" />
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-[var(--rule)] px-3.5 py-3">
              <span className="colhead">Closing balance</span>
              <span className="sum text-[20px]">{money(data.closing)}</span>
            </div>
          </Card>
        )}

        {opening ? (
          <OpeningForm
            key={opening.id || 'new'}
            entry={opening}
            onDone={openingSaved}
            onCancel={() => setOpening(null)}
          />
        ) : (
          <Button variant="soft" className="w-full" onClick={() => setOpening({})}>
            + Opening balance
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input className="field ref" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="field ref" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <Segmented value={kind} onChange={setKind} options={FILTERS} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[62px]" />)}
          </div>
        ) : shown.length ? (
          <div className="card ruled py-0">
            {shown.map((r, i) => (
              <LedgerRow key={`${r.kind}-${r.ref}-${i}`} row={r} onEdit={() => setOpening(r)} />
            ))}
          </div>
        ) : (
          <Empty
            icon={IconList}
            title="Nothing in this window"
            hint="Every opening balance, swipe, settlement, loan, repayment, income and expense lands here. Widen the dates to see more."
          />
        )}
      </div>
    </AppShell>
  );
}

/** Add, edit or remove one opening balance: cash already in the drawer. */
function OpeningForm({ entry, onDone, onCancel }) {
  const editing = Boolean(entry.id);
  const [date, setDate] = useState(editing ? dayOf(entry.date) : todayInput());
  const [amount, setAmount] = useState(editing ? String(entry.amount) : '');
  const [notes, setNotes] = useState(editing ? entry.notes || '' : '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0.');
    setBusy('save');
    try {
      // Start of the chosen day, so it sits before that day's other entries.
      const body = { entryDate: new Date(`${date}T00:00`).toISOString(), amount: Number(amount), notes: notes.trim() };
      await api(editing ? `/cashbook/opening/${entry.id}` : '/cashbook/opening', {
        method: editing ? 'PATCH' : 'POST',
        body,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this opening balance?')) return;
    setError('');
    setBusy('delete');
    try {
      await api(`/cashbook/opening/${entry.id}`, { method: 'DELETE' });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <Card className="space-y-3.5 rise">
      <form onSubmit={save} className="space-y-3.5">
        <p className="text-[15px] font-semibold">{editing ? 'Edit opening balance' : 'Opening balance'}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className="field ref" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Amount" hint="Cash in the drawer">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[11px] muted-2">AED</span>
              <input
                className="field sum pl-12"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button type="button" variant="soft" className="flex-1" onClick={onCancel} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-[2]" loading={busy === 'save'} disabled={Boolean(busy)}>
            {editing ? 'Save' : 'Add opening balance'}
          </Button>
        </div>
        {editing && (
          <Button type="button" variant="ghost" className="w-full text-stamp-500" onClick={remove} loading={busy === 'delete'} disabled={Boolean(busy)}>
            Delete
          </Button>
        )}
      </form>
    </Card>
  );
}

function LedgerRow({ row, onEdit }) {
  const meta = KINDS[row.kind] || { label: row.kind, tone: 'muted' };
  const out = row.direction === 'out';

  const body = (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx('colhead shrink-0', meta.tone)}>{meta.label}</span>
          <p className="truncate text-[13.5px] font-semibold">{row.title}</p>
        </div>
        <p className="ref mt-0.5 truncate text-[10.5px] muted-2">
          {row.ref ? `${row.ref} · ` : ''}
          {dateOnly(row.date)} {timeOnly(row.date)}
          {row.detail ? ` · ${row.detail}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cx(
            'sum text-[15px]',
            out ? 'text-stamp-500 dark:text-stamp-400' : 'text-leaf-600 dark:text-leaf-400'
          )}
        >
          {out ? '-' : '+'}
          {money(row.amount)}
        </p>
        <p className="sum text-[11px] !font-semibold muted-2">{money(row.balance)}</p>
      </div>
    </div>
  );

  // Opening balances live on this page, so tapping one edits it here.
  if (row.kind === 'opening') {
    return (
      <button type="button" onClick={onEdit} className="block w-full text-left active:bg-[var(--paper-2)]">
        {body}
      </button>
    );
  }
  if (!row.link) return body;
  return (
    <Link href={row.link} className="block active:bg-[var(--paper-2)]">
      {body}
    </Link>
  );
}
