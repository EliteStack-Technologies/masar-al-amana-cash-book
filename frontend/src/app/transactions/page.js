'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { api, qs, downloadUrl } from '@/lib/api';
import { money } from '@/lib/format';
import {
  Button, Card, Empty, ErrorNote, Segmented, Skeleton, cx,
} from '@/components/ui';
import {
  IconSearch, IconFilter, IconList, IconDownload,
} from '@/components/Icons';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Owed' },
  { value: 'received', label: 'Received' },
];

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  return (
    <Suspense fallback={<AppShell title="Entries" subtitle="Loading…"><Skeleton className="h-[200px]" /></AppShell>}>
      <TransactionsList />
    </Suspense>
  );
}

function TransactionsList() {
  const sp = useSearchParams();
  const customer = sp.get('customer') || '';
  const machine = sp.get('machine') || '';

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, totals: {} });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = useCallback(
    (page) => ({
      q: debouncedQ,
      status,
      customer,
      machine,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : '',
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedQ, status, from, to, customer, machine]
  );

  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');

    api(`/transactions${qs(params(1))}`)
      .then((data) => {
        if (id !== reqId.current) return; // a newer request already won
        setItems(data.items);
        setMeta({ page: data.page, pages: data.pages, total: data.total, totals: data.totals });
      })
      .catch((err) => id === reqId.current && setError(err.message))
      .finally(() => id === reqId.current && setLoading(false));
  }, [params]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api(`/transactions${qs(params(meta.page + 1))}`);
      setItems((prev) => [...prev, ...data.items]);
      setMeta((m) => ({ ...m, page: data.page }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilters = Boolean(from || to);
  const exportParams = { ...params(1), page: undefined, limit: undefined };

  return (
    <AppShell
      title="Entries"
      subtitle={loading ? 'Loading…' : `${meta.total} ${meta.total === 1 ? 'entry' : 'entries'} in the book`}
      action={
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filters"
          aria-expanded={showFilters}
          className={cx(
            'flex size-9 items-center justify-center border transition-colors',
            showFilters || activeFilters
              ? 'border-stamp-500 bg-stamp-500 text-ink-50'
              : 'border-[var(--rule-strong)]'
          )}
        >
          <IconFilter size={19} />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 muted">
            <IconSearch size={18} />
          </span>
          <input
            className="field pl-10"
            type="search"
            inputMode="search"
            placeholder="Mobile, entry no, card ref, amount"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Segmented value={status} onChange={setStatus} options={STATUS_OPTIONS} />

        {showFilters && (
          <Card className="space-y-3 rise">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="colhead mb-1.5 block">From</span>
                <input
                  className="field"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="colhead mb-1.5 block">To</span>
                <input
                  className="field"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="soft"
                className="flex-1"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
              >
                Clear dates
              </Button>
              <a
                href={downloadUrl('excel', exportParams)}
                className="flex-1"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="button" variant="soft" className="w-full">
                  <IconDownload size={16} /> Excel
                </Button>
              </a>
              <a
                href={downloadUrl('pdf', exportParams)}
                className="flex-1"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="button" variant="soft" className="w-full">
                  <IconDownload size={16} /> PDF
                </Button>
              </a>
            </div>
          </Card>
        )}

        {!loading && items.length > 0 && <TotalsBar totals={meta.totals} />}

        <ErrorNote>{error}</ErrorNote>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[84px]" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <div className="space-y-2">
              {items.map((t) => (
                <TransactionCard key={t._id} txn={t} />
              ))}
            </div>

            {meta.page < meta.pages && (
              <Button
                type="button"
                variant="soft"
                className="w-full"
                loading={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? 'Loading…' : `Show more (${meta.total - items.length} left)`}
              </Button>
            )}
          </>
        ) : (
          <Empty
            icon={IconList}
            title={debouncedQ || status || activeFilters ? 'Nothing matches' : 'The book is empty'}
            hint={
              debouncedQ || status || activeFilters
                ? 'Try a different search term or clear the filters.'
                : 'Record your first card-to-cash transaction to get started.'
            }
            action={
              <Link href="/transactions/new">
                <Button variant="stamp">Make an entry</Button>
              </Link>
            }
          />
        )}
      </div>
    </AppShell>
  );
}

/** Totals for the whole filtered set, not just the loaded page. */
function TotalsBar({ totals }) {
  const cells = [
    ['Cash out', totals.customerReceived, ''],
    ['Card in', totals.cardAmount, ''],
    ['Yours', totals.ownerCommission, 'text-leaf-500 dark:text-leaf-400'],
  ];
  return (
    <div className="card grid grid-cols-3 p-0">
      {cells.map(([label, value, tone], i) => (
        <div key={label} className={cx('px-2.5 py-2.5', i < 2 && 'border-r border-[var(--rule)]')}>
          <p className="colhead">{label}</p>
          <p className={cx('sum mt-1 text-[13.5px]', tone)}>{money(value || 0)}</p>
        </div>
      ))}
    </div>
  );
}
