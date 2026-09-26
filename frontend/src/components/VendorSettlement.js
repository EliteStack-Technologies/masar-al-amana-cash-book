'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { money, dateOnly, dateTime, todayInput, toLocalInput, round2, balanceText } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Figure, Row, SectionTitle, Skeleton, cx } from '@/components/ui';
import { IconCheck, IconClock } from '@/components/Icons';
import { Pager, usePaged } from '@/components/Pager';
import { inDateRange } from '@/components/DateRangeFilter';

import { Amt } from '@/components/Amount';
/** Green when the card company has paid extra, red when it has paid short. */
const balanceTone = (b) =>
  b > 0 ? 'text-leaf-500 dark:text-leaf-400' : b < 0 ? 'text-stamp-500 dark:text-stamp-400' : 'muted-2';

const signed = (n) => (n > 0 ? `+${money(n)}` : n < 0 ? `-${money(-n)}` : money(0));

/** Loads one machine's vendor ledger: pending swipes, balance, settlements. */
export function useVendorLedger(machineId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setError('');
    return api(`/settlements/vendors/${machineId}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [machineId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}

/**
 * Everything to settle with one machine's card company: what is due and the
 * carried balance, the form to mark a payment, and the ledger of past
 * settlements. `onChange` runs after a settlement is marked or undone, so the
 * page around it can refresh what it shows.
 *
 * `collapsible` keeps the form and ledger behind buttons, for pages where
 * settling is one thing among others (the machine report).
 *
 * `range` ({ from, to } days) narrows the ledger to settlements received in
 * those dates; balances stay the running totals.
 */
export function VendorSettlement({ machineId, ledger, onChange, collapsible = false, range }) {
  const { data, error, reload } = ledger;
  const [formOpen, setFormOpen] = useState(!collapsible);
  const [ledgerOpen, setLedgerOpen] = useState(!collapsible);
  const [actionError, setActionError] = useState('');
  const from = range?.from || '';
  const to = range?.to || '';
  const filtered = Boolean(from || to);
  const ledgerRows = data?.ledger.filter((b) => inDateRange(b.receivedAt, from, to));
  const ledgerPage = usePaged(ledgerRows, 10, [from, to]);

  const changed = async () => {
    await reload();
    onChange?.();
  };

  const revert = async (batchId) => {
    if (!confirm('Undo this settlement? Its entries go back to pending.')) return;
    setActionError('');
    try {
      await api(`/settlements/day/${batchId}`, { method: 'DELETE' });
      await changed();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (!data && !error) return <Skeleton className="h-[120px]" />;
  if (!data) return <ErrorNote>{error}</ErrorNote>;

  const hasPending = data.pending.length > 0;

  return (
    <div className="space-y-5">
      <section>
        {collapsible && <SectionTitle>Settlement with the card company</SectionTitle>}
        <Card className="p-0">
          <div className="grid grid-cols-2">
            <div className="border-r border-[var(--rule)] p-3.5">
              <Figure
                label="Due on pending"
                amount={data.pendingAmount}
                tone="stamp"
                size="lg"
                sub={`${data.pending.length} ${data.pending.length === 1 ? 'entry' : 'entries'}`}
              />
            </div>
            <div className="p-3.5">
              <p className="colhead">Ledger balance</p>
              <p className={cx('sum mt-1 text-[22px] leading-none', balanceTone(data.balance))}>
                {signed(data.balance)}
              </p>
              <p className="mt-1 text-[11.5px] muted-2">{balanceText(data.balance)}</p>
            </div>
          </div>

          {collapsible && (
            <div className="flex gap-2 border-t border-[var(--rule)] p-3">
              {hasPending && (
                <Button
                  type="button"
                  variant={formOpen ? 'soft' : 'stamp'}
                  className="flex-1 !min-h-10"
                  onClick={() => setFormOpen((v) => !v)}
                >
                  {formOpen ? 'Close' : (<><IconCheck size={16} /> Mark settlement</>)}
                </Button>
              )}
              <Button
                type="button"
                variant="soft"
                className="flex-1 !min-h-10"
                onClick={() => setLedgerOpen((v) => !v)}
              >
                {ledgerOpen ? 'Hide ledger' : `Ledger (${data.ledger.length})`}
              </Button>
            </div>
          )}
        </Card>
      </section>

      <ErrorNote>{actionError}</ErrorNote>

      {hasPending && formOpen && (
        <SettleForm
          machineId={machineId}
          pending={data.pending}
          balance={data.balance}
          onDone={async () => {
            if (collapsible) setFormOpen(false);
            await changed();
          }}
        />
      )}

      {ledgerOpen && (
        <section>
          <SectionTitle>
            {filtered
              ? `Ledger · ${ledgerRows.length} received in these dates · ${money(ledgerRows.reduce((a, b) => a + b.receivedAmount, 0))}`
              : 'Ledger'}
          </SectionTitle>
          {ledgerRows.length ? (
            <div className="space-y-3">
              <Card className="ruled py-0">
                {ledgerPage.pageItems.map((b) => (
                  <LedgerLine key={b._id} b={b} onRevert={() => revert(b._id)} />
                ))}
              </Card>
              <Pager
                page={ledgerPage.page}
                pages={ledgerPage.pages}
                total={ledgerPage.total}
                noun="settlements"
                onChange={ledgerPage.setPage}
              />
            </div>
          ) : (
            <p className="text-[13px] muted">
              {filtered ? 'No settlements received in these dates.' : 'No settlements recorded for this machine yet.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Mark the company's payment. Picks up every pending swipe up to a day, shows
 * what is due and what the carried balance makes of it, and previews the
 * difference that will go on the ledger.
 */
function SettleForm({ machineId, pending, balance, onDone }) {
  const [upTo, setUpTo] = useState(todayInput);
  const [received, setReceived] = useState('');
  const [receivedAt, setReceivedAt] = useState(toLocalInput);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The swipes this payment covers: pending, on or before the chosen day.
  const covered = useMemo(() => {
    const end = new Date(`${upTo}T23:59:59.999`);
    return pending.filter((t) => new Date(t.txnDate) <= end);
  }, [pending, upTo]);
  const due = round2(covered.reduce((a, t) => a + t.supplierAccount, 0));
  // A credit from an earlier over-payment lowers what to expect; a shortfall raises it.
  const expected = round2(Math.max(0, due - balance));
  const paid = received === '' ? null : Number(received);
  const difference = paid === null ? null : round2(paid - due);
  const after = difference === null ? null : round2(balance + difference);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!covered.length) return setError('No pending entries up to that day.');
    if (paid === null || !(paid >= 0)) return setError('Enter the amount the company paid.');
    setBusy(true);
    try {
      await api(`/settlements/vendors/${machineId}`, {
        method: 'POST',
        body: { upTo, receivedAmount: paid, receivedAt: new Date(receivedAt).toISOString(), note: note.trim() },
      });
      setReceived('');
      setNote('');
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>Mark settlement</SectionTitle>
      <Card className="space-y-3.5">
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Entries up to" hint={`${covered.length} pending ${covered.length === 1 ? 'entry' : 'entries'} on or before this day`}>
            <input className="field ref" type="date" value={upTo} onChange={(e) => setUpTo(e.target.value)} required />
          </Field>

          <div className="ruled border-y border-[var(--rule)]">
            <Row label="Due for these entries" value={due} />
            <Row label="Carried balance" sub={balanceText(balance)} value={balance} />
            <Row label="Expected payment" sub="Due less any extra already paid" value={expected} strong />
          </div>

          <Field label="Amount the company paid">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
              <input
                className="field sum pl-14 text-[20px]"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder={expected.toFixed(2)}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                required
              />
            </div>
          </Field>

          {difference !== null && (
            <div className="flex items-baseline justify-between gap-3 rounded-xl border border-[var(--rule-strong)] px-3 py-2.5">
              <div>
                <p className="colhead">This settlement</p>
                <p className={cx('sum mt-0.5 text-[16px]', balanceTone(difference))}>
                  {difference === 0 ? 'Exact' : signed(difference)}
                </p>
              </div>
              <div className="text-right">
                <p className="colhead">Balance after</p>
                <p className={cx('sum mt-0.5 text-[16px]', balanceTone(after))}>{signed(after)}</p>
              </div>
            </div>
          )}

          <Field label="Received on">
            <input className="field" type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
          </Field>
          <Field label="Note" hint="Optional — e.g. bank reference">
            <input className="field" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" variant="stamp" className="w-full" loading={busy} disabled={!covered.length}>
            <IconCheck size={16} /> Mark {covered.length} {covered.length === 1 ? 'entry' : 'entries'} received
          </Button>
        </form>
      </Card>
    </section>
  );
}

/** One settlement on the ledger, with the balance it left behind. */
function LedgerLine({ b, onRevert }) {
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="sum text-[15px]">
            <Amt value={b.receivedAmount} /> <span className="text-[11px] !font-normal muted-2">paid</span>
          </p>
          <p className="ref mt-0.5 text-[10.5px] muted-2">
            {dateTime(b.receivedAt)} · {b.txnCount} {b.txnCount === 1 ? 'entry' : 'entries'} up to {dateOnly(`${b.settleDate}T12:00:00`)}
          </p>
          {b.note ? <p className="mt-0.5 text-[12px] muted">{b.note}</p> : null}
        </div>
        <button type="button" onClick={onRevert} className="colhead flex shrink-0 items-center gap-1 !text-stamp-500">
          <IconClock size={13} /> Undo
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <p className="colhead">Due</p>
          <p className="sum mt-0.5"><Amt value={b.expectedAmount} /></p>
        </div>
        <div>
          <p className="colhead">Difference</p>
          <p className={cx('sum mt-0.5', balanceTone(b.difference))}>{b.difference ? signed(b.difference) : 'Exact'}</p>
        </div>
        <div className="text-right">
          <p className="colhead">Balance</p>
          <p className={cx('sum mt-0.5', balanceTone(b.balance))}>{signed(b.balance)}</p>
        </div>
      </div>
    </div>
  );
}
