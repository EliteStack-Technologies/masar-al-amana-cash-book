'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { api, downloadUrl } from '@/lib/api';
import { money, dateOnly, balanceText } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Segmented, Skeleton, SplitRail, cx } from '@/components/ui';
import { IconCheck, IconChevron, IconDownload, IconMachine } from '@/components/Icons';
import { Pager, usePaged } from '@/components/Pager';

const VIEWS = [
  { value: 'machine', label: 'By machine' },
  { value: 'entries', label: 'All entries' },
];

export default function SettlementsPage() {
  const [view, setView] = useState('machine');
  const [vendors, setVendors] = useState(null);
  const [pending, setPending] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([api('/reports/settlement'), api('/settlements/vendors')])
      .then(([d, v]) => {
        setPending(d.pending);
        setSummary(d.summary);
        setVendors(v);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const settleSelected = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/transactions/bulk-settle', {
        method: 'POST',
        body: { ids: [...selected] },
      });
      exitSelectMode();
      setPending(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedTotal = (pending || [])
    .filter((t) => selected.has(t._id))
    .reduce((sum, t) => sum + t.supplierAccount, 0);

  // Selections are kept by id, so they carry across pages.
  const paged = usePaged(pending, 20);

  return (
    <AppShell
      title="Vendor settlement"
      subtitle={pending ? `${pending.length} ${pending.length === 1 ? 'entry' : 'entries'} waiting on the card company` : 'Loading…'}
      action={
        view === 'entries' && pending?.length ? (
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className="colhead min-h-9 border border-[var(--rule-strong)] px-3 !text-[var(--text)] active:bg-[var(--paper-2)]"
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        {summary && (
          <Card className="p-4">
            <Figure
              label="Still out with the card company"
              value={money(summary.pendingAmount)}
              size="lg"
              tone="stamp"
            />
            <div className="mt-3.5 border-t border-[var(--rule)] pt-3.5">
              <SplitRail
                segments={[
                  { label: 'Received', value: summary.receivedAmount, tone: 'leaf' },
                  { label: 'Owed', value: summary.pendingAmount, tone: 'stamp' },
                ]}
                caption={`${summary.receivedCount} settled · ${summary.pendingCount} outstanding, all time.`}
              />
            </div>
          </Card>
        )}

        <Segmented
          value={view}
          onChange={(v) => {
            exitSelectMode();
            setView(v);
          }}
          options={VIEWS}
        />

        <ErrorNote>{error}</ErrorNote>

        {view === 'machine' ? (
          !vendors ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[92px]" />
              ))}
            </div>
          ) : vendors.items.length ? (
            <div className="space-y-2">
              {vendors.items.map((v) => (
                <VendorRow key={v.machineId} v={v} />
              ))}
            </div>
          ) : (
            <Empty
              icon={IconMachine}
              title="No card machines yet"
              hint="Add a card machine to settle with its card company."
            />
          )
        ) : !pending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[84px]" />
            ))}
          </div>
        ) : pending.length ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="colhead">Oldest first</p>
              <a
                href={downloadUrl('excel', { type: 'settlement' })}
                target="_blank"
                rel="noreferrer"
                className="colhead flex items-center gap-1 !text-[var(--text)]"
              >
                <IconDownload size={15} /> Export
              </a>
            </div>

            <div className={cx('space-y-2', selectMode && 'pb-20')}>
              {paged.pageItems.map((t) => (
                <TransactionCard
                  key={t._id}
                  txn={t}
                  selectable={selectMode}
                  selected={selected.has(t._id)}
                  onToggle={toggle}
                />
              ))}
              <Pager
                className="pt-2"
                page={paged.page}
                pages={paged.pages}
                total={paged.total}
                onChange={paged.setPage}
              />
            </div>
          </>
        ) : (
          <Empty
            icon={IconCheck}
            title="Nothing is owed"
            hint="Every entry has come back in from the card company."
            action={
              <Link href="/transactions">
                <Button variant="soft">Open the book</Button>
              </Link>
            }
          />
        )}
      </div>

      {/* Bulk action bar floats above the tab bar while selecting. */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+var(--safe-bottom))] z-40 px-4">
          <div className="mx-auto flex max-w-xl items-center gap-3 border border-[var(--rule-strong)] bg-[var(--paper-3)] p-2.5 pl-3.5 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="colhead">{selected.size} selected</p>
              <p className="sum mt-0.5 text-[16px]">{money(selectedTotal)}</p>
            </div>
            <Button type="button" variant="stamp" loading={busy} onClick={settleSelected}>
              <IconCheck size={16} /> Mark received
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/**
 * One machine's card company: what it still owes on pending swipes, and the
 * running balance from past settlements. Tapping it opens the ledger, where
 * the settlement is marked.
 */
function VendorRow({ v }) {
  return (
    <Link href={`/settlements/machine/${v.machineId}`} className="block">
      <Card className="p-3.5 active:bg-[var(--paper-2)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{v.name}</p>
            <p className="ref mt-0.5 text-[10.5px] muted-2">
              {v.cardCompany || '—'} · {v.pendingCount} pending
              {v.lastSettledAt ? ` · last ${dateOnly(v.lastSettledAt)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="colhead">Due</p>
              <p className="sum text-[15px] text-stamp-500 dark:text-stamp-400">{money(v.pendingAmount)}</p>
            </div>
            <span className="muted-2"><IconChevron size={15} /></span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--rule)] pt-2 text-[12px]">
          <span className="muted">Ledger balance</span>
          <span
            className={cx(
              'sum',
              v.balance > 0 && 'text-leaf-500 dark:text-leaf-400',
              v.balance < 0 && 'text-stamp-500 dark:text-stamp-400',
              !v.balance && 'muted-2'
            )}
          >
            {balanceText(v.balance)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
