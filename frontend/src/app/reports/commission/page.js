'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { thisMonthInput, money } from '@/lib/format';
import { Card, Divider, Empty, ErrorNote, Figure, Row, SectionTitle, Skeleton, SplitRail } from '@/components/ui';
import { ExportButtons, PeriodPicker } from '@/components/ReportBits';
import { IconPercent } from '@/components/Icons';

export default function CommissionReportPage() {
  const [month, setMonth] = useState(thisMonthInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');

    api(`/reports/commission${qs({ month })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));

    return () => {
      alive = false;
    };
  }, [month]);

  const s = data?.summary;
  const ownerPct = s?.commissionAmount
    ? Math.round((s.ownerCommission / s.commissionAmount) * 100)
    : 0;

  return (
    <AppShell title="Commission" subtitle={month} back>
      <div className="space-y-5">
        <PeriodPicker type="month" label="Month" value={month} onChange={setMonth} />

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[150px]" />
            <Skeleton className="h-[240px]" />
          </div>
        ) : data ? (
          <div className="space-y-5 rise">
            {/* The same rail as everywhere else, here dividing the month's
                commission between the two sides. */}
            <Card className="p-4">
              <Figure
                label="Commission charged this month"
                value={money(s.commissionAmount)}
                size="lg"
              />
              <div className="mt-3.5 border-t border-[var(--rule)] pt-3.5">
                <SplitRail
                  segments={[
                    { label: 'Yours', value: s.ownerCommission, tone: 'leaf' },
                    { label: 'Card co.', value: s.companyCommission, tone: 'quiet' },
                  ]}
                  caption={`You kept ${ownerPct}% of the commission across ${s.count} ${
                    s.count === 1 ? 'entry' : 'entries'
                  }, averaging ${s.averageCommissionPercent}% of what customers asked for.`}
                />
              </div>
            </Card>

            <section>
              <SectionTitle>By commission rate</SectionTitle>
              {data.byPercent.length ? (
                <Card className="ruled py-0">
                  {data.byPercent.map((r) => (
                    <RateRow key={r.commissionPercent} row={r} />
                  ))}
                </Card>
              ) : (
                <Empty
                  icon={IconPercent}
                  title="No commission this month"
                  hint="Pick a different month from the picker above."
                />
              )}
            </section>

            {data.byType.length > 0 && (
              <section>
                <SectionTitle>By commission type</SectionTitle>
                <Card className="py-1">
                  {data.byType.map((r) => (
                    <Row
                      key={r.commissionType}
                      label={r.commissionType === 'included' ? 'Included' : 'Excluded'}
                      sub={`${r.count} ${r.count === 1 ? 'entry' : 'entries'}`}
                      value={r.commissionAmount}
                    />
                  ))}
                  <Divider />
                  <Row label="Total" value={s.commissionAmount} strong />
                </Card>
              </section>
            )}

            <ExportButtons params={{ type: 'commission', month }} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function RateRow({ row }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <span className="ref flex size-10 shrink-0 items-center justify-center border border-[var(--rule-strong)] text-[12px] font-medium">
        {row.commissionPercent}%
      </span>
      <div className="min-w-0 flex-1">
        <p className="sum text-[15px]">{money(row.commissionAmount)}</p>
        <p className="mt-0.5 text-[11.5px] muted-2">
          {row.count} {row.count === 1 ? 'entry' : 'entries'} · yours{' '}
          <span className="sum !font-semibold text-leaf-500 dark:text-leaf-400">
            {money(row.ownerCommission)}
          </span>
        </p>
      </div>
    </div>
  );
}
