'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { money, dateOnly, timeOnly } from '@/lib/format';
import {
  Button, Card, Empty, ErrorNote, Figure, Row, SectionTitle, Skeleton, SplitRail, StatusPill,
} from '@/components/ui';
import { IconList, IconChevron } from '@/components/Icons';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/reports/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell title={user?.shopName || 'Cash Book'} subtitle={dateOnly(new Date())}>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!data && !error ? (
        <LoadingState />
      ) : data ? (
        <div className="space-y-6 rise">
          <TopLine loans={data.loans} settlement={data.settlement} cash={data.cash} />

          <Outstanding settlement={data.settlement} />

          <section>
            <SectionTitle>Today</SectionTitle>
            <Card className="p-0">
              <div className="grid grid-cols-2">
                <div className="border-r border-[var(--rule)] p-3.5">
                  <Figure
                    label="Cash out"
                    value={money(data.today.givenAmount)}
                    sub="handed to customers"
                  />
                </div>
                <div className="p-3.5">
                  <Figure
                    label="Swiped"
                    value={money(data.today.swipedAmount)}
                    sub="taken on the machines"
                  />
                </div>
              </div>
              <div className="ruled border-t border-[var(--rule)] px-3.5">
                <Row
                  label="You earned"
                  sub={`${data.today.count} ${data.today.count === 1 ? 'swipe' : 'swipes'} today`}
                  value={data.today.margin}
                  tone="leaf"
                  strong
                />
                <Row label="Other income" value={data.income.today.amount} tone="leaf" />
                <Row label="Expenses" value={data.expense.today.amount} tone="stamp" />
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle
              action={
                <Link href="/loans" className="colhead flex items-center gap-0.5 !text-[var(--text)]">
                  All loans <IconChevron size={12} />
                </Link>
              }
            >
              Loans
            </SectionTitle>
            <Card className="p-0">
              <div className="grid grid-cols-2">
                <div className="border-r border-[var(--rule)] p-3.5">
                  <Figure label="Taken in" value={money(data.loans.taken)} sub={`${data.loans.count} loans`} />
                </div>
                <div className="p-3.5">
                  <Figure label="Still owed" value={money(data.loans.outstanding)} tone="stamp" sub={`${data.loans.openCount} still open`} />
                </div>
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>This month</SectionTitle>
            <Card className="ruled py-0">
              <Row label="Swiped on cards" value={data.month.swipedAmount} />
              <Row label="Cash given out" value={data.month.givenAmount} />
              <Row label="Charged to customers" value={data.month.chargeToCustomer} />
              <Row label="Supplier fee" value={data.month.supplierFee} tone="stamp" />
              <Row label="Margin" value={data.month.margin} tone="leaf" strong />
            </Card>
          </section>

          <section>
            <SectionTitle
              action={
                <Link
                  href="/transactions"
                  className="colhead flex items-center gap-0.5 !text-[var(--text)]"
                >
                  All entries <IconChevron size={12} />
                </Link>
              }
            >
              Latest entries
            </SectionTitle>
            {data.recent.length ? (
              <Card className="ruled py-0">
                {data.recent.map((t) => (
                  <RecentRow key={t._id} txn={t} />
                ))}
              </Card>
            ) : (
              <Empty
                icon={IconList}
                title="The book is empty"
                hint="Tap Enter to record the first card-to-cash transaction."
                action={
                  <Link href="/transactions/new">
                    <Button variant="stamp">Make an entry</Button>
                  </Link>
                }
              />
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

/**
 * The two running totals the owner checks first: the float the customers have
 * put in, and the money the card company is still holding.
 */
function TopLine({ loans, settlement, cash }) {
  return (
    <section>
      <Card className="p-0">
        <div className="grid grid-cols-2">
          <Link href="/loans" className="border-r border-[var(--rule)] p-3.5 active:bg-[var(--paper-2)]">
            <Figure
              label="Cash in Hand"
              value={money(cash.inHand)}
              size="lg"
            />
          </Link>
          <Link href="/settlements" className="p-3.5 active:bg-[var(--paper-2)]">
            <Figure
              label="With the company"
              value={money(settlement.pendingAmount)}
              size="lg"
              tone="stamp"
              sub={`${settlement.pendingCount} to come back`}
            />
          </Link>
        </div>
       
      </Card>
    </section>
  );
}

/**
 * The hero. In this business the owner fronts the cash and waits for the
 * card company, so the figure that matters most is what is still out.
 */
function Outstanding({ settlement }) {
  const nothingOut = !settlement.pendingCount;

  return (
    <section>
      <SectionTitle>Money out with the card company</SectionTitle>
      <Card className="p-4">
        <p className="sum text-[38px] leading-none text-stamp-500 dark:text-stamp-400">
          {money(settlement.pendingAmount)}
        </p>
        <p className="mt-1.5 text-[12.5px] muted">
          {nothingOut
            ? 'Everything has come back in.'
            : `Across ${settlement.pendingCount} ${
                settlement.pendingCount === 1 ? 'entry' : 'entries'
              } you are waiting on.`}
        </p>

        <div className="mt-4 border-t border-[var(--rule)] pt-3.5">
          <SplitRail
            segments={[
              { label: 'Received', value: settlement.receivedAmount, tone: 'leaf' },
              { label: 'Owed', value: settlement.pendingAmount, tone: 'stamp' },
            ]}
          />
        </div>

        {!nothingOut && (
          <Link href="/settlements" className="mt-3.5 block">
            <Button variant="soft" className="w-full">
              Settle entries <IconChevron size={15} />
            </Button>
          </Link>
        )}
      </Card>
    </section>
  );
}

function RecentRow({ txn }) {
  return (
    <Link
      href={`/transactions/${txn._id}`}
      className="flex items-center gap-3 px-3.5 py-3 active:bg-[var(--paper-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold">
            {txn.customerName || txn.customerMobile}
          </p>
          <StatusPill status={txn.settlementStatus} />
        </div>
        <p className="ref mt-0.5 text-[10.5px] muted-2">
          {txn.txnNumber} · {timeOnly(txn.txnDate)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="sum text-[15px]">{money(txn.swipedAmount)}</p>
        <p className="sum text-[11px] !font-semibold text-leaf-500 dark:text-leaf-400">
          +{money(txn.profit == null ? txn.margin : txn.profit)}
        </p>
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[190px]" />
      <Skeleton className="h-[150px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}
