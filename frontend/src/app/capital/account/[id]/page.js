'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import { Card, Empty, ErrorNote, Figure, Row, SectionTitle, Skeleton, SplitRail } from '@/components/ui';
import { IconWallet, IconChevron } from '@/components/Icons';

/**
 * One partner's whole capital history: the combined position at the top, then
 * every entry they have put in with its own withdrawals underneath.
 */
export default function AccountCapitalPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/capital/account/${id}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const t = data?.totals;

  return (
    <AppShell
      title={data?.account.name || 'Account'}
      subtitle={data ? `${t.entries} ${t.entries === 1 ? 'entry' : 'entries'} · ${data.account.accountNumber}` : 'Loading…'}
      back
    >
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!data && !error ? (
        <div className="space-y-2.5">
          <Skeleton className="h-[170px]" />
          <Skeleton className="h-[240px]" />
        </div>
      ) : data ? (
        <div className="space-y-5 rise">
          <Card className="p-0">
            <div className="grid grid-cols-2">
              <div className="border-r border-[var(--rule)] p-3.5">
                <Figure label="Total put in" value={money(t.invested)} size="lg" />
              </div>
              <div className="p-3.5">
                <Figure label="In the shop" value={money(t.balance)} tone="leaf" size="lg" />
              </div>
            </div>
            <div className="border-t border-[var(--rule)] p-3.5">
              <SplitRail
                segments={[
                  { label: 'Withdrawn', value: t.withdrawn, tone: 'stamp' },
                  { label: 'In the shop', value: t.balance, tone: 'leaf' },
                ]}
                caption={t.firstAt ? `From ${dateOnly(t.firstAt)} to ${dateOnly(t.lastAt)}.` : undefined}
              />
            </div>
          </Card>

          <section>
            <SectionTitle>Account</SectionTitle>
            <Card className="ruled py-0">
              <Row label="Account name" value={data.account.name} isMoney={false} />
              <Row label="Mobile" value={data.account.mobile || '—'} isMoney={false} />
              <Row label="Account no" value={data.account.accountNumber} isMoney={false} />
              <Row label="Withdrawals recorded" value={t.withdrawals} isMoney={false} />
            </Card>
          </section>

          <section>
            <SectionTitle>Every entry</SectionTitle>
            {data.entries.length ? (
              <div className="space-y-2.5">
                {data.entries.map((c) => (
                  <Card key={c._id} className="p-0">
                    <Link href={`/capital/${c._id}`} className="flex items-center gap-3 p-3.5 active:bg-[var(--paper-2)]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="sum text-[15px]">{money(c.amount)}</p>
                          {c.status === 'closed' && (
                            <span className="stamp-mark text-stamp-500 dark:text-stamp-400">Withdrawn</span>
                          )}
                        </div>
                        <p className="ref mt-0.5 text-[10.5px] muted-2">
                          {c.capitalNumber} · {dateOnly(c.entryDate)}
                          {c.notes ? ` · ${c.notes}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="sum text-[13px] text-stamp-500 dark:text-stamp-400">{money(c.withdrawnAmount)} out</p>
                        <p className="sum text-[13px] text-leaf-500 dark:text-leaf-400">{money(c.balance)} in</p>
                      </div>
                      <span className="muted-2"><IconChevron size={15} /></span>
                    </Link>

                    {c.withdrawals.length > 0 && (
                      <div className="border-t border-[var(--rule)] px-3.5 py-2">
                        <p className="colhead mb-1">
                          {c.withdrawals.length} withdrawal{c.withdrawals.length === 1 ? '' : 's'}
                        </p>
                        {c.withdrawals.map((w) => (
                          <div key={w._id} className="flex items-baseline justify-between gap-3 py-0.5">
                            <p className="ref truncate text-[10.5px] muted-2">
                              {dateOnly(w.entryDate)}{w.notes ? ` · ${w.notes}` : ''}
                            </p>
                            <p className="sum shrink-0 text-[12px] text-stamp-500 dark:text-stamp-400">{money(w.amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Empty icon={IconWallet} title="No capital from this account" hint="Nothing has been recorded against them yet." />
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
