'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { Empty, SectionTitle } from '@/components/ui';
import { IconCheck } from '@/components/Icons';
import { VendorSettlement, useVendorLedger } from '@/components/VendorSettlement';
import { Pager, usePaged } from '@/components/Pager';
import { DateRangeFilter, inDateRange } from '@/components/DateRangeFilter';
import { money } from '@/lib/format';

/**
 * One machine's card company as a ledger: what it owes on pending swipes,
 * the balance carried from past settlements, a form to mark the next payment,
 * and every settlement so far.
 */
export default function VendorLedgerPage() {
  const { id } = useParams();
  const ledger = useVendorLedger(id);
  const { data } = ledger;
  const [range, setRange] = useState({ from: '', to: '' });
  const filtered = Boolean(range.from || range.to);
  const shown = data?.pending.filter((t) => inDateRange(t.txnDate, range.from, range.to));
  const paged = usePaged(shown, 20, [range.from, range.to]);

  return (
    <AppShell
      title={data?.machine.name || 'Vendor'}
      subtitle={data ? data.machine.cardCompany || 'Vendor ledger' : 'Loading…'}
      back
    >
      <div className="space-y-5 rise">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />

        <VendorSettlement machineId={id} ledger={ledger} range={range} />

        {data && (
          <section>
            <SectionTitle>
              {shown.length} pending {shown.length === 1 ? 'entry' : 'entries'}
              {filtered ? ` in these dates · ${money(shown.reduce((a, t) => a + t.supplierAccount, 0))}` : ''}
            </SectionTitle>
            {shown.length ? (
              <div className="space-y-2">
                {paged.pageItems.map((t) => (
                  <TransactionCard key={t._id} txn={t} />
                ))}
                <Pager className="pt-2" page={paged.page} pages={paged.pages} total={paged.total} onChange={paged.setPage} />
              </div>
            ) : (
              <Empty
                icon={IconCheck}
                title={filtered ? 'Nothing pending in these dates' : 'Nothing pending'}
                hint={filtered ? 'Clear the date filter to see every pending swipe.' : 'Every swipe on this machine has been settled.'}
              />
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
