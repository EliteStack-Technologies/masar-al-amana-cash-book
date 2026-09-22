'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { money, preview, toLocalInput,moneyShort } from '@/lib/format';
import { Button, Card, ErrorNote, Field, SectionTitle, SplitRail, Skeleton, cx } from '@/components/ui';
import { IconCard } from '@/components/Icons';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

/** Blank form values, optionally seeded from the owner's saved defaults. */
export const emptyTransaction = (user) => ({
  machine: '',
  customer: '',
  customerName: '',
  customerMobile: '',
  requestedAmount: '',
  commissionPercent: String(user?.defaultCommissionPercent ?? 30),
  commissionType: 'included',
  ownerSharePercent: String(user?.defaultOwnerSharePercent ?? 50),
  cardRefNumber: '',
  notes: '',
  txnDate: toLocalInput(),
});

/** Maps a saved transaction back onto form values. */
export const toFormValues = (t) => ({
  machine: t.machine?._id || t.machine || '',
  customer: t.customer?._id || t.customer || '',
  customerName: t.customerName || '',
  customerMobile: t.customerMobile || '',
  requestedAmount: String(t.requestedAmount ?? ''),
  commissionPercent: String(t.commissionPercent ?? ''),
  commissionType: t.commissionType || 'included',
  ownerSharePercent: String(t.ownerSharePercent ?? 50),
  cardRefNumber: t.cardRefNumber || '',
  notes: t.notes || '',
  txnDate: toLocalInput(t.txnDate),
});

/**
 * Shared by the New and Edit screens. `onSubmit` receives the payload already
 * coerced to numbers and an ISO date.
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

  const pickCustomer = (e) => {
    const id = e.target.value;
    const cust = customers?.find((c) => c._id === id);
    setForm((f) => ({
      ...f,
      customer: id,
      customerName: cust ? cust.name : f.customerName,
      customerMobile: cust ? cust.mobile : f.customerMobile,
      commissionPercent: cust ? String(cust.commissionPercent) : f.commissionPercent,
      commissionType: cust ? cust.commissionType || f.commissionType : f.commissionType,
    }));
  };

  const calc = useMemo(
    () =>
      preview({
        requestedAmount: Number(form.requestedAmount) || 0,
        commissionPercent: Number(form.commissionPercent) || 0,
        commissionType: form.commissionType,
        ownerSharePercent: Number(form.ownerSharePercent) || 0,
      }),
    [form.requestedAmount, form.commissionPercent, form.commissionType, form.ownerSharePercent]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.machine) return setError('Choose a card machine.');
    if (!(Number(form.requestedAmount) > 0)) return setError('Enter a cash amount greater than 0.');

    setBusy(true);
    try {
      await onSubmit({
        machine: form.machine,
        customer: form.customer || null,
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        requestedAmount: Number(form.requestedAmount),
        commissionPercent: Number(form.commissionPercent),
        commissionType: form.commissionType,
        ownerSharePercent: Number(form.ownerSharePercent),
        cardRefNumber: form.cardRefNumber,
        notes: form.notes,
        txnDate: new Date(form.txnDate).toISOString(),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const included = form.commissionType === 'included';
  const requested = Number(form.requestedAmount) || 0;

  if (!machines || !customers) {
    return <div className="space-y-3"><Skeleton className="h-[120px]" /><Skeleton className="h-[200px]" /></div>;
  }

  if (!machines.length) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-[15px] font-semibold">Add a card machine first</p>
        <p className="text-[13px] muted">You need at least one card machine before recording an entry.</p>
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
      </section>

      <section>
        <SectionTitle
          action={<Link href="/customers/new" className="text-[12px] font-semibold text-brand-500">+ New</Link>}
        >
          Customer · optional
        </SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Pick a saved customer" hint="Fills the name, mobile and commission for you">
            <select className="field" value={form.customer} onChange={pickCustomer}>
              <option value="">Walk-in — no saved customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" hint="Optional">
              <input className="field" type="text" placeholder="e.g. Rahul" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customer: '', customerName: e.target.value }))} />
            </Field>
            <Field label="Mobile" hint="Optional">
              <input className="field ref" type="tel" inputMode="numeric" placeholder="98765 43210" value={form.customerMobile} onChange={(e) => setForm((f) => ({ ...f, customer: '', customerMobile: e.target.value }))} />
            </Field>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Amount and commission</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Cash the customer asked for">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
              <input className="field sum pl-14 text-[22px]" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={form.requestedAmount} onChange={set('requestedAmount')} required />
            </div>
          </Field>

          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button key={amt} type="button" onClick={() => setForm((f) => ({ ...f, requestedAmount: String(amt) }))} className="ref min-h-9 rounded-lg border border-[var(--rule-strong)] px-3 text-[12.5px] active:bg-[var(--paper-2)]">
                {moneyShort(amt)}
              </button>
            ))}
          </div>

          <Field label="Commission type">
            <div className="grid grid-cols-2 gap-2">
              <TypeCard active={included} onClick={() => setForm((f) => ({ ...f, commissionType: 'included' }))} title="Included" detail="Taken out of the cash. The customer gets less." />
              <TypeCard active={!included} onClick={() => setForm((f) => ({ ...f, commissionType: 'excluded' }))} title="Excluded" detail="Added to the swipe. The customer gets it all." />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission %">
              <input className="field ref" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={set('commissionPercent')} required />
            </Field>
            <Field label="My share %" hint={`Card co. gets ${100 - (Number(form.ownerSharePercent) || 0)}%`}>
              <input className="field ref" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={form.ownerSharePercent} onChange={set('ownerSharePercent')} required />
            </Field>
          </div>
        </Card>
      </section>

      <Preview calc={calc} included={included} requested={requested} />

      <section>
        <SectionTitle>Card and notes</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Card reference number" hint="Optional — from the card machine">
            <input className="field ref" type="text" autoCapitalize="characters" placeholder="e.g. 4827391045" value={form.cardRefNumber} onChange={set('cardRefNumber')} />
          </Field>
          <Field label="Date & time">
            <input className="field" type="datetime-local" value={form.txnDate} onChange={set('txnDate')} required />
          </Field>
          <Field label="Notes" hint="Optional">
            <textarea className="field resize-none" rows={2} placeholder="Anything to remember about this one" value={form.notes} onChange={set('notes')} />
          </Field>
        </Card>
      </section>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-3 pb-2">
        <Button type="button" variant="soft" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="stamp" className="flex-[2]" loading={busy}>{busy ? busyLabel : submitLabel}</Button>
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
        'relative h-[80px]  overflow-hidden rounded-2xl bg-linear-to-br p-3 text-left text-white transition-all',
        CARD_TINTS[index % CARD_TINTS.length],
        active ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[var(--paper)]' : 'opacity-90'
      )}
    >

   
      <div className="absolute inset-x-3 bottom-2.5">
        <p className="truncate text-[13.5px] font-bold leading-tight">{machine.name}</p>
        <p className="ref truncate text-[10px] text-white/80">{machine.cardCompany || machine.machineNumber}</p>
      </div>
    </button>
  );
}

function TypeCard({ active, onClick, title, detail }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('rounded-xl border p-3 text-left transition-colors', active ? 'border-brand-500 bg-brand-50' : 'border-[var(--rule-strong)] bg-transparent')}
    >
      <span className={cx('display block text-[14px] font-bold', active ? 'text-brand-600' : '')}>{title}</span>
      <span className="mt-0.5 block text-[11.5px] leading-snug muted">{detail}</span>
    </button>
  );
}

/**
 * The card amount dividing into the three places the money goes, plus the
 * figure that matters most: what the card company will actually pay you back.
 */
function Preview({ calc, included, requested }) {
  const empty = !requested;

  return (
    <section>
      <SectionTitle>The split</SectionTitle>
      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-3 pb-3">
          <span className="colhead">Card is swiped for</span>
          <span className="sum text-[28px] leading-none">{money(calc.cardAmount)}</span>
        </div>

        {empty ? (
          <div className="border-t border-[var(--rule)] pt-3">
            <p className="text-[12.5px] muted-2">Enter a cash amount to see the split.</p>
          </div>
        ) : (
          <div className="space-y-3 border-t border-[var(--rule)] pt-3">
            <SplitRail
              key={`${calc.cardAmount}-${calc.ownerCommission}`}
              segments={[
                { label: 'Customer', value: calc.customerReceived, tone: 'ink' },
                { label: 'Mine', value: calc.ownerCommission, tone: 'leaf' },
                { label: 'Card co.', value: calc.companyCommission, tone: 'quiet' },
              ]}
            />
            <div className="flex items-center justify-between rounded-xl bg-leaf-50 px-3.5 py-2.5">
              <div>
                <p className="colhead">Card company pays you</p>
                <p className="mt-0.5 text-[11px] muted">{money(calc.customerReceived)} cash back + {money(calc.ownerCommission)} your share</p>
              </div>
              <span className="sum text-[19px] text-leaf-600">{money(calc.settlementAmount)}</span>
            </div>
            <p className="text-[11.5px] leading-snug muted-2">
              {included
                ? `Commission comes out of the ${moneyShort(requested)}; the card is swiped for that amount and the company keeps ${money(calc.companyCommission)}.`
                : `The customer keeps the full ${moneyShort(requested)}; commission is added on top and the company keeps ${money(calc.companyCommission)}.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
