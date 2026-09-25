'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly, timeOnly, todayInput } from '@/lib/format';
import { Card, Empty, ErrorNote, Field, Figure, Segmented, Skeleton, cx } from '@/components/ui';
import { IconList } from '@/components/Icons';
import { Pager, usePaged } from '@/components/Pager';

const PAGE_SIZE = 30;

/** How each kind of line reads in the book. */
const KINDS = {
  opening: { label: 'Opening', tone: 'text-leaf-500 dark:text-leaf-400' },
  swipe: { label: 'Swipe', tone: 'text-ink-500 dark:text-ink-300' },
  settlement: { label: 'Settlement', tone: 'text-leaf-500 dark:text-leaf-400' },
  'settle-diff': { label: 'Settle diff', tone: 'text-sun-600' },
  loan: { label: 'Loan in', tone: 'text-leaf-500 dark:text-leaf-400' },
  repayment: { label: 'Repaid', tone: 'text-stamp-500 dark:text-stamp-400' },
  lend: { label: 'Loan out', tone: 'text-stamp-500 dark:text-stamp-400' },
  collection: { label: 'Collected', tone: 'text-leaf-500 dark:text-leaf-400' },
  'profit-out': { label: 'Profit out', tone: 'text-stamp-500 dark:text-stamp-400' },
  capital: { label: 'Capital in', tone: 'text-leaf-500 dark:text-leaf-400' },
  withdrawal: { label: 'Capital out', tone: 'text-stamp-500 dark:text-stamp-400' },
  income: { label: 'Income', tone: 'text-leaf-500 dark:text-leaf-400' },
  expense: { label: 'Expense', tone: 'text-stamp-500 dark:text-stamp-400' },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'swipe', label: 'Swipes' },
  { value: 'loan', label: 'Loans' },
  { value: 'capital', label: 'Capital' },
  { value: 'income', label: 'In/Out' },
];

/** The month-to-date window the book opens on. */
const monthStart = () => `${todayInput().slice(0, 7)}-01`;

export default function CashbookPage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayInput);
  const [kind, setKind] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/cashbook${qs({ from, to })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [from, to]);

  const shown = !data
    ? []
    : data.ledger.filter((r) => {
        if (!kind) return true;
        if (kind === 'swipe') return r.kind === 'swipe' || r.kind === 'settlement' || r.kind === 'settle-diff';
        if (kind === 'loan') return ['loan', 'repayment', 'lend', 'collection'].includes(r.kind);
        if (kind === 'capital') return r.kind === 'capital' || r.kind === 'withdrawal';
        return ['income', 'expense', 'opening', 'profit-out'].includes(r.kind);
      });
  // Back to page 1 when the window or the filter changes.
  const paged = usePaged(shown, PAGE_SIZE, [from, to, kind]);

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
          <div className="space-y-4">
            <div className="card ruled py-0">
              {paged.pageItems.map((r, i) => (
                <LedgerRow key={`${r.kind}-${r.ref}-${paged.page}-${i}`} row={r} />
              ))}
            </div>
            <Pager page={paged.page} pages={paged.pages} total={paged.total} onChange={paged.setPage} />
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

function LedgerRow({ row }) {
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

  if (!row.link) return body;
  return (
    <Link href={row.link} className="block active:bg-[var(--paper-2)]">
      {body}
    </Link>
  );
}
