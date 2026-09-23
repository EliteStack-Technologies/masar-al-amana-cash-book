'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs, downloadUrl } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, SectionTitle, Segmented, Skeleton } from '@/components/ui';
import { IconHand, IconChevron, IconPlus, IconDownload } from '@/components/Icons';

const STATUS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const VIEW = [
  { value: 'customer', label: 'By customer' },
  { value: 'entry', label: 'Every loan' },
];

export default function LoansPage() {
  const [status, setStatus] = useState('');
  const [view, setView] = useState('customer');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/loans${qs({ status })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [status]);

  return (
    <AppShell
      title="Loans"
      subtitle={data ? `${data.total} loans` : 'Loading…'}
      action={
        <Link href="/loans/new" aria-label="Add loan" className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]">
          <IconPlus size={18} />
        </Link>
      }
    >
      <div className="space-y-4">
        {data && (
          <Card className="p-0 rise">
            <div className="grid grid-cols-2">
              <div className="border-r border-[var(--rule)] p-3.5"><Figure label="Total taken" value={money(data.totals.taken)} /></div>
              <div className="p-3.5"><Figure label="Still owed" value={money(data.totals.outstanding)} tone="stamp" /></div>
            </div>
          </Card>
        )}

        <Segmented value={view} onChange={setView} options={VIEW} />
        {view === 'entry' ? <Segmented value={status} onChange={setStatus} options={STATUS} /> : null}
        <ErrorNote>{error}</ErrorNote>

        {/* Customer-wise settlement: what each lender has put in, what has
            gone back and what is still owed to them. */}
        {data && view === 'customer' ? (
          data.byCustomer.length ? (
            <section className="rise">
              <SectionTitle>Settlement by customer</SectionTitle>
              <div className="card ruled py-0">
                {data.byCustomer.map((c) => (
                  <div key={`${c.customerId || c.name}`} className="px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold">{c.name}</p>
                      <p className="sum shrink-0 text-[15px] text-stamp-500 dark:text-stamp-400">
                        {money(c.outstanding)}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <p className="ref text-[10.5px] muted-2">
                        {c.loans} {c.loans === 1 ? 'loan' : 'loans'}
                        {c.openLoans ? ` · ${c.openLoans} open` : ''} · last {dateOnly(c.lastAt)}
                      </p>
                      <p className="colhead">
                        in <span className="sum text-[11px] !font-semibold">{money(c.taken)}</span>
                        {' · '}
                        back{' '}
                        <span className="sum text-[11px] !font-semibold text-leaf-500 dark:text-leaf-400">
                          {money(c.repaid)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <Empty
              icon={IconHand}
              title="No loans yet"
              hint="Record the cash a customer puts into the shop, and the repayments as they go back."
              action={<Link href="/loans/new"><Button variant="stamp">Add loan</Button></Link>}
            />
          )
        ) : null}

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>
        ) : view === 'customer' ? null : data && data.items.length ? (
          <div className="space-y-4">
            <div className="flex gap-2.5">
              {['excel', 'pdf'].map((f) => (
                <a key={f} href={downloadUrl(f, { type: 'loans' })} target="_blank" rel="noreferrer" className="flex-1">
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
                    <p className="sum text-[15px]">{money(l.principal)}</p>
                    <p className="sum text-[11px] !font-semibold text-stamp-500 dark:text-stamp-400">{money(l.outstanding)} left</p>
                  </div>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Empty
            icon={IconHand}
            title={status ? 'No loans here' : 'No loans yet'}
            hint="Record the cash a customer puts into the shop, and the repayments as they go back."
            action={<Link href="/loans/new"><Button variant="stamp">Add loan</Button></Link>}
          />
        )}
      </div>
    </AppShell>
  );
}
