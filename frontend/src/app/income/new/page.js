'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { MoneyEntryForm, emptyEntry } from '@/components/MoneyEntryForm';

export default function NewIncomePage() {
  const router = useRouter();

  const create = async (payload) => {
    await api('/income', { method: 'POST', body: payload });
    router.replace('/income');
  };

  return (
    <AppShell title="Add income" subtitle="Money coming in" back>
      <MoneyEntryForm kind="income" initial={emptyEntry()} submitLabel="Save income" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
