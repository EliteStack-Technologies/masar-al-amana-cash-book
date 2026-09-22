'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { MachineForm, emptyMachine } from '@/components/MachineForm';

export default function NewMachinePage() {
  const router = useRouter();

  const create = async (payload) => {
    const { machine } = await api('/machines', { method: 'POST', body: payload });
    router.replace(`/machines/${machine._id}`);
  };

  return (
    <AppShell title="New machine" subtitle="Add a card machine" back>
      <MachineForm initial={emptyMachine()} submitLabel="Save machine" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
