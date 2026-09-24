'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { api, qs } from '@/lib/api';
import { todayInput, thisMonthInput, dateOnly, money, moneyShort } from '@/lib/format';
import { Card, Empty, ErrorNote, SectionTitle, Segmented, Skeleton, cx } from '@/components/ui';
import { PeriodPicker, ReportBreakdown, ReportHeadline } from '@/components/ReportBits';
import { DownloadMenu, PERIOD_COPIES } from '@/components/DownloadMenu';
import { IconList, IconChevron } from '@/components/Icons';
import { VendorSettlement, useVendorLedger } from '@/components/VendorSettlement';
import { Pager, usePaged } from '@/components/Pager';

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const NOUN = { daily: 'day', weekly: 'week', monthly: 'month' };

export default function MachinePeriodReportPage() {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense fallback={<AppShell title="Machine" back><Skeleton className="h-[180px]" /></AppShell>}>
      <MachinePeriodReport />
    </Suspense>
  );
}

function MachinePeriodReport() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  const [period, setPeriod] = useState(
    PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : 'daily'
  );
  const [date, setDate] = useState(params.get('date') || todayInput());
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  // Bumped after a settlement is marked or undone, so the swipes' statuses
  // and settled totals below are fetched again.
  const [reload, setReload] = useState(0);
  const ledger = useVendorLedger(id);
  // Switching tab or date renders once before the new fetch starts; the old
  // response must not be read as the new period in that render.
  const data = response && response.period === period && response.date === date ? response : null;

  useEffect(() => {
    let alive = true;
    setResponse(null);
    setError('');
    // Kept in the address so a refresh or a shared link opens the same view.
    router.replace(`/reports/machines/${id}${qs({ period, date })}`, { scroll: false });
    api(`/reports/machines/${id}${qs({ period, date })}`)
      .then((d) => alive && setResponse(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [id, period, date, reload]);

  // The month picker works in YYYY-MM; keep today when it is this month.
  const pickMonth = (month) => setDate(month === thisMonthInput() ? todayInput() : `${month}-01`);
  const openDay = (day) => {
    setPeriod('daily');
    setDate(day);
  };

  const peak = data ? Math.max(...data.days.map((d) => d.swipedAmount), 1) : 1;
  const txnPage = usePaged(data?.transactions, 20, [period, date]);

  return (
    <AppShell
      title={data?.machine.name || 'Machine'}
      subtitle={data ? [data.machine.cardCompany, periodLabel(data)].filter(Boolean).join(' · ') : 'Loading…'}
      back
      action={
        <DownloadMenu
          params={{ type: 'machine-period', machine: id, period, date }}
          copies={PERIOD_COPIES}
          label="Download machine report"
        />
      }
    >
      <div className="space-y-5">
        {/* Settling is for the machine as a whole, whatever period is shown. */}
        <VendorSettlement
          machineId={id}
          ledger={ledger}
          collapsible
          onChange={() => setReload((n) => n + 1)}
        />

        <Segmented value={period} onChange={setPeriod} options={PERIODS} />

        {period === 'monthly' ? (
          <PeriodPicker type="month" label="Month" value={date.slice(0, 7)} onChange={pickMonth} />
        ) : (
          <PeriodPicker
            type="date"
            label={period === 'weekly' ? 'Any day in the week' : 'Date'}
            value={date}
            onChange={setDate}
          />
        )}

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[240px]" />
          </div>
        ) : data ? (
          <div className="space-y-5 rise">
            <ReportHeadline summary={data.summary} />
            <ReportBreakdown summary={data.summary} />

            {period !== 'daily' && (
              <section>
                <SectionTitle>Day by day</SectionTitle>
                {data.days.length ? (
                  <Card className="ruled py-0">
                    {data.days.map((day) => (
                      <DayRow key={day.date} day={day} peak={peak} onOpen={() => openDay(day.date)} />
                    ))}
                  </Card>
                ) : (
                  <p className="text-[13px] muted">No swipes on this machine this {NOUN[period]}.</p>
                )}
              </section>
            )}

            <section>
              <SectionTitle>
                {data.transactions.length} {data.transactions.length === 1 ? 'transaction' : 'transactions'}
              </SectionTitle>
              {data.transactions.length ? (
                <div className="space-y-2">
                  {txnPage.pageItems.map((t) => (
                    <TransactionCard key={t._id} txn={t} />
                  ))}
                  <Pager
                    className="pt-2"
                    page={txnPage.page}
                    pages={txnPage.pages}
                    total={txnPage.total}
                    noun="transactions"
                    onChange={txnPage.setPage}
                  />
                </div>
              ) : (
                <Empty
                  icon={IconList}
                  title={`Nothing this ${NOUN[period]}`}
                  hint={`No swipes were taken on ${data.machine.name} in this ${NOUN[period]}.`}
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/** Subtitle for a response, read from the period the server answered for. */
function periodLabel(data) {
  if (data.period === 'monthly') return data.label;
  if (data.period === 'weekly') {
    const [start, end] = data.label.split(' to ');
    return `${dateOnly(`${start}T12:00:00`)} – ${dateOnly(`${end}T12:00:00`)}`;
  }
  return dateOnly(`${data.date}T12:00:00`);
}

/** One day of the week or month; tapping it opens that day for this machine. */
function DayRow({ day, peak, onOpen }) {
  const weekday = new Intl.DateTimeFormat('en-AE', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`));
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-[var(--paper-2)]">
      <div className="w-9 shrink-0">
        <p className="colhead">{weekday}</p>
        <p className="sum text-[17px] leading-none">{day.date.slice(8)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sum text-[14px]">{money(day.swipedAmount)}</span>
          <span className="sum text-[12px] !font-semibold text-leaf-600">+{moneyShort(day.margin)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]">
          <div
            className={cx('h-full rounded-full', day.pendingCount > 0 ? 'bg-stamp-500' : 'bg-brand-500')}
            style={{ width: `${Math.max(3, (day.swipedAmount / peak) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] muted-2">
          {day.count} {day.count === 1 ? 'swipe' : 'swipes'} · cash {moneyShort(day.givenAmount)}
        </p>
      </div>
      <span className="muted-2"><IconChevron size={15} /></span>
    </button>
  );
}
