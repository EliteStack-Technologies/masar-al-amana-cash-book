'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { Button, Empty, ErrorNote, Segmented, Skeleton, StatusPill } from '@/components/ui';
import { IconUsers, IconSearch, IconChevron, IconPlus } from '@/components/Icons';

const STATUS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setItems(null);
    setError('');
    api(`/customers${qs({ q: debouncedQ, status })}`)
      .then((d) => setItems(d.items))
      .catch((err) => setError(err.message));
  }, [debouncedQ, status]);

  return (
    <AppShell
      title="Customers"
      subtitle={items ? `${items.length} shown` : 'Loading…'}
      action={
        <Link href="/customers/new" aria-label="Add customer" className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]">
          <IconPlus size={18} />
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 muted"><IconSearch size={18} /></span>
          <input className="field pl-10" type="search" placeholder="Name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={status} onChange={setStatus} options={STATUS} />

        <ErrorNote>{error}</ErrorNote>

        {!items && !error ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[64px]" />)}</div>
        ) : items && items.length ? (
          <div className="card ruled py-0">
            {items.map((c) => (
              <Link key={c._id} href={`/customers/${c._id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold">{c.name}</p>
                    {c.status === 'inactive' && <span className="stamp-mark muted-2">Inactive</span>}
                  </div>
                  <p className="ref mt-0.5 text-[10.5px] muted-2">{c.mobile || 'No mobile'}</p>
                </div>
                <span className="muted-2"><IconChevron size={16} /></span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon={IconUsers}
            title={debouncedQ || status ? 'No customers match' : 'No customers yet'}
            hint={debouncedQ || status ? 'Try a different search.' : 'Add your first customer to start recording their transactions.'}
            action={<Link href="/customers/new"><Button variant="stamp">Add customer</Button></Link>}
          />
        )}
      </div>
    </AppShell>
  );
}
