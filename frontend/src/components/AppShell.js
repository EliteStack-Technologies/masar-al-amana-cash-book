'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { cx, Spinner } from '@/components/ui';
import {
  IconHome, IconList, IconPlus, IconChart, IconGrid, IconUser, IconBack,
} from '@/components/Icons';

const TABS = [
  { href: '/dashboard', label: 'Book', icon: IconHome },
  { href: '/transactions', label: 'Entries', icon: IconList },
  { href: '/transactions/new', label: 'Enter', icon: IconPlus, stamp: true },
  { href: '/reports', label: 'Reports', icon: IconChart },
  { href: '/more', label: 'More', icon: IconGrid },
];

const isActive = (pathname, href) => {
  if (href === '/transactions') {
    return pathname === '/transactions' || /^\/transactions\/(?!new)/.test(pathname);
  }
  if (href === '/more') {
    // The More hub is the home for these sections, so light it up on all of them.
    return [
      '/more', '/customers', '/machines', '/income', '/expenses', '/loans',
      '/settlements', '/categories', '/profile',
    ].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

/**
 * Wraps every signed-in screen: a ruled title bar, the scrolling page body,
 * and a bottom tab bar whose centre action is stamped in red ink.
 */
export function AppShell({ title, subtitle, back, action, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size={24} className="muted-2" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--rule-strong)] bg-[var(--paper)]/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2.5 px-4">
          {back && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="-ml-1.5 flex size-9 items-center justify-center active:bg-[var(--paper-2)]"
            >
              <IconBack size={19} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-[16px] font-bold leading-tight">{title}</h1>
            {subtitle && <p className="ref truncate text-[10.5px] muted-2">{subtitle}</p>}
          </div>
          {action}
          {!back && !action && (
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]"
            >
              <IconUser size={18} />
            </Link>
          )}
        </div>
      </header>

      {/* pb clears the fixed tab bar plus the iOS home indicator. */}
      <main className="mx-auto max-w-xl px-4 pb-[calc(5.5rem+var(--safe-bottom))] pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule-strong)] bg-[var(--paper)] pb-[var(--safe-bottom)]">
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-2">
          {TABS.map(({ href, label, icon: Icon, stamp }) => {
            const active = isActive(pathname, href);

            if (stamp) {
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label="New entry"
                  className="flex w-16 flex-col items-center gap-1 pt-2"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md shadow-brand-500/30 transition-transform active:scale-95">
                    <Icon size={22} />
                  </span>
                  <span className="colhead">{label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex w-16 flex-col items-center gap-1 pb-2 pt-2.5 transition-colors',
                  active ? 'text-brand-500' : 'muted-2'
                )}
              >
                <span
                  className={cx(
                    'h-0.5 w-7 rounded-full transition-colors',
                    active ? 'bg-brand-500' : 'bg-transparent'
                  )}
                />
                <Icon size={20} />
                <span className="colhead">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
