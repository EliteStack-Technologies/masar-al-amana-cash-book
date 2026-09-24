'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { CapitalForm, emptyCapital } from '@/components/CapitalForm';

export default function NewCapitalPage() {
  const router = useRouter();

  const create = async (payload) => {
    const { capital } = await api('/capital', { method: 'POST', body: payload });
    router.replace(`/capital/${capital._id}`);
  };

  return (
    <AppShell title="New capital" subtitle="Money put into the shop" back>
      <CapitalForm initial={emptyCapital()} submitLabel="Save capital" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
