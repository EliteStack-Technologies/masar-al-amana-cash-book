'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateOnly } from '@/lib/format';
import {
  Card, Empty, ErrorNote, Figure, Row, SectionTitle, Skeleton, SplitRail,
} from '@/components/ui';
import { IconHand, IconChevron } from '@/components/Icons';
import { DownloadMenu } from '@/components/DownloadMenu';

/**
 * One lender's whole loan history: the combined position at the top, then
 * every loan they have put in with its own repayments underneath.
 */
export default function AccountLoansPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/loans/account/${id}`)
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
      subtitle={data ? `${t.loans} ${t.loans === 1 ? 'loan' : 'loans'} · ${data.account.accountNumber}` : 'Loading…'}
      back
      action={
        <DownloadMenu
          params={{ type: 'account-loans', accountId: id }}
          label="Download loan history"
        />
      }
    >
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!data && !error ? (
        <div className="space-y-2.5">
          <Skeleton className="h-[170px]" />
          <Skeleton className="h-[240px]" />
        </div>
      ) : data ? (
        <div className="space-y-5 rise">
          {/* The combined position across every loan this account has given. */}
          <Card className="p-0">
            <div className="grid grid-cols-2">
              <div className="border-r border-[var(--rule)] p-3.5">
                <Figure label="Total put in" value={money(t.taken)} size="lg" />
              </div>
              <div className="p-3.5">
                <Figure label="Still owed" value={money(t.outstanding)} tone="stamp" size="lg" />
              </div>
            </div>
            <div className="border-t border-[var(--rule)] p-3.5">
              <SplitRail
                segments={[
                  { label: 'Repaid', value: t.repaid, tone: 'leaf' },
                  { label: 'Outstanding', value: t.outstanding, tone: 'stamp' },
                ]}
                caption={
                  t.firstAt
                    ? `From ${dateOnly(t.firstAt)} to ${dateOnly(t.lastAt)}.`
                    : undefined
                }
              />
            </div>
          </Card>

          <section>
            <SectionTitle>Account</SectionTitle>
            <Card className="ruled py-0">
              <Row label="Account name" value={data.account.name} isMoney={false} />
              <Row label="Mobile" value={data.account.mobile || '—'} isMoney={false} />
              <Row label="Account no" value={data.account.accountNumber} isMoney={false} />
              <Row label="Open loans" value={t.openLoans} isMoney={false} />
              <Row label="Closed loans" value={t.closedLoans} isMoney={false} />
              <Row label="Repayments recorded" value={t.repayments} isMoney={false} />
            </Card>
          </section>

          <section>
            <SectionTitle>Every loan</SectionTitle>
            {data.loans.length ? (
              <div className="space-y-2.5">
                {data.loans.map((l) => (
                  <Card key={l._id} className="p-0">
                    <Link
                      href={`/loans/${l._id}`}
                      className="flex items-center gap-3 p-3.5 active:bg-[var(--paper-2)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="sum text-[15px]">{money(l.principal)}</p>
                          {l.status === 'closed' && (
                            <span className="stamp-mark text-leaf-500 dark:text-leaf-400">Closed</span>
                          )}
                        </div>
                        <p className="ref mt-0.5 text-[10.5px] muted-2">
                          {l.loanNumber} · {dateOnly(l.entryDate)}
                          {l.notes ? ` · ${l.notes}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="sum text-[13px] text-leaf-500 dark:text-leaf-400">
                          {money(l.settledAmount)} back
                        </p>
                        <p className="sum text-[13px] text-stamp-500 dark:text-stamp-400">
                          {money(l.outstanding)} left
                        </p>
                      </div>
                      <span className="muted-2"><IconChevron size={15} /></span>
                    </Link>

                    {/* The repayments booked against this one loan. */}
                    {l.settlements.length > 0 && (
                      <div className="border-t border-[var(--rule)] px-3.5 py-2">
                        <p className="colhead mb-1">
                          {l.settlements.length} repayment{l.settlements.length === 1 ? '' : 's'}
                        </p>
                        {l.settlements.map((s) => (
                          <div key={s._id} className="flex items-baseline justify-between gap-3 py-0.5">
                            <p className="ref truncate text-[10.5px] muted-2">
                              {dateOnly(s.entryDate)}{s.notes ? ` · ${s.notes}` : ''}
                            </p>
                            <p className="sum shrink-0 text-[12px] text-leaf-500 dark:text-leaf-400">
                              {money(s.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Empty
                icon={IconHand}
                title="No loans from this account"
                hint="Nothing has been recorded against them yet."
              />
            )}
          </section>

        </div>
      ) : null}
    </AppShell>
  );
}
