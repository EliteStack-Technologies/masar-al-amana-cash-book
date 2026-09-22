'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { MoneyEntryForm, emptyEntry } from '@/components/MoneyEntryForm';

export default function NewExpensePage() {
  const router = useRouter();

  const create = async (payload) => {
    await api('/expenses', { method: 'POST', body: payload });
    router.replace('/expenses');
  };

  return (
    <AppShell title="Add expense" subtitle="Money going out" back>
      <MoneyEntryForm kind="expense" initial={emptyEntry()} submitLabel="Save expense" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
