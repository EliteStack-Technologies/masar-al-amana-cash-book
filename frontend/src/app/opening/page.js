'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateOnly, timeOnly, toLocalInput } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Field, Figure, Skeleton } from '@/components/ui';
import { IconWallet, IconChevron, IconPlus } from '@/components/Icons';
import { Pager, usePaged } from '@/components/Pager';

/**
 * Opening balances: cash already in the drawer when the book starts (or is
 * topped up to a counted figure). Each one is a cash-in line in the cash book
 * and part of cash in hand; they are added and edited here.
 */
export default function OpeningBalancePage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  // null = closed, {} = a new opening balance, an item = editing that one.
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setError('');
    api('/cashbook/opening')
      .then((d) => setItems(d.items))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const saved = () => {
    setEditing(null);
    load();
  };

  const paged = usePaged(items, 20);
  const total = (items || []).reduce((a, o) => a + o.amount, 0);

  return (
    <AppShell
      title="Opening balance"
      subtitle={items ? `${items.length} ${items.length === 1 ? 'entry' : 'entries'}` : 'Loading…'}
      back
      action={
        !editing ? (
          <button
            type="button"
            onClick={() => setEditing({})}
            aria-label="Add opening balance"
            className="flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]"
          >
            <IconPlus size={18} />
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        {items && (
          <Card className="p-3.5 rise">
            <Figure label="Total opening balance" value={money(total)} tone="leaf" size="lg" />
          </Card>
        )}

        {editing ? (
          <OpeningForm
            key={editing._id || 'new'}
            entry={editing}
            onDone={saved}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Button variant="stamp" className="w-full" onClick={() => setEditing({})}>
            <IconPlus size={17} /> Add opening balance
          </Button>
        )}

        <ErrorNote>{error}</ErrorNote>

        {!items && !error ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[60px]" />)}
          </div>
        ) : items && items.length ? (
          <div className="space-y-4">
            <div className="card ruled py-0">
              {paged.pageItems.map((o) => (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => setEditing(o)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-[var(--paper-2)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{o.notes || 'Opening balance'}</p>
                    <p className="ref mt-0.5 text-[10.5px] muted-2">
                      {o.openingNumber ? `${o.openingNumber} · ` : ''}
                      {dateOnly(o.entryDate)} {timeOnly(o.entryDate)}
                    </p>
                  </div>
                  <p className="sum shrink-0 text-[15px] text-leaf-500 dark:text-leaf-400">+{money(o.amount)}</p>
                  <span className="muted-2"><IconChevron size={15} /></span>
                </button>
              ))}
            </div>
            <Pager page={paged.page} pages={paged.pages} total={paged.total} onChange={paged.setPage} />
          </div>
        ) : items ? (
          <Empty
            icon={IconWallet}
            title="No opening balance yet"
            hint="Add the cash already in the drawer, so the cash book and cash in hand start from the right figure."
          />
        ) : null}
      </div>
    </AppShell>
  );
}

/** Add, edit or remove one opening balance: cash already in the drawer. */
function OpeningForm({ entry, onDone, onCancel }) {
  const isEdit = Boolean(entry._id);
  const [date, setDate] = useState(() => toLocalInput(isEdit ? entry.entryDate : undefined));
  const [amount, setAmount] = useState(isEdit ? String(entry.amount) : '');
  const [notes, setNotes] = useState(isEdit ? entry.notes || '' : '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0.');
    setBusy('save');
    try {
      const body = { entryDate: new Date(date).toISOString(), amount: Number(amount), notes: notes.trim() };
      await api(isEdit ? `/cashbook/opening/${entry._id}` : '/cashbook/opening', {
        method: isEdit ? 'PATCH' : 'POST',
        body,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this opening balance?')) return;
    setError('');
    setBusy('delete');
    try {
      await api(`/cashbook/opening/${entry._id}`, { method: 'DELETE' });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <Card className="space-y-3.5 rise">
      <form onSubmit={save} className="space-y-3.5">
        <p className="text-[15px] font-semibold">{isEdit ? 'Edit opening balance' : 'New opening balance'}</p>
        <Field label="Amount" hint="Cash in the drawer">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[11px] muted-2">AED</span>
            <input
              className="field sum pl-12"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </Field>
        <Field label="Date & time">
          <input className="field ref" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Notes" hint="Optional">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button type="button" variant="soft" className="flex-1" onClick={onCancel} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-[2]" loading={busy === 'save'} disabled={Boolean(busy)}>
            {isEdit ? 'Save' : 'Add opening balance'}
          </Button>
        </div>
        {isEdit && (
          <Button type="button" variant="ghost" className="w-full text-stamp-500" onClick={remove} loading={busy === 'delete'} disabled={Boolean(busy)}>
            Delete
          </Button>
        )}
      </form>
    </Card>
  );
}
