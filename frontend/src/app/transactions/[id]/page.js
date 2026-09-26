'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateTime, moneyShort } from '@/lib/format';

import {
  Button, Card, ErrorNote, Field, Row, SectionTitle, Skeleton, SplitRail, StatusPill, cx,
} from '@/components/ui';
import { IconCheck, IconClock, IconEdit, IconTrash } from '@/components/Icons';

import { Amt } from '@/components/Amount';
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
  const [settling, setSettling] = useState(false);
  const [paid, setPaid] = useState('');

  useEffect(() => {
    api(`/transactions/${id}`)
      .then((d) => setTxn(d.transaction))
      .catch((err) => setError(err.message));
  }, [id]);

  /** Mark the money in, or put it back to pending. */
  const settle = async (status) => {
    setBusy(true);
    setError('');
    try {
      const d = await api(`/transactions/${id}/settlement`, {
        method: 'PATCH',
        body: {
          status,
          ...(status === 'received' && paid !== '' ? { settlementAmount: Number(paid) } : {}),
        },
      });
      // Keep the populated machine/customer the list endpoint gave us.
      setTxn((t) => ({ ...t, ...d.transaction, machine: t.machine, customer: t.customer }));
      setSettling(false);
      setPaid('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

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

        {/* The whole swipe in one figure and one rail: what the machine took,
            dividing into the customer's cash, the margin and the supplier's fee. */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <span className="colhead">Card was swiped for</span>
            <span className="sum text-[28px] leading-none"><Amt value={txn.swipedAmount} /></span>
          </div>
          <div className="border-t border-[var(--rule)] pt-3">
            <SplitRail
              segments={[
                { label: 'Customer', value: txn.givenAmount, tone: 'ink' },
                { label: 'Margin', value: txn.margin, tone: 'leaf' },
                { label: 'Supplier', value: txn.supplierFee, tone: 'quiet' },
              ]}
              caption={`Charged ${moneyShort(txn.chargeToCustomer)} on a ${moneyShort(txn.swipedAmount)} swipe (${txn.custPercent}%).`}
            />
          </div>
        </Card>

        <section>
          <SectionTitle>Settlement</SectionTitle>
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <StatusPill status={txn.settlementStatus} />
              <span className="sum text-[18px]">
                <Amt value={received ? txn.settlementAmount : txn.supplierAccount} />
              </span>
            </div>
            <p className="mt-2 text-[12.5px] muted">
              {received
                ? `Came in on ${dateTime(txn.receivedAt)}.`
                : 'Still to come in from the card company.'}{' '}
              <span className="muted-2">
                Expected <Amt value={txn.supplierAccount} /> = the swipe less the {txn.supplierPercent}% fee.
              </span>
            </p>
            {received ? (
              <p className="mt-1 text-[12.5px]">
                Profit <span className="sum text-leaf-600 dark:text-leaf-400"><Amt value={txn.profit} /></span>
                <span className="muted-2"> = settlement less the <Amt value={txn.givenAmount} /> cash</span>
              </p>
            ) : null}
            {received && txn.settlementNote ? (
              <p className="mt-1 text-[12.5px] muted-2">Note: {txn.settlementNote}</p>
            ) : null}

            {received ? (
              <Button
                type="button"
                variant="soft"
                className="mt-3.5 w-full"
                loading={busy}
                onClick={() => settle('pending')}
              >
                Move back to pending
              </Button>
            ) : settling ? (
              <div className="mt-3.5 space-y-3 border-t border-[var(--rule)] pt-3">
                <Field
                  label="Amount the company actually paid"
                  hint="Leave it blank unless the bank rounded it"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[11px] muted-2">
                      AED
                    </span>
                    <input
                      className="field sum pl-12"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={paid}
                      placeholder={String(txn.supplierAccount)}
                      onChange={(e) => setPaid(e.target.value)}
                    />
                  </div>
                </Field>
                <p className="text-[11.5px] muted-2">
                  Profit will be{' '}
                  <Amt value={(paid === '' ? txn.supplierAccount : Number(paid)) - txn.givenAmount} />.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="soft" className="flex-1" onClick={() => setSettling(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="stamp"
                    className="flex-1"
                    loading={busy}
                    onClick={() => settle('received')}
                  >
                    Mark received
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3.5 flex gap-2">
                <Button type="button" variant="stamp" className="flex-1" onClick={() => setSettling(true)}>
                  <IconCheck size={16} /> Money received
                </Button>
                <Link
                  href={`/reports/daily?date=${new Date(txn.txnDate).toLocaleDateString('en-CA')}`}
                  className="flex-1"
                >
                  <Button type="button" variant="soft" className="w-full">
                    <IconClock size={16} /> Whole day
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>Working</SectionTitle>
          <Card className="ruled py-0">
            <Row label="Swiped" value={txn.swipedAmount} strong />
            <Row label="Cash you gave out" value={txn.givenAmount} strong />
            <Row
              label="Charge to customer"
              sub={
                txn.commissionType === 'excluded'
                  ? `${txn.custPercent}% on top of the cash`
                  : `${txn.custPercent}% of the swipe`
              }
              value={txn.chargeToCustomer}
            />
            <Row
              label="Supplier fee"
              sub={`${txn.supplierPercent}% to ${txn.machine?.cardCompany || 'the card company'}`}
              value={txn.supplierFee}
              tone="stamp"
            />
            <Row label="Margin" sub="Charge less the supplier fee" value={txn.margin} tone="leaf" />
            <Row label="Supplier A/C" sub="Expected settlement" value={txn.supplierAccount} />
            {received ? (
              <Row label="Profit" sub="Settlement less the cash" value={txn.profit} tone="leaf" strong />
            ) : null}
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
