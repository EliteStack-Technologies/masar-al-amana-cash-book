'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { todayInput, dateOnly, money, moneyShort } from '@/lib/format';
import { Card, Empty, ErrorNote, Row, SectionTitle, Skeleton, cx } from '@/components/ui';
import { PeriodPicker, PeriodTabs, ReportBreakdown, ReportHeadline } from '@/components/ReportBits';
import { DownloadMenu, PERIOD_COPIES } from '@/components/DownloadMenu';
import { IconChart, IconChevron } from '@/components/Icons';

export default function WeeklyReportPage() {
  return (
    <Suspense fallback={<AppShell title="One week" back><Skeleton className="h-[180px]" /></AppShell>}>
      <WeeklyReport />
    </Suspense>
  );
}

function WeeklyReport() {
  const initialDate = useSearchParams().get('date');
  const [date, setDate] = useState(initialDate || todayInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/reports/weekly${qs({ date })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [date]);

  const peak = data ? Math.max(...data.days.map((d) => d.swipedAmount), 1) : 1;

  return (
    <AppShell
      title="One week"
      subtitle={data ? `${dateOnly(`${data.start}T12:00:00`)} – ${dateOnly(`${data.end}T12:00:00`)}` : 'Mon to Sun'}
      back
      action={<DownloadMenu params={{ type: 'weekly', date }} copies={PERIOD_COPIES} />}
    >
      <div className="space-y-5">
        <PeriodTabs current="weekly" date={date} />
        <PeriodPicker type="date" label="Any day in the week" value={date} onChange={setDate} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5"><Skeleton className="h-[180px]" /><Skeleton className="h-[240px]" /></div>
        ) : data ? (
          <div className="space-y-5 rise">
            <ReportHeadline summary={data.summary} />
            <ReportBreakdown summary={data.summary} />

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

            <section>
              <SectionTitle>Day by day</SectionTitle>
              {data.days.length ? (
                <Card className="ruled py-0">
                  {data.days.map((day) => (
                    <DayRow key={day.date} day={day} peak={peak} />
                  ))}
                </Card>
              ) : (
                <Empty icon={IconChart} title="Nothing this week" hint="Pick another week." />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function DayRow({ day, peak }) {
  const weekday = new Intl.DateTimeFormat('en-AE', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`));
  const dayNum = day.date.slice(8);
  return (
    <Link href={`/reports/daily?date=${day.date}`} className="flex items-center gap-3.5 px-4 py-3 active:bg-[var(--paper-2)]">
      <div className="w-9 shrink-0">
        <p className="colhead">{weekday}</p>
        <p className="sum text-[17px] leading-none">{dayNum}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sum text-[14px]">{money(day.swipedAmount)}</span>
          <span className="sum text-[12px] !font-semibold text-leaf-600">+{moneyShort(day.margin)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]">
          <div className={cx('h-full rounded-full', day.pendingCount > 0 ? 'bg-stamp-500' : 'bg-brand-500')} style={{ width: `${Math.max(3, (day.swipedAmount / peak) * 100)}%` }} />
        </div>
        <p className="mt-1 text-[11px] muted-2">{day.count} {day.count === 1 ? 'swipe' : 'swipes'} · cash {moneyShort(day.givenAmount)}</p>
      </div>
      <span className="muted-2"><IconChevron size={15} /></span>
    </Link>
  );
}
