'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import {
  IconUsers, IconMachine, IconArrowUp, IconArrowDown, IconHand, IconList,
  IconClock, IconTag, IconUser, IconChevron, IconLogout, IconWallet, IconCash, IconChart,
} from '@/components/Icons';

const GROUPS = [

  {
    title: 'Money in & out',
    items: [
      { href: '/opening', icon: IconCash, title: 'Opening balance', detail: 'Cash already in the drawer when the book starts' },
      { href: '/income', icon: IconArrowUp, title: 'Income', detail: 'Other money the shop receives' },
      { href: '/expenses', icon: IconArrowDown, title: 'Expenses', detail: 'Rent, salary, bills and more' },
      { href: '/transactions', icon: IconList, title: 'All swipes', detail: 'Every card entry in the book' },
      { href: '/capital', icon: IconWallet, title: 'Capital', detail: 'Money put in by owners or partners, and withdrawals' },
      { href: '/loans', icon: IconHand, title: 'Loans', detail: 'Payable and receivable loans, with repayments and collections' },
      { href: '/pl', icon: IconChart, title: 'Profit & loss', detail: 'Net profit by month, and profit settled to partners' },
      { href: '/settlements', icon: IconClock, title: 'Vendor settlement', detail: 'Machine-wise settlement and ledger with the card company' },
    ],
  },
    {
    title: 'People & machines',
    items: [
      { href: '/customers', icon: IconUsers, title: 'Customers', detail: 'Names and the rate you charge them' },
      { href: '/machines', icon: IconMachine, title: 'Card machines', detail: 'The devices you swipe on, and their supplier %' },
    ],
  },
  {
    title: 'Setup',
    items: [
      { href: '/categories', icon: IconTag, title: 'Categories', detail: 'Manage income & expense categories' },
      { href: '/profile', icon: IconUser, title: 'Profile', detail: 'Your name, shop name, password' },
    ],
  },
];

export default function MorePage() {
  const { user, logout } = useAuth();

  return (
    <AppShell title="More" subtitle={user?.shopName || 'Everything else'}>
      <div className="space-y-5 rise">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <div className="mb-2 border-b border-[var(--rule)] pb-1.5">
              <h2 className="colhead">{group.title}</h2>
            </div>
            <div className="card ruled py-0">
              {group.items.map(({ href, icon: Icon, title, detail }) => (
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
          </section>
        ))}

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-semibold text-stamp-500"
        >
          <IconLogout size={16} /> Sign out
        </button>
      </div>
    </AppShell>
  );
}
