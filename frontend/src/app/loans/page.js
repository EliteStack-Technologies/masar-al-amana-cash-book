'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs, downloadUrl } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Segmented, Skeleton } from '@/components/ui';
import { IconHand, IconChevron, IconPlus, IconDownload } from '@/components/Icons';

const STATUS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export default function LoansPage() {
  const [status, setStatus] = useState('');
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
              <div className="border-r border-[var(--rule)] p-3.5"><Figure label="Total given" value={money(data.totals.given)} /></div>
              <div className="p-3.5"><Figure label="Outstanding" value={money(data.totals.outstanding)} tone="stamp" /></div>
            </div>
          </Card>
        )}

        <Segmented value={status} onChange={setStatus} options={STATUS} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>
        ) : data && data.items.length ? (
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
                      <p className="truncate text-[14px] font-semibold">{l.borrowerName}</p>
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
            hint="Track money you have lent out and record repayments as they come in."
            action={<Link href="/loans/new"><Button variant="stamp">Add loan</Button></Link>}
          />
        )}
      </div>
    </AppShell>
  );
}
