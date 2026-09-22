'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Field, SectionTitle, cx } from '@/components/ui';

export const emptyCustomer = (user) => ({
  name: '',
  mobile: '',
  commissionPercent: String(user?.defaultCommissionPercent ?? 30),
  commissionType: 'included',
  machine: '',
  status: 'active',
  notes: '',
});

export const toCustomerValues = (c) => ({
  name: c.name || '',
  mobile: c.mobile || '',
  commissionPercent: String(c.commissionPercent ?? 30),
  commissionType: c.commissionType || 'included',
  machine: c.machine?._id || c.machine || '',
  status: c.status || 'active',
  notes: c.notes || '',
});

export function CustomerForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api('/machines?status=active')
      .then((d) => setMachines(d.items))
      .catch(() => setMachines([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Customer name is required.');
    if (!form.mobile.trim()) return setError('Mobile number is required.');

    setBusy(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        commissionPercent: Number(form.commissionPercent) || 0,
        machine: form.machine || null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const included = form.commissionType === 'included';

  return (
    <form onSubmit={submit} className="space-y-5 rise">
      <section>
        <SectionTitle>Customer</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Name">
            <input className="field" type="text" placeholder="e.g. Rahul" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Mobile number">
            <input
              className="field ref"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              value={form.mobile}
              onChange={set('mobile')}
              required
            />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Commission</SectionTitle>
        <Card className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, commissionType: 'included' }))}
              className={cx('border p-3 text-left', included ? 'border-stamp-500 bg-[var(--paper-2)]' : 'border-[var(--rule-strong)]')}
            >
              <span className={cx('display block text-[14px] font-bold', included && 'text-stamp-500')}>Included</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug muted">Taken out of the cash</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, commissionType: 'excluded' }))}
              className={cx('border p-3 text-left', !included ? 'border-stamp-500 bg-[var(--paper-2)]' : 'border-[var(--rule-strong)]')}
            >
              <span className={cx('display block text-[14px] font-bold', !included && 'text-stamp-500')}>Excluded</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug muted">Added on top of the swipe</span>
            </button>
          </div>
          <Field label="Commission %" hint="Pre-fills when you pick this customer on a new entry">
            <input className="field ref" type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={set('commissionPercent')} required />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Assignment</SectionTitle>
        <Card className="space-y-3.5">
          <Field label="Assigned card machine" hint="Optional — the machine this customer usually uses">
            <select className="field" value={form.machine} onChange={set('machine')}>
              <option value="">No specific machine</option>
              {machines.map((m) => (
                <option key={m._id} value={m._id}>{m.name}{m.cardCompany ? ` · ${m.cardCompany}` : ''}</option>
              ))}
            </select>
          </Field>
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
