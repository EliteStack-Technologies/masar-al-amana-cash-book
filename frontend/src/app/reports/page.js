'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

import {
  IconCalendar, IconChart, IconPercent, IconChevron, IconClock, IconUsers, IconMachine,
} from '@/components/Icons';

const REPORTS = [
  {
    href: '/reports/daily',
    icon: IconCalendar,
    title: 'One day',
    detail: 'Any single day — transactions, income, expenses, loans',
  },
  {
    href: '/reports/weekly',
    icon: IconCalendar,
    title: 'One week',
    detail: 'Mon–Sun, day by day',
  },
  {
    href: '/reports/monthly',
    icon: IconChart,
    title: 'One month',
    detail: 'A month, broken down day by day',
  },
  {
    href: '/reports/commission',
    icon: IconPercent,
    title: 'Commission',
    detail: 'Your share vs the card company, by rate & customer',
  },
  {
    href: '/reports/customers',
    icon: IconUsers,
    title: 'Customer report',
    detail: 'Totals per customer',
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
    title: 'Money owed',
    detail: 'Everything still to come back in',
  },
];

export default function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="Each one exports to Excel or PDF">
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
