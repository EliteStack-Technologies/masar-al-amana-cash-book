'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateTime,moneyShort } from '@/lib/format';

import {
  Button, Card, ErrorNote, Row, SectionTitle, Skeleton, SplitRail, StatusPill, cx,
} from '@/components/ui';
import { IconCheck, IconClock, IconEdit, IconTrash } from '@/components/Icons';

export default function TransactionDetailPage({ params }) {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense
      fallback={
        <AppShell title="Entry" back>
          <Skeleton className="h-[200px]" />
        </AppShell>
      }
    >
      <TransactionDetail params={params} />
    </Suspense>
  );
}

function TransactionDetail({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const justCreated = useSearchParams().get('created') === '1';

  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api(`/transactions/${id}`)
      .then((d) => setTxn(d.transaction))
      .catch((err) => setError(err.message));
  }, [id]);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' });
      router.replace('/transactions');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (error && !txn) {
    return (
      <AppShell title="Entry" back>
        <ErrorNote>{error}</ErrorNote>
      </AppShell>
    );
  }

  if (!txn) {
    return (
      <AppShell title="Entry" back>
        <div className="space-y-3">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </AppShell>
    );
  }

  const received = txn.settlementStatus === 'received';

  return (
    <AppShell
      title={txn.txnNumber}
      subtitle={dateTime(txn.txnDate)}
      back
      action={
        <Link
          href={`/transactions/${id}/edit`}
          aria-label="Edit entry"
          className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]"
        >
          <IconEdit size={18} />
        </Link>
      }
    >
      <div className="space-y-5 rise">
        {justCreated && (
          <p className="stamp-mark text-leaf-500 dark:text-leaf-400">
            <IconCheck size={12} /> Entry recorded
          </p>
        )}

        {/* The whole entry in one figure and one rail: the card amount
            dividing into cash, the owner's share and the card company's. */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <span className="colhead">Card was swiped for</span>
            <span className="sum text-[28px] leading-none">{money(txn.cardAmount)}</span>
          </div>
          <div className="border-t border-[var(--rule)] pt-3">
            <SplitRail
              segments={[
                { label: 'Customer', value: txn.customerReceived, tone: 'ink' },
                { label: 'Yours', value: txn.ownerCommission, tone: 'leaf' },
                { label: 'Card co.', value: txn.companyCommission, tone: 'quiet' },
              ]}
              caption={
                txn.commissionType === 'included'
                  ? `Commission came out of the ${moneyShort(txn.requestedAmount)} the customer asked for.`
                  : `The customer kept the full ${moneyShort(txn.requestedAmount)}; commission was added on top.`
              }
            />
          </div>
        </Card>

        <section>
          <SectionTitle>Settlement</SectionTitle>
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <StatusPill status={txn.settlementStatus} />
              <span className="sum text-[18px]">{money(txn.settlementAmount)}</span>
            </div>
            <p className="mt-2 text-[12.5px] muted">
              {received
                ? `Came in on ${dateTime(txn.receivedAt)}.`
                : 'Still to come in from the card company.'}
              {' '}
              <span className="muted-2">
                = cash {money(txn.customerReceived)} + your share {money(txn.ownerCommission)}
              </span>
            </p>
            {received && txn.settlementNote ? (
              <p className="mt-1 text-[12.5px] muted-2">Note: {txn.settlementNote}</p>
            ) : null}
            <Link
              href={`/reports/daily?date=${new Date(txn.txnDate).toLocaleDateString('en-CA')}`}
              className="mt-3.5 block"
            >
              <Button type="button" variant="soft" className="w-full">
                <IconClock size={16} /> Settle this day in the Daily Report
              </Button>
            </Link>
          </Card>
        </section>

        <section>
          <SectionTitle>Working</SectionTitle>
          <Card className="ruled py-0">
            <Row label="Customer asked for" value={txn.requestedAmount} />
            <Row
              label="Commission"
              sub={`${txn.commissionPercent}% · ${txn.commissionType}`}
              value={txn.commissionAmount}
            />
            <Row
              label="Your share"
              sub={`${txn.ownerSharePercent}% of commission`}
              value={txn.ownerCommission}
              tone="leaf"
            />
            <Row
              label="Card company's share"
              sub={`${100 - txn.ownerSharePercent}% of commission`}
              value={txn.companyCommission}
            />
            <Row label="Cash you gave out" value={txn.customerReceived} strong />
            <Row label="Card transaction" value={txn.cardAmount} strong />
          </Card>
        </section>

        <section>
          <SectionTitle>Record</SectionTitle>
          <Card className="ruled py-0">
            <Detail label="Machine" value={txn.machine?.name || 'Not recorded'} />
            <Detail label="Customer" value={txn.customerName || 'Walk-in'} />
            <Detail label="Mobile" value={txn.customerMobile || '—'} mono />
            <Detail label="Card reference" value={txn.cardRefNumber || 'Not recorded'} mono />
            <Detail label="Entered by" value={txn.createdBy?.name || 'Unknown'} />
            <Detail label="Entered on" value={dateTime(txn.createdAt)} mono />
            {txn.notes && <Detail label="Notes" value={txn.notes} wrap />}
          </Card>
        </section>

        <ErrorNote>{error}</ErrorNote>

        <section className="pb-2">
          {confirmDelete ? (
            <Card className="space-y-3">
              <p className="text-[13.5px] leading-snug">
                Deleting <span className="ref">{txn.txnNumber}</span> removes it from the book for
                good. Its figures drop out of every report.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep the entry
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  loading={busy}
                  onClick={remove}
                >
                  Delete entry
                </Button>
              </div>
            </Card>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-stamp-500 dark:text-stamp-400"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash size={16} /> Delete this entry
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Detail({ label, value, mono, wrap }) {
  return (
    <div className={cx('gap-4 px-4 py-2.5', wrap ? 'block' : 'flex items-baseline justify-between')}>
      <span className="colhead shrink-0">{label}</span>
      <span
        className={cx(
          'text-[13.5px]',
          mono ? 'ref' : 'font-medium',
          wrap ? 'mt-1 block leading-snug' : 'truncate text-right'
        )}
      >
        {value}
      </span>
    </div>
  );
}
