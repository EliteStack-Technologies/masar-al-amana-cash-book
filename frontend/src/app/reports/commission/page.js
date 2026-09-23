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
  const keptPct = s?.chargeToCustomer
    ? Math.round((s.margin / s.chargeToCustomer) * 100)
    : 0;

  return (
    <AppShell title="Margin" subtitle={month} back>
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
            {/* What customers were charged this month, splitting into what
                the supplier kept and what stayed in the shop. */}
            <Card className="p-4">
              <Figure
                label="Charged to customers this month"
                value={money(s.chargeToCustomer)}
                size="lg"
              />
              <div className="mt-3.5 border-t border-[var(--rule)] pt-3.5">
                <SplitRail
                  segments={[
                    { label: 'Margin', value: s.margin, tone: 'leaf' },
                    { label: 'Supplier', value: s.supplierFee, tone: 'quiet' },
                  ]}
                  caption={`You kept ${keptPct}% of what you charged across ${s.count} ${
                    s.count === 1 ? 'swipe' : 'swipes'
                  }, averaging ${s.averageCustPercent}% of the amount swiped.`}
                />
              </div>
            </Card>

            <section>
              <SectionTitle>By rate charged</SectionTitle>
              {data.byPercent.length ? (
                <Card className="ruled py-0">
                  {data.byPercent.map((r) => (
                    <RateRow key={r.custPercent} row={r} />
                  ))}
                </Card>
              ) : (
                <Empty
                  icon={IconPercent}
                  title="No swipes this month"
                  hint="Pick a different month from the picker above."
                />
              )}
            </section>

            {data.bySupplierRate.length > 0 && (
              <section>
                <SectionTitle>By supplier rate</SectionTitle>
                <Card className="py-1">
                  {data.bySupplierRate.map((r) => (
                    <Row
                      key={r.supplierPercent}
                      label={`${r.supplierPercent}% supplier fee`}
                      sub={`${r.count} ${r.count === 1 ? 'swipe' : 'swipes'}`}
                      value={r.supplierFee}
                    />
                  ))}
                  <Divider />
                  <Row label="Total fee" value={s.supplierFee} strong />
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
        {row.custPercent}%
      </span>
      <div className="min-w-0 flex-1">
        <p className="sum text-[15px]">{money(row.chargeToCustomer)}</p>
        <p className="mt-0.5 text-[11.5px] muted-2">
          {row.count} {row.count === 1 ? 'swipe' : 'swipes'} · margin{' '}
          <span className="sum !font-semibold text-leaf-500 dark:text-leaf-400">
            {money(row.margin)}
          </span>
        </p>
      </div>
    </div>
  );
}
