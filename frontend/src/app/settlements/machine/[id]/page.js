'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { Empty, SectionTitle } from '@/components/ui';
import { IconCheck } from '@/components/Icons';
import { VendorSettlement, useVendorLedger } from '@/components/VendorSettlement';
import { Pager, usePaged } from '@/components/Pager';

/**
 * One machine's card company as a ledger: what it owes on pending swipes,
 * the balance carried from past settlements, a form to mark the next payment,
 * and every settlement so far.
 */
export default function VendorLedgerPage() {
  const { id } = useParams();
  const ledger = useVendorLedger(id);
  const { data } = ledger;
  const paged = usePaged(data?.pending, 20);

  return (
    <AppShell
      title={data?.machine.name || 'Vendor'}
      subtitle={data ? data.machine.cardCompany || 'Vendor ledger' : 'Loading…'}
      back
    >
      <div className="space-y-5 rise">
        <VendorSettlement machineId={id} ledger={ledger} />

        {data && (
          <section>
            <SectionTitle>
              {data.pending.length} pending {data.pending.length === 1 ? 'entry' : 'entries'}
            </SectionTitle>
            {data.pending.length ? (
              <div className="space-y-2">
                {paged.pageItems.map((t) => (
                  <TransactionCard key={t._id} txn={t} />
                ))}
                <Pager className="pt-2" page={paged.page} pages={paged.pages} total={paged.total} onChange={paged.setPage} />
              </div>
            ) : (
              <Empty icon={IconCheck} title="Nothing pending" hint="Every swipe on this machine has been settled." />
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
