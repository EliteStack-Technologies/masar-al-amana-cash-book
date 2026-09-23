'use client';

import { useState } from 'react';
import { Button, Card, ErrorNote, Field, SectionTitle } from '@/components/ui';

export const emptyMachine = () => ({
  name: '',
  deviceId: '',
  cardCompany: '',
  supplierPercent: '',
  status: 'active',
  notes: '',
});

export const toMachineValues = (m) => ({
  name: m.name || '',
  deviceId: m.deviceId || '',
  cardCompany: m.cardCompany || '',
  supplierPercent: String(m.supplierPercent ?? ''),
  status: m.status || 'active',
  notes: m.notes || '',
});

export function MachineForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Machine name is required.');

    setBusy(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        supplierPercent: Number(form.supplierPercent) || 0,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Machine</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Machine name">
            <input className="field" type="text" placeholder="e.g. Machine 1" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Card company" hint="Optional — e.g. HDFC, Pine Labs">
            <input className="field" type="text" placeholder="e.g. HDFC" value={form.cardCompany} onChange={set('cardCompany')} />
          </Field>
          <Field label="Device ID / serial" hint="Optional">
            <input className="field ref" type="text" value={form.deviceId} onChange={set('deviceId')} />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Supplier rate</SectionTitle>
        <Card className="space-y-3.5">
          {/* Set once per machine. Every swipe snapshots it, so changing it
              here never rewrites entries already in the book. */}
          <Field
            label="Supplier %"
            hint="The card company's cut of every swipe on this machine"
          >
            <input
              className="field ref"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g. 1.90"
              value={form.supplierPercent}
              onChange={set('supplierPercent')}
            />
          </Field>
          <p className="text-[11.5px] leading-snug muted-2">
            A swipe of AED 1,000 at {Number(form.supplierPercent) || 0}% means a fee of AED{' '}
            {((1000 * (Number(form.supplierPercent) || 0)) / 100).toFixed(2)} and AED{' '}
            {(1000 - (1000 * (Number(form.supplierPercent) || 0)) / 100).toFixed(2)} into your
            account. Entries already saved keep the rate they were entered at.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Details</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Status">
            <select className="field" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
