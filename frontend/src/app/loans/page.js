'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api, qs, downloadUrl } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Segmented, Skeleton, cx } from '@/components/ui';
import { IconHand, IconChevron, IconPlus, IconDownload } from '@/components/Icons';
import { Pager, usePageFor } from '@/components/Pager';
import { LOAN_SIDES, SIDE_OPTIONS } from '@/components/LoanForm';

import { Amt } from '@/components/Amount';
const STATUS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

/** Owed by the shop reads in red ink, owed to it in green. */
const toneOf = (direction) => (direction === 'receivable' ? 'leaf' : 'stamp');
const textTone = (direction) =>
  direction === 'receivable' ? 'text-leaf-500 dark:text-leaf-400' : 'text-stamp-500 dark:text-stamp-400';

export default function LoansPage() {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense fallback={<AppShell title="Loans"><Skeleton className="h-[180px]" /></AppShell>}>
      <Loans />
    </Suspense>
  );
}

function Loans() {
  const router = useRouter();
  // The open side lives in the URL, so coming back from a loan lands on it.
  const direction = useSearchParams().get('direction') === 'receivable' ? 'receivable' : 'payable';
  const side = LOAN_SIDES[direction];
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = usePageFor(`${direction}|${status}`);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/loans${qs({ direction, status, page })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [direction, status, page]);

  const setDirection = (d) =>
    router.replace(`/loans${qs({ direction: d === 'receivable' ? d : '' })}`, { scroll: false });
  const newHref = `/loans/new${qs({ direction })}`;
  const addButton = (
    <Link href={newHref}><Button variant="stamp">Add {side.label.toLowerCase()} loan</Button></Link>
  );

  return (
    <AppShell
      title="Loans"
      subtitle={data ? `${data.total} ${side.label.toLowerCase()} ${data.total === 1 ? 'loan' : 'loans'}` : 'Loading…'}
      action={
        <Link href={newHref} aria-label="Add loan" className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]">
          <IconPlus size={18} />
        </Link>
      }
    >
      <div className="space-y-4">
        {/* The two sides of the loan book, and the switch between them: the
            open side is marked, and everything below lists that side only. */}
        <Card className="p-0 rise">
          <div className="grid grid-cols-2">
            {SIDE_OPTIONS.map(({ value }, i) => {
              const s = LOAN_SIDES[value];
              const pos = data?.position[value];
              const open = value === direction;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  aria-pressed={open}
                  className={cx(
                    'border-b-2 p-3.5 text-left active:bg-[var(--paper-2)]',
                    i === 0 && 'border-r border-r-[var(--rule)]',
                    open ? 'border-b-stamp-500 bg-[var(--paper-2)]' : 'border-b-transparent'
                  )}
                >
                  <p className={cx('colhead mb-1.5', open && '!text-[var(--text)]')}>{s.label}</p>
                  <Figure
                    label={s.outstanding}
                    amount={pos ? pos.outstanding : undefined}
                    value="…"
                    tone={toneOf(value)}
                    sub={pos ? `${s.amount.toLowerCase()} ${money(pos.taken)}` : undefined}
                  />
                </button>
              );
            })}
          </div>
        </Card>

        <Segmented value={status} onChange={setStatus} options={STATUS} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>
        ) : data && data.items.length ? (
          <div className="space-y-4">
            <div className="flex gap-2.5">
              {['excel', 'pdf'].map((f) => (
                <a key={f} href={downloadUrl(f, { type: 'loans', direction })} target="_blank" rel="noreferrer" className="flex-1">
                  <Button type="button" variant="soft" className="w-full"><IconDownload size={16} /> {f === 'excel' ? 'Excel' : 'PDF'}</Button>
                </a>
              ))}
            </div>

            <div className="card ruled py-0">
              {data.items.map((l) => (
                <Link key={l._id} href={`/loans/${l._id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-semibold">{l.lenderName}</p>
                      {l.status === 'closed' && <span className="stamp-mark text-leaf-500 dark:text-leaf-400">Closed</span>}
                    </div>
                    <p className="ref mt-0.5 text-[10.5px] muted-2">{l.loanNumber} · {dateOnly(l.entryDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="sum text-[15px]"><Amt value={l.principal} /></p>
                    <p className={cx('sum text-[11px] !font-semibold', textTone(direction))}><Amt value={l.outstanding} /> left</p>
                  </div>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </Link>
              ))}
            </div>

            <Pager page={data.page} pages={data.pages} total={data.total} noun="loans" onChange={setPage} />
          </div>
        ) : (
          <Empty
            icon={IconHand}
            title={status ? 'No loans here' : `No ${side.label.toLowerCase()} loans yet`}
            hint={side.empty}
            action={addButton}
          />
        )}
      </div>
    </AppShell>
  );
}
