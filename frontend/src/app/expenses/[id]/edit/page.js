'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, ErrorNote, Skeleton } from '@/components/ui';
import { IconTrash } from '@/components/Icons';
import { MoneyEntryForm, toEntryValues } from '@/components/MoneyEntryForm';

export default function EditExpensePage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/expenses/${id}`)
      .then((d) => setInitial(toEntryValues(d.expense, 'expense')))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/expenses/${id}`, { method: 'PATCH', body: payload });
    router.replace('/expenses');
  };

  const remove = async () => {
    if (!confirm('Delete this expense entry?')) return;
    setBusy(true);
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      router.replace('/expenses');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title="Edit expense" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <div className="space-y-4">
          <MoneyEntryForm kind="expense" initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
          <Button variant="ghost" className="w-full text-stamp-500" loading={busy} onClick={remove}><IconTrash size={16} /> Delete entry</Button>
        </div>
      ) : !error ? (
        <Skeleton className="h-[280px]" />
      ) : null}
    </AppShell>
  );
}
