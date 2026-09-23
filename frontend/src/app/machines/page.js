'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, Empty, ErrorNote, Skeleton } from '@/components/ui';
import { IconMachine, IconChevron, IconPlus } from '@/components/Icons';

export default function MachinesPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/machines')
      .then((d) => setItems(d.items))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell
      title="Card machines"
      subtitle={items ? `${items.length} machines` : 'Loading…'}
      action={
        <Link href="/machines/new" aria-label="Add machine" className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]">
          <IconPlus size={18} />
        </Link>
      }
    >
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!items && !error ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[64px]" />)}</div>
      ) : items && items.length ? (
        <div className="card ruled py-0 rise">
          {items.map((m) => (
            <Link key={m._id} href={`/machines/${m._id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
              <span className="flex size-9 shrink-0 items-center justify-center border border-[var(--rule-strong)]"><IconMachine size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14px] font-semibold">{m.name}</p>
                  {m.status === 'inactive' && <span className="stamp-mark muted-2">Inactive</span>}
                </div>
                <p className="ref mt-0.5 text-[10.5px] muted-2">{m.machineNumber}{m.cardCompany ? ` · ${m.cardCompany}` : ''}</p>
              </div>
              <span className="ref shrink-0 text-[11px] muted-2">
                {m.supplierPercent ? `${m.supplierPercent}%` : 'no %'}
              </span>
              <span className="muted-2"><IconChevron size={16} /></span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          icon={IconMachine}
          title="No machines yet"
          hint="Add the card machines you swipe on. You must have at least one before recording a transaction."
          action={<Link href="/machines/new"><Button variant="stamp">Add machine</Button></Link>}
        />
      )}
    </AppShell>
  );
}
