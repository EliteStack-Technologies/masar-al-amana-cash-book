'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Skeleton } from '@/components/ui';
import { IconArrowDown, IconSearch, IconChevron, IconPlus } from '@/components/Icons';
import { DownloadMenu } from '@/components/DownloadMenu';

export default function ExpensesPage() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setData(null);
    setError('');
    api(`/expenses${qs({ q: debouncedQ })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [debouncedQ]);

  return (
    <AppShell
      title="Expenses"
      subtitle={data ? `${data.total} entries` : 'Loading…'}
      action={<DownloadMenu params={{ type: 'expenses' }} label="Download expense" />}
    >
      <div className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 muted"><IconSearch size={18} /></span>
          <input className="field pl-10" type="search" placeholder="Category, paid to, notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[60px]" />)}</div>
        ) : data && data.items.length ? (
          <div className="space-y-4 rise">
            <Card className="p-3.5"><Figure label="Total expenses (filtered)" value={money(data.totals.amount)} tone="stamp" size="lg" /></Card>

            <Link href="/expenses/new" className="block">
              <Button type="button" variant="stamp" className="w-full">
                <IconPlus size={17} /> Add expense
              </Button>
            </Link>

            <div className="card ruled py-0">
              {data.items.map((it) => (
                <Link key={it._id} href={`/expenses/${it._id}/edit`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{it.category || 'Uncategorised'}</p>
                    <p className="ref mt-0.5 text-[10.5px] muted-2">{dateOnly(it.entryDate)}{it.payee ? ` · ${it.payee}` : ''}</p>
                  </div>
                  <p className="sum shrink-0 text-[15px] text-stamp-500 dark:text-stamp-400">−{money(it.amount)}</p>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Empty
            icon={IconArrowDown}
            title={debouncedQ ? 'No expenses match' : 'No expenses yet'}
            hint={debouncedQ ? 'Try a different search.' : 'Record rent, salary, electricity, transport and other costs.'}
            action={<Link href="/expenses/new"><Button variant="stamp">Add expense</Button></Link>}
          />
        )}
      </div>
    </AppShell>
  );
}
