'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, thisMonthInput } from '@/lib/format';
import { Card, Empty, ErrorNote, Skeleton } from '@/components/ui';
import { PeriodPicker } from '@/components/ReportBits';
import { DownloadMenu, REPORT_COPIES } from '@/components/DownloadMenu';
import { IconMachine } from '@/components/Icons';

export default function MachineReportPage() {
  const [month, setMonth] = useState(thisMonthInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/reports/machines${qs({ month })}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [month]);

  return (
    <AppShell
      title="Machine report"
      subtitle="Totals per card machine"
      back
      action={<DownloadMenu params={{ type: 'machine-report', month }} copies={REPORT_COPIES} />}
    >
      <div className="space-y-5">
        <PeriodPicker type="month" label="Month" value={month} onChange={setMonth} />
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <Skeleton className="h-[240px]" />
        ) : data ? (
          <div className="space-y-5 rise">
            {data.machines.length ? (
              <div className="space-y-2">
                {data.machines.map((m) => (
                  <Card key={m.machineId || m.machineName} className="p-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">{m.machineName}</p>
                        <p className="ref mt-0.5 text-[10.5px] muted-2">{m.cardCompany || '—'} · {m.count} entries</p>
                      </div>
                      <p className="sum text-[15px]">{money(m.swipedAmount)}</p>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-[var(--rule)] pt-2 text-[12px]">
                      <span className="muted">Charged {money(m.chargeToCustomer)}</span>
                      <span className="sum text-leaf-500 dark:text-leaf-400">Margin {money(m.margin)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty icon={IconMachine} title="Nothing this month" hint="Pick another month." />
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
