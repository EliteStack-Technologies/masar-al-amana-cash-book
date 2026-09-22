'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { api, downloadUrl } from '@/lib/api';
import { money } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Figure, Skeleton, SplitRail, cx } from '@/components/ui';
import { IconCheck, IconClock, IconDownload } from '@/components/Icons';

export default function SettlementsPage() {
  const [pending, setPending] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/reports/settlement')
      .then((d) => {
        setPending(d.pending);
        setSummary(d.summary);
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
    .reduce((sum, t) => sum + t.settlementAmount, 0);

  return (
    <AppShell
      title="Owed to you"
      subtitle={pending ? `${pending.length} ${pending.length === 1 ? 'entry' : 'entries'} waiting on the card company` : 'Loading…'}
      action={
        pending?.length ? (
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

        <ErrorNote>{error}</ErrorNote>

        {!pending ? (
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
              {pending.map((t) => (
                <TransactionCard
                  key={t._id}
                  txn={t}
                  selectable={selectMode}
                  selected={selected.has(t._id)}
                  onToggle={toggle}
                />
              ))}
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
