'use client';

import { useState } from 'react';
import { todayInput } from '@/lib/format';
import { Button, Card, ErrorNote, Field, SectionTitle } from '@/components/ui';

export const emptyLoan = () => ({
  borrowerName: '',
  borrowerMobile: '',
  principal: '',
  entryDate: todayInput(),
  notes: '',
});

export const toLoanValues = (l) => ({
  borrowerName: l.borrowerName || '',
  borrowerMobile: l.borrowerMobile || '',
  principal: String(l.principal ?? ''),
  entryDate: (l.entryDate ? new Date(l.entryDate) : new Date()).toISOString().slice(0, 10),
  notes: l.notes || '',
});

export function LoanForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.borrowerName.trim()) return setError('Borrower name is required.');
    if (!(Number(form.principal) > 0)) return setError('Loan amount must be greater than 0.');

    setBusy(true);
    try {
      await onSubmit({
        borrowerName: form.borrowerName.trim(),
        borrowerMobile: form.borrowerMobile.trim(),
        principal: Number(form.principal),
        entryDate: new Date(`${form.entryDate}T12:00:00`).toISOString(),
        notes: form.notes,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Loan given</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Borrower name">
            <input className="field" type="text" placeholder="e.g. Customer A" value={form.borrowerName} onChange={set('borrowerName')} required />
          </Field>
          <Field label="Borrower mobile" hint="Optional">
            <input className="field ref" type="tel" inputMode="numeric" value={form.borrowerMobile} onChange={set('borrowerMobile')} />
          </Field>
          <Field label="Loan amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
              <input className="field sum pl-14 text-[22px]" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={form.principal} onChange={set('principal')} required />
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
        <Button type="submit" variant="stamp" className="flex-[2]" loading={busy}>{busy ? busyLabel : submitLabel}</Button>
      </div>
    </form>
  );
}
