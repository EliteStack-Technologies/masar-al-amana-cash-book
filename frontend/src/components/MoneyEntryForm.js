'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toLocalInput } from '@/lib/format';
import { Button, Card, ErrorNote, Field, SectionTitle } from '@/components/ui';

export const emptyEntry = () => ({
  entryDate: toLocalInput(),
  amount: '',
  category: '',
  party: '',
  notes: '',
});

// `party` maps to `receiver` for income and `payee` for expenses.
export const toEntryValues = (e, kind) => ({
  entryDate: toLocalInput(e.entryDate),
  amount: String(e.amount ?? ''),
  category: e.category || '',
  party: (kind === 'income' ? e.receiver : e.payee) || '',
  notes: e.notes || '',
});

/**
 * Shared income / expense entry form. `kind` decides the wording and which
 * managed category list to load.
 */
export function MoneyEntryForm({ kind, initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const partyLabel = kind === 'income' ? 'Received from' : 'Paid to';

  useEffect(() => {
    api(`/categories?kind=${kind}`)
      .then((d) => setCategories(d.items))
      .catch(() => setCategories([]));
  }, [kind]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(form.amount) > 0)) return setError('Enter an amount greater than 0.');

    setBusy(true);
    try {
      const payload = {
        entryDate: new Date(form.entryDate).toISOString(),
        amount: Number(form.amount),
        category: form.category.trim(),
        notes: form.notes,
      };
      payload[kind === 'income' ? 'receiver' : 'payee'] = form.party.trim();
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>{kind === 'income' ? 'Income' : 'Expense'}</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
              <input className="field sum pl-14 text-[22px]" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} required />
            </div>
          </Field>

          <Field
            label="Category"
            hint={categories && !categories.length ? `No ${kind} categories yet - add them under Categories` : undefined}
          >
            <select className="field" value={form.category} onChange={set('category')} disabled={!categories}>
              <option value="">{categories ? 'Choose a category' : 'Loading…'}</option>
              {(categories || []).map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
              {/* An older entry may use a name that is no longer in the list. */}
              {form.category && categories && !categories.some((c) => c.name === form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
            </select>
          </Field>

          <Field label={partyLabel} hint="Optional">
            <input className="field" type="text" placeholder={kind === 'income' ? 'e.g. ABC' : 'e.g. Landlord'} value={form.party} onChange={set('party')} />
          </Field>

          <Field label="Date & time">
            <input className="field" type="datetime-local" value={form.entryDate} onChange={set('entryDate')} required />
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
