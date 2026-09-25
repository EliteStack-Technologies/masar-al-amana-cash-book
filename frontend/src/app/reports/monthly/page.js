'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { thisMonthInput, todayInput, money, moneyShort } from '@/lib/format';
import { Card, Empty, ErrorNote, Row, SectionTitle, Skeleton, cx } from '@/components/ui';
import { PeriodPicker, PeriodTabs, ReportBreakdown, ReportHeadline } from '@/components/ReportBits';
import { DownloadMenu, PERIOD_COPIES } from '@/components/DownloadMenu';
import { IconChart, IconChevron } from '@/components/Icons';

export default function MonthlyReportPage() {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense fallback={<AppShell title="One month" back><Skeleton className="h-[180px]" /></AppShell>}>
      <MonthlyReport />
    </Suspense>
  );
}

/**
 * The day handed to the daily and weekly tabs: today while looking at this
 * month, otherwise the 1st of the month on screen.
 */
const dayInMonth = (month) => (month === thisMonthInput() ? todayInput() : `${month}-01`);

function MonthlyReport() {
  // The Daily and Weekly tabs link here with ?date=YYYY-MM-DD.
  const initialDate = useSearchParams().get('date');
  const [month, setMonth] = useState(initialDate ? initialDate.slice(0, 7) : thisMonthInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');

    api(`/reports/monthly${qs({ month })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));

    return () => {
      alive = false;
    };
  }, [month]);

  const peak = data ? Math.max(...data.days.map((d) => d.swipedAmount), 1) : 1;

  return (
    <AppShell
      title="One month"
      subtitle={month}
      back
      action={<DownloadMenu params={{ type: 'monthly', month }} copies={PERIOD_COPIES} />}
    >
      <div className="space-y-5">
        <PeriodTabs current="monthly" date={dayInMonth(month)} />
        <PeriodPicker type="month" label="Month" value={month} onChange={setMonth} />

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[280px]" />
          </div>
        ) : data ? (
          <div className="space-y-5 rise">
            <ReportHeadline summary={data.summary} />
            <ReportBreakdown summary={data.summary} />

            {data.income && (
              <section>
                <SectionTitle>Income, expenses & loans</SectionTitle>
                <Card className="ruled py-0">
                  <Row label="Other income" value={data.income.amount} tone="leaf" />
                  <Row label="Expenses" value={data.expense.amount} tone="stamp" />
                  <Row label="Loans taken" value={data.loans.taken.amount} />
                  <Row label="Loan repayments" value={data.loans.repaid.amount} tone="leaf" />
                  <Row label="Loans lent out" value={data.loans.given?.amount || 0} tone="stamp" />
                  <Row label="Loans collected" value={data.loans.collected?.amount || 0} tone="leaf" />
                </Card>
              </section>
            )}

            <section>
              <SectionTitle>Day-wise breakdown</SectionTitle>
              {data.days.length ? (
                <Card className="ruled py-0">
                  {data.days.map((day) => (
                    <DayRow key={day.date} day={day} peak={peak} />
                  ))}
                </Card>
              ) : (
                <Empty
                  icon={IconChart}
                  title="No entries this month"
                  hint="Choose another month from the picker above."
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/** One day in the breakdown. The bar is scaled against the busiest day,
    so the month's shape is readable at a glance. */
function DayRow({ day, peak }) {
  const dayNum = day.date.slice(8);
  const weekday = new Intl.DateTimeFormat('en-AE', { weekday: 'short' }).format(
    new Date(`${day.date}T12:00:00`)
  );

  return (
    <Link
      href={`/reports/daily?date=${day.date}`}
      className="flex items-center gap-3.5 px-4 py-3 active:bg-[var(--paper-2)]"
    >
      <div className="w-8 shrink-0">
        <p className="sum text-[18px] leading-none">{dayNum}</p>
        <p className="colhead mt-1">{weekday}</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sum text-[14px]">{money(day.swipedAmount)}</span>
          <span className="sum text-[12px] !font-semibold text-leaf-500 dark:text-leaf-400">
            +{moneyShort(day.margin)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 bg-[var(--paper-2)]">
          <div
            className={cx('h-full', day.pendingCount > 0 ? 'bg-stamp-500' : 'bg-ink-900 dark:bg-ink-200')}
            style={{ width: `${Math.max(3, (day.swipedAmount / peak) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] muted-2">
          {day.count} {day.count === 1 ? 'swipe' : 'swipes'} · cash{' '}
          {moneyShort(day.givenAmount)}
          {day.pendingCount > 0 && ` · ${day.pendingCount} still owed`}
        </p>
      </div>

      <span className="muted-2">
        <IconChevron size={15} />
      </span>
    </Link>
  );
}
