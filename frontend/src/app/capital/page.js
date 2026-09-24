'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, SectionTitle, Segmented, Skeleton } from '@/components/ui';
import { IconWallet, IconChevron, IconPlus } from '@/components/Icons';
import { Pager, usePageFor } from '@/components/Pager';

const STATUS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Withdrawn' },
];

const VIEW = [
  { value: 'account', label: 'By account' },
  { value: 'entry', label: 'Every entry' },
];

const HINT = 'Record the capital an owner or partner puts into the shop, and any withdrawals they take back.';

export default function CapitalPage() {
  const [status, setStatus] = useState('');
  const [view, setView] = useState('account');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = usePageFor(status);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/capital${qs({ status, page })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [status, page]);

  const addButton = <Link href="/capital/new"><Button variant="stamp">Add capital</Button></Link>;

  return (
    <AppShell
      title="Capital"
      subtitle={data ? `${data.total} ${data.total === 1 ? 'entry' : 'entries'}` : 'Loading…'}
      action={
        <Link href="/capital/new" aria-label="Add capital" className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]">
          <IconPlus size={18} />
        </Link>
      }
    >
      <div className="space-y-4">
        {data && (
          <Card className="p-0 rise">
            <div className="grid grid-cols-2">
              <div className="border-r border-[var(--rule)] p-3.5"><Figure label="Total put in" value={money(data.totals.invested)} /></div>
              <div className="p-3.5"><Figure label="In the shop" value={money(data.totals.balance)} tone="leaf" /></div>
            </div>
          </Card>
        )}

        <Segmented value={view} onChange={setView} options={VIEW} />
        {view === 'entry' ? <Segmented value={status} onChange={setStatus} options={STATUS} /> : null}
        <ErrorNote>{error}</ErrorNote>

        {data && view === 'account' ? (
          data.byAccount.length ? (
            <section className="rise">
              <SectionTitle>Capital by account</SectionTitle>
              <div className="card ruled py-0">
                {data.byAccount.map((c) => (
                  <AccountRow key={`${c.accountId || c.name}`} c={c} />
                ))}
              </div>
            </section>
          ) : (
            <Empty icon={IconWallet} title="No capital yet" hint={HINT} action={addButton} />
          )
        ) : null}

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>
        ) : view === 'account' ? null : data && data.items.length ? (
          <div className="space-y-4">
            <div className="card ruled py-0">
              {data.items.map((c) => (
                <Link key={c._id} href={`/capital/${c._id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-semibold">{c.partnerName}</p>
                      {c.status === 'closed' && <span className="stamp-mark text-stamp-500 dark:text-stamp-400">Withdrawn</span>}
                    </div>
                    <p className="ref mt-0.5 text-[10.5px] muted-2">{c.capitalNumber} · {dateOnly(c.entryDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="sum text-[15px]">{money(c.amount)}</p>
                    <p className="sum text-[11px] !font-semibold text-leaf-500 dark:text-leaf-400">{money(c.balance)} in</p>
                  </div>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </Link>
              ))}
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </div>
        ) : (
          <Empty icon={IconWallet} title={status ? 'No capital here' : 'No capital yet'} hint={HINT} action={addButton} />
        )}
      </div>
    </AppShell>
  );
}

/** One partner's line in the by-account list. Tapping it opens their history. */
function AccountRow({ c }) {
  return (
    <Link
      href={`/capital/account/${c.accountId}`}
      className="flex items-center gap-2.5 px-3.5 py-3 active:bg-[var(--paper-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold">{c.name}</p>
          <p className="sum shrink-0 text-[15px] text-leaf-500 dark:text-leaf-400">{money(c.balance)}</p>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <p className="ref text-[10.5px] muted-2">
            {c.entries} {c.entries === 1 ? 'entry' : 'entries'} · last {dateOnly(c.lastAt)}
          </p>
          <p className="colhead">
            in <span className="sum text-[11px] !font-semibold">{money(c.invested)}</span>
            {' · '}
            out{' '}
            <span className="sum text-[11px] !font-semibold text-stamp-500 dark:text-stamp-400">
              {money(c.withdrawn)}
            </span>
          </p>
        </div>
      </div>
      <span className="shrink-0 muted-2"><IconChevron size={15} /></span>
    </Link>
  );
}
