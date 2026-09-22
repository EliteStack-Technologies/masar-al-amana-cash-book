'use client';

import Link from 'next/link';
import { money, dateTime } from '@/lib/format';
import { StatusPill, SplitRail, cx } from '@/components/ui';
import { IconCheck } from '@/components/Icons';

/**
 * One entry in the book. The miniature rail shows the same division as the
 * detail screen: the card amount splitting into cash, the owner's share and
 * the card company's share.
 */
export function TransactionCard({ txn, selectable, selected, onToggle }) {
  const body = (
    <div
      className={cx(
        'card p-3.5 transition-colors',
        selected ? 'border-stamp-500' : 'active:bg-[var(--paper-2)]'
      )}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <span
            className={cx(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors',
              selected
                ? 'border-stamp-500 bg-stamp-500 text-ink-50'
                : 'border-[var(--rule-strong)]'
            )}
          >
            {selected && <IconCheck size={13} strokeWidth={3} />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-semibold">
              {txn.customerName || txn.customerMobile}
            </p>
            <p className="sum shrink-0 text-[16px]">{money(txn.cardAmount)}</p>
          </div>

          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <p className="ref truncate text-[10.5px] muted-2">
              {txn.txnNumber} · {dateTime(txn.txnDate)}
            </p>
            <StatusPill status={txn.settlementStatus} />
          </div>

          <div className="mt-2.5">
            <SplitRail
              size="sm"
              animate={false}
              segments={[
                { label: 'Cash', value: txn.customerReceived, tone: 'ink' },
                { label: 'Mine', value: txn.ownerCommission, tone: 'leaf' },
                { label: 'Card co.', value: txn.companyCommission, tone: 'quiet' },
              ]}
            />
            <div className="mt-1.5 flex justify-between">
              <span className="colhead">
                cash <span className="sum text-[11px] !font-semibold">{money(txn.customerReceived)}</span>
              </span>
              <span className="colhead">
                mine{' '}
                <span className="sum text-[11px] !font-semibold text-leaf-500 dark:text-leaf-400">
                  {money(txn.ownerCommission)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onToggle(txn._id)}
        aria-pressed={selected}
        className="block w-full text-left"
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={`/transactions/${txn._id}`} className="block">
      {body}
    </Link>
  );
}
