'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, thisMonthInput, todayInput } from '@/lib/format';
import { Card, Empty, ErrorNote, Skeleton } from '@/components/ui';
import { PeriodPicker } from '@/components/ReportBits';
import { DownloadMenu, REPORT_COPIES } from '@/components/DownloadMenu';
import { IconMachine, IconChevron } from '@/components/Icons';

/**
 * Every machine, busiest first, so one with no swipes this month can still be
 * opened for its own daily / weekly / monthly report.
 */
function withIdleMachines(reported, all) {
  const seen = new Set(reported.map((m) => String(m.machineId)));
  const idle = all
    .filter((m) => !seen.has(String(m._id)))
    .map((m) => ({
      machineId: m._id,
      machineName: m.name,
      cardCompany: m.cardCompany,
      count: 0,
      swipedAmount: 0,
      chargeToCustomer: 0,
      margin: 0,
    }));
  return [...reported, ...idle];
}

export default function MachineReportPage() {
  const [month, setMonth] = useState(thisMonthInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    Promise.all([api(`/reports/machines${qs({ month })}`), api('/machines')])
      .then(([report, list]) => setData({ ...report, machines: withIdleMachines(report.machines, list.items) }))
      .catch((err) => setError(err.message));
  }, [month]);

  // Opens a machine on its daily report: today while looking at this month,
  // otherwise the 1st of the month shown here.
  const openDate = month === thisMonthInput() ? todayInput() : `${month}-01`;

  return (
    <AppShell
      title="Machine report"
      subtitle="Tap a machine for its own report"
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
                {data.machines.map((m) => {
                  const body = (
                    <Card className="p-3.5 active:bg-[var(--paper-2)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">{m.machineName}</p>
                          <p className="ref mt-0.5 text-[10.5px] muted-2">{m.cardCompany || '—'} · {m.count} entries</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <IconChevron size={15} />
                        </div>
                      </div>
                 
                    </Card>
                  );
                  // Tapping a machine opens its own daily / weekly / monthly report.
                  return m.machineId ? (
                    <Link
                      key={m.machineId}
                      href={`/reports/machines/${m.machineId}?period=daily&date=${openDate}`}
                      className="block"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={m.machineName}>{body}</div>
                  );
                })}
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
