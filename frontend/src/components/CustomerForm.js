'use client';

import { useState } from 'react';
import { Button, Card, ErrorNote, Field, SectionTitle } from '@/components/ui';

export const emptyCustomer = () => ({
  name: '',
  mobile: '',
  status: 'active',
  notes: '',
});

export const toCustomerValues = (c) => ({
  name: c.name || '',
  mobile: c.mobile || '',
  status: c.status || 'active',
  notes: c.notes || '',
});

export function CustomerForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Customer name is required.');

    setBusy(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Customer</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Name">
            <input className="field" type="text" placeholder="e.g. Rahul" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Mobile number" hint="Optional">
            <input
              className="field ref"
              type="tel"
              inputMode="numeric"
              placeholder="05x xxx xxxx"
              value={form.mobile}
              onChange={set('mobile')}
            />
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
