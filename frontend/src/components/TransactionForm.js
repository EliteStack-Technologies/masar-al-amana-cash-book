'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { money, moneyShort, preview, counterFor, rateFor, toLocalInput } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Row, SectionTitle, Skeleton, cx } from '@/components/ui';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

/**
 * The form works in one typed `amount` plus the mode that says which end of
 * the deal it is, and one derived `counter` amount the owner can round by
 * hand. Which of swiped/given each one is depends on the mode.
 */
const amountOf = (form) =>
  form.commissionType === 'excluded'
    ? { swipedAmount: form.counter, givenAmount: form.amount }
    : { swipedAmount: form.amount, givenAmount: form.counter };

/** Blank form values, optionally seeded from the owner's saved defaults. */
export const emptyTransaction = (user) => ({
  machine: '',
  customer: '',
  customerName: '',
  customerMobile: '',
  amount: '',
  counter: '',
  commissionType: 'included',
  custPercent: String(user?.defaultCommissionPercent ?? 3),
  cardRefNumber: '',
  notes: '',
  txnDate: toLocalInput(),
});

/** Maps a saved transaction back onto form values. */
export const toFormValues = (t) => {
  const excluded = t.commissionType === 'excluded';
  return {
    machine: t.machine?._id || t.machine || '',
    customer: t.customer?._id || t.customer || '',
    customerName: t.customerName || '',
    customerMobile: t.customerMobile || '',
    amount: String((excluded ? t.givenAmount : t.swipedAmount) ?? ''),
    counter: String((excluded ? t.swipedAmount : t.givenAmount) ?? ''),
    commissionType: excluded ? 'excluded' : 'included',
    custPercent: String(t.custPercent ?? ''),
    cardRefNumber: t.cardRefNumber || '',
    notes: t.notes || '',
    txnDate: toLocalInput(t.txnDate),
  };
};

/**
 * Shared by the New and Edit screens. `onSubmit` receives the payload already
 * coerced to numbers and an ISO date.
 *
 * The swipe is the anchor. Typing a rate works out the cash; correcting the
 * cash works the rate back out - whichever was touched last is the truth, the
 * same rule the server follows.
 */
export function TransactionForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [machines, setMachines] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    Promise.all([api('/machines?status=active'), api('/customers?status=active&limit=200')])
      .then(([m, c]) => {
        setMachines(m.items);
        setCustomers(c.items);
        // Default-select the first machine when none is chosen yet.
        setForm((f) => (f.machine || !m.items.length ? f : { ...f, machine: m.items[0]._id }));
      })
      .catch((err) => setError(err.message));
  }, []);

  const machine = machines?.find((m) => m._id === form.machine) || null;
  const supplierPercent = machine?.supplierPercent || 0;

  const excluded = form.commissionType === 'excluded';

  const pickCustomer = (e) => {
    const id = e.target.value;
    const cust = customers?.find((c) => c._id === id);
    setForm((f) => {
      const custPercent = cust ? String(cust.commissionPercent) : f.custPercent;
      return {
        ...f,
        customer: id,
        customerName: cust ? cust.name : f.customerName,
        customerMobile: cust ? cust.mobile : f.customerMobile,
        custPercent,
        counter: f.amount
          ? String(counterFor(Number(f.amount), custPercent, f.commissionType))
          : f.counter,
      };
    });
  };

  // --- the typed amount, the rate and the derived figure stay in step ---
  const setAmount = (e) => {
    const amount = e.target.value;
    setForm((f) => ({
      ...f,
      amount,
      counter: amount ? String(counterFor(Number(amount), f.custPercent, f.commissionType)) : '',
    }));
  };

  const setPercent = (e) => {
    const custPercent = e.target.value;
    setForm((f) => ({
      ...f,
      custPercent,
      counter: f.amount
        ? String(counterFor(Number(f.amount), custPercent, f.commissionType))
        : f.counter,
    }));
  };

  /** Rounding the derived figure by hand re-reads the rate from it. */
  const setCounter = (e) => {
    const counter = e.target.value;
    setForm((f) => ({
      ...f,
      counter,
      custPercent:
        f.amount && counter !== ''
          ? String(rateFor(Number(f.amount), Number(counter), f.commissionType))
          : f.custPercent,
    }));
  };

  /** Switching the mode keeps the amount and rate, and re-derives the rest. */
  const setMode = (commissionType) =>
    setForm((f) => ({
      ...f,
      commissionType,
      counter: f.amount ? String(counterFor(Number(f.amount), f.custPercent, commissionType)) : '',
    }));

  const calc = useMemo(() => {
    const { swipedAmount, givenAmount } = amountOf(form);
    return preview({
      swipedAmount: swipedAmount === '' ? undefined : Number(swipedAmount),
      givenAmount: givenAmount === '' ? undefined : Number(givenAmount),
      custPercent: Number(form.custPercent) || 0,
      commissionType: form.commissionType,
      supplierPercent,
    });
  }, [form, supplierPercent]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.machine) return setError('Choose a card machine.');
    if (!(Number(form.amount) > 0)) {
      return setError(
        excluded
          ? 'Enter the cash to hand over, greater than 0.'
          : 'Enter a swiped amount greater than 0.'
      );
    }
    if (calc.givenAmount > calc.swipedAmount) {
      return setError('The cash given cannot be more than the amount swiped.');
    }

    setBusy(true);
    try {
      await onSubmit({
        machine: form.machine,
        customer: form.customer || null,
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        // Both amounts are sent, so the server stores exactly what is on
        // screen; the mode records which end was typed.
        swipedAmount: calc.swipedAmount,
        givenAmount: calc.givenAmount,
        custPercent: Number(form.custPercent),
        commissionType: form.commissionType,
        cardRefNumber: form.cardRefNumber,
        notes: form.notes,
        txnDate: new Date(form.txnDate).toISOString(),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!machines || !customers) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (!machines.length) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-[15px] font-semibold">Add a card machine first</p>
        <p className="text-[13px] muted">You need at least one card machine before recording a swipe.</p>
        <Link href="/machines/new"><Button variant="stamp" className="w-full">Add machine</Button></Link>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Card machine</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {machines.map((m, i) => (
            <MachineCard
              key={m._id}
              machine={m}
              index={i}
              active={form.machine === m._id}
              onClick={() => setForm((f) => ({ ...f, machine: m._id }))}
            />
          ))}
        </div>
        {machine && !machine.supplierPercent ? (
          <p className="mt-2 text-[11.5px] leading-snug text-stamp-600">
            {machine.name} has no supplier % set.{' '}
            <Link href={`/machines/${machine._id}/edit`} className="font-semibold underline">Set it</Link>{' '}
            so the fee and margin come out right.
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle
          action={<Link href="/customers/new" className="text-[12px] font-semibold text-brand-500">+ New</Link>}
        >
          Customer · optional
        </SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Pick a saved customer" hint="Fills the name and the rate you usually charge">
            <select className="field" value={form.customer} onChange={pickCustomer}>
              <option value="">Walk-in — no saved customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.mobile ? `${c.name} · ${c.mobile}` : c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" hint="Optional">
              <input
                className="field"
                type="text"
                placeholder="e.g. Rashid"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customer: '', customerName: e.target.value }))}
              />
            </Field>
            <Field label="Mobile" hint="Optional">
              <input
                className="field ref"
                type="tel"
                inputMode="numeric"
                placeholder="05x xxx xxxx"
                value={form.customerMobile}
                onChange={(e) => setForm((f) => ({ ...f, customer: '', customerMobile: e.target.value }))}
              />
            </Field>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Amount</SectionTitle>
        <Card className="space-y-3.5">
          <Field
            label={excluded ? 'Cash the customer asked for' : 'Amount on the card'}
            hint={excluded ? 'What they walk away with' : 'The full amount the machine takes'}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
              <input
                className="field sum pl-14 text-[22px]"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={setAmount}
                required
              />
            </div>
          </Field>

          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    amount: String(amt),
                    counter: String(counterFor(amt, f.custPercent, f.commissionType)),
                  }))
                }
                className="ref min-h-9 rounded-lg border border-[var(--rule-strong)] px-3 text-[12.5px] active:bg-[var(--paper-2)]"
              >
                {moneyShort(amt)}
              </button>
            ))}
          </div>

          {/* Which end of the deal the amount above is. */}
          <Field label="This amount">
            <div className="grid grid-cols-2 gap-2">
              <TypeCard
                active={!excluded}
                onClick={() => setMode('included')}
                title="Includes commission"
                detail="Charge comes out of it. The customer gets less."
              />
              <TypeCard
                active={excluded}
                onClick={() => setMode('excluded')}
                title="Plus commission"
                detail="Charge goes on top. The customer gets it all."
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Charge to customer %" hint="Your rate on this swipe">
              <input
                className="field ref"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                value={form.custPercent}
                onChange={setPercent}
                required
              />
            </Field>
            <Field
              label={excluded ? 'Swipe the card for' : 'Cash to hand over'}
              hint="Round it — the % follows"
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[11px] muted-2">AED</span>
                <input
                  className="field sum pl-12"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.counter}
                  onChange={setCounter}
                  required
                />
              </div>
            </Field>
          </div>
        </Card>
      </section>

      <Preview calc={calc} machine={machine} />

      <section>
        <SectionTitle>Card and notes</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Card reference number" hint="Optional — from the card machine">
            <input
              className="field ref"
              type="text"
              autoCapitalize="characters"
              placeholder="e.g. 4827391045"
              value={form.cardRefNumber}
              onChange={set('cardRefNumber')}
            />
          </Field>
          <Field label="Date & time">
            <input className="field" type="datetime-local" value={form.txnDate} onChange={set('txnDate')} required />
          </Field>
          <Field label="Notes" hint="Optional">
            <textarea
              className="field resize-none"
              rows={2}
              placeholder="Anything to remember about this one"
              value={form.notes}
              onChange={set('notes')}
            />
          </Field>
        </Card>
      </section>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-3 pb-2">
        <Button type="button" variant="soft" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="stamp" className="flex-[2]" loading={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const CARD_TINTS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600',
];

/** A card machine drawn like a payment card; tap to select. */
function MachineCard({ machine, index, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'relative h-[80px] overflow-hidden rounded-2xl bg-linear-to-br p-3 text-left text-white transition-all',
        CARD_TINTS[index % CARD_TINTS.length],
        active ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[var(--paper)]' : 'opacity-90'
      )}
    >
      <span className="ref absolute right-3 top-2.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
        {machine.supplierPercent ? `${machine.supplierPercent}%` : 'no %'}
      </span>
      <div className="absolute inset-x-3 bottom-2.5">
        <p className="truncate text-[13.5px] font-bold leading-tight">{machine.name}</p>
        <p className="ref truncate text-[10px] text-white/80">{machine.cardCompany || machine.machineNumber}</p>
      </div>
    </button>
  );
}

/** One of the two ways the typed amount can be read. */
function TypeCard({ active, onClick, title, detail }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-xl border p-3 text-left transition-colors',
        active ? 'border-brand-500 bg-brand-50' : 'border-[var(--rule-strong)] bg-transparent'
      )}
    >
      <span className={cx('display block text-[14px] font-bold', active ? 'text-brand-600' : '')}>
        {title}
      </span>
      <span className="mt-0.5 block text-[11.5px] leading-snug muted">{detail}</span>
    </button>
  );
}

/**
 * The same columns the shop's own sheet works in: what the customer is
 * charged, what the supplier keeps, and what should land in the account.
 */
function Preview({ calc, machine }) {
  const empty = !calc.swipedAmount;
  const excluded = calc.commissionType === 'excluded';

  return (
    <section>
      <SectionTitle>Working</SectionTitle>
      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-3 pb-3">
          <span className="colhead">Cash to customer</span>
          <span className="sum text-[28px] leading-none">{money(calc.givenAmount)}</span>
        </div>

        {empty ? (
          <div className="border-t border-[var(--rule)] pt-3">
            <p className="text-[12.5px] muted-2">Enter an amount to see the working.</p>
          </div>
        ) : (
          <div className="ruled border-t border-[var(--rule)]">
            <Row label="Swiped on the card" value={calc.swipedAmount} strong />
            <Row
              label="Charge to customer"
              sub={
                excluded
                  ? `${calc.custPercent}% on top of the cash`
                  : `${calc.custPercent}% of the swipe`
              }
              value={calc.chargeToCustomer}
            />
            <Row
              label="Supplier fee"
              sub={`${calc.supplierPercent}% to ${machine?.cardCompany || machine?.name || 'the card company'}`}
              value={calc.supplierFee}
              tone="stamp"
            />
            <Row label="Margin" sub="Charge less the supplier fee" value={calc.margin} tone="leaf" strong />
            <Row label="Supplier A/C" sub="What should land in your account" value={calc.supplierAccount} />
          </div>
        )}
      </div>
    </section>
  );
}
