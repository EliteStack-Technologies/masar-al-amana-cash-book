'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, ErrorNote, Skeleton } from '@/components/ui';
import { IconTrash } from '@/components/Icons';
import { MoneyEntryForm, toEntryValues } from '@/components/MoneyEntryForm';

export default function EditIncomePage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/income/${id}`)
      .then((d) => setInitial(toEntryValues(d.income, 'income')))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/income/${id}`, { method: 'PATCH', body: payload });
    router.replace('/income');
  };

  const remove = async () => {
    if (!confirm('Delete this income entry?')) return;
    setBusy(true);
    try {
      await api(`/income/${id}`, { method: 'DELETE' });
      router.replace('/income');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title="Edit income" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <div className="space-y-4">
          <MoneyEntryForm kind="income" initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
          <Button variant="ghost" className="w-full text-stamp-500" loading={busy} onClick={remove}><IconTrash size={16} /> Delete entry</Button>
        </div>
      ) : !error ? (
        <Skeleton className="h-[280px]" />
      ) : null}
    </AppShell>
  );
}
