'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { todayInput } from '@/lib/format';
import { Button, Card, ErrorNote, Field, SectionTitle, Skeleton } from '@/components/ui';

export const emptyLoan = () => ({
  account: '',
  lenderName: '',
  lenderMobile: '',
  principal: '',
  entryDate: todayInput(),
  notes: '',
});

export const toLoanValues = (l) => ({
  account: l.account?._id || l.account || '',
  lenderName: l.lenderName || '',
  lenderMobile: l.lenderMobile || '',
  principal: String(l.principal ?? ''),
  entryDate: (l.entryDate ? new Date(l.entryDate) : new Date()).toISOString().slice(0, 10),
  notes: l.notes || '',
});

/**
 * Cash an account holder puts into the shop. Pick the account it came from and
 * type the amount - that is the whole form. A name that is not on the list
 * yet opens a new loan account when the loan is saved. Loan accounts are their
 * own list; swipe customers never appear here.
 */
export function LoanForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [accounts, setAccounts] = useState(null);
  const [adding, setAdding] = useState(!initial.account && !!initial.lenderName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api('/loans/accounts')
      .then((d) => setAccounts(d.items))
      .catch((err) => setError(err.message));
  }, []);

  const pick = (e) => {
    const value = e.target.value;
    if (value === '__new') {
      setAdding(true);
      setForm((f) => ({ ...f, account: '', lenderName: '', lenderMobile: '' }));
      return;
    }
    setAdding(false);
    const acc = accounts?.find((a) => a._id === value);
    setForm((f) => ({
      ...f,
      account: value,
      lenderName: acc?.name || '',
      lenderMobile: acc?.mobile || '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.account && !form.lenderName.trim()) {
      return setError('Choose an account, or type a name for a new one.');
    }
    if (!(Number(form.principal) > 0)) return setError('Loan amount must be greater than 0.');

    setBusy(true);
    try {
      await onSubmit({
        account: form.account || null,
        lenderName: form.lenderName.trim(),
        lenderMobile: form.lenderMobile.trim(),
        principal: Number(form.principal),
        entryDate: new Date(`${form.entryDate}T12:00:00`).toISOString(),
        notes: form.notes,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!accounts) return <Skeleton className="h-[220px]" />;

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Who gave the cash</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Account name">
            <select className="field" value={adding ? '__new' : form.account} onChange={pick}>
              <option value="">Choose an account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
              <option value="__new">+ New account</option>
            </select>
          </Field>

          {adding ? (
            <>
              <Field label="New account name" hint="Saved to your loan accounts">
                <input
                  className="field"
                  type="text"
                  placeholder="e.g. Rashid"
                  value={form.lenderName}
                  onChange={set('lenderName')}
                  autoFocus
                  required
                />
              </Field>
              <Field label="Mobile number" hint="Optional — saved against the new account">
                <input
                  className="field ref"
                  type="tel"
                  inputMode="numeric"
                  placeholder="05x xxx xxxx"
                  value={form.lenderMobile}
                  onChange={set('lenderMobile')}
                />
              </Field>
            </>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle>Amount</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Loan amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">
                AED
              </span>
              <input
                className="field sum pl-14 text-[22px]"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.principal}
                onChange={set('principal')}
                required
              />
            </div>
          </Field>
          <Field label="Date">
            <input className="field" type="date" value={form.entryDate} onChange={set('entryDate')} required />
          </Field>
          <Field label="Notes" hint="Optional">
            <textarea className="field resize-none" rows={2} value={form.notes} onChange={set('notes')} />
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
