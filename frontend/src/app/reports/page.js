'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

import {
  IconCalendar, IconChevron, IconClock, IconMachine,
} from '@/components/Icons';

const REPORTS = [
  {
    href: '/reports/daily',
    icon: IconCalendar,
    title: 'Period report',
    detail: 'Daily, weekly or monthly — switch at the top of the report',
  },
  {
    href: '/reports/machines',
    icon: IconMachine,
    title: 'Machine report',
    detail: 'Totals per card machine',
  },
  {
    href: '/settlements',
    icon: IconClock,
    title: 'Vendor settlement',
    detail: 'Machine-wise settlement and ledger with the card company',
  },
];

export default function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="Download any of these — full copy or card company copy">
      <div className="card ruled rise py-0">
        {REPORTS.map(({ href, icon: Icon, title, detail }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3.5 p-4 active:bg-[var(--paper-2)]"
          >
            <span className="icon-chip size-10 shrink-0">
              <Icon size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="display text-[15px] font-bold">{title}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug muted">{detail}</p>
            </div>
            <span className="muted-2">
              <IconChevron size={16} />
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
