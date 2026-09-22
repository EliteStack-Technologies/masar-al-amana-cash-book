'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, thisMonthInput } from '@/lib/format';
import { Card, Empty, ErrorNote, Skeleton } from '@/components/ui';
import { PeriodPicker, ExportButtons } from '@/components/ReportBits';
import { IconUsers } from '@/components/Icons';

export default function CustomerReportPage() {
  const [month, setMonth] = useState(thisMonthInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/reports/customers${qs({ month })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [month]);

  return (
    <AppShell title="Customer report" subtitle="Totals per customer" back>
      <div className="space-y-5">
        <PeriodPicker type="month" label="Month" value={month} onChange={setMonth} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <Skeleton className="h-[240px]" />
        ) : data ? (
          <div className="space-y-5 rise">
            <ExportButtons params={{ type: 'customer-report', month }} />
            {data.customers.length ? (
              <div className="space-y-2">
                {data.customers.map((c) => (
                  <Card key={c.customerId || c.customerMobile} className="p-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">{c.customerName || c.customerMobile}</p>
                        <p className="ref mt-0.5 text-[10.5px] muted-2">{c.customerMobile} · {c.count} entries</p>
                      </div>
                      <p className="sum text-[15px]">{money(c.cardAmount)}</p>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-[var(--rule)] pt-2 text-[12px]">
                      <span className="muted">Commission {money(c.commissionAmount)}</span>
                      <span className="sum text-leaf-500 dark:text-leaf-400">Yours {money(c.ownerCommission)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty icon={IconUsers} title="Nothing this month" hint="Pick another month." />
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
