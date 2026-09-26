'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Skeleton } from '@/components/ui';
import { IconArrowUp, IconSearch, IconChevron, IconPlus } from '@/components/Icons';
import { DownloadMenu } from '@/components/DownloadMenu';
import { Pager, usePageFor } from '@/components/Pager';

import { Amt } from '@/components/Amount';
export default function IncomePage() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = usePageFor(debouncedQ);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/income${qs({ q: debouncedQ, page })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [debouncedQ, page]);

  return (
    <AppShell
      title="Income"
      subtitle={data ? `${data.total} entries` : 'Loading…'}
      action={<DownloadMenu params={{ type: 'income' }} label="Download income" />}
    >
      <div className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 muted"><IconSearch size={18} /></span>
          <input className="field pl-10" type="search" placeholder="Category, received from, notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[60px]" />)}</div>
        ) : data && data.items.length ? (
          <div className="space-y-4 rise">
            <Card className="p-3.5"><Figure label="Total income (filtered)" amount={data.totals.amount} tone="leaf" size="lg" /></Card>

            <Link href="/income/new" className="block">
              <Button type="button" variant="stamp" className="w-full">
                <IconPlus size={17} /> Add income
              </Button>
            </Link>

            <div className="card ruled py-0">
              {data.items.map((it) => (
                <Link key={it._id} href={`/income/${it._id}/edit`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{it.category || 'Uncategorised'}</p>
                    <p className="ref mt-0.5 text-[10.5px] muted-2">{dateOnly(it.entryDate)}{it.receiver ? ` · ${it.receiver}` : ''}</p>
                  </div>
                  <p className="sum shrink-0 text-[15px] text-leaf-500 dark:text-leaf-400">+<Amt value={it.amount} /></p>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </Link>
              ))}
            </div>

            <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </div>
        ) : (
          <Empty
            icon={IconArrowUp}
            title={debouncedQ ? 'No income matches' : 'No income yet'}
            hint={debouncedQ ? 'Try a different search.' : 'Record commission, sales, service or any other money coming in.'}
            action={<Link href="/income/new"><Button variant="stamp">Add income</Button></Link>}
          />
        )}
      </div>
    </AppShell>
  );
}
