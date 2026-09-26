'use client';

import Link from 'next/link';
import { money, dateTime } from '@/lib/format';
import { StatusPill, SplitRail, cx } from '@/components/ui';
import { IconCheck } from '@/components/Icons';

import { Amt } from '@/components/Amount';
/**
 * One swipe in the book. The miniature rail shows where the swipe went: the
 * cash handed over, the shop's margin and the supplier's fee.
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
            <p className="sum shrink-0 text-[16px]"><Amt value={txn.swipedAmount} /></p>
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
                { label: 'Cash', value: txn.givenAmount, tone: 'ink' },
                { label: 'Margin', value: txn.margin, tone: 'leaf' },
                { label: 'Supplier', value: txn.supplierFee, tone: 'quiet' },
              ]}
            />
            <div className="mt-1.5 flex justify-between">
              <span className="colhead">
                cash <span className="sum text-[11px] !font-semibold"><Amt value={txn.givenAmount} /></span>
              </span>
              <span className="colhead">
                {txn.profit == null ? 'margin' : 'profit'}{' '}
                <span className="sum text-[11px] !font-semibold text-leaf-500 dark:text-leaf-400">
                  <Amt value={txn.profit == null ? txn.margin : txn.profit} />
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
