'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { ErrorNote, Skeleton } from '@/components/ui';
import { MachineForm, toMachineValues } from '@/components/MachineForm';

export default function EditMachinePage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/machines/${id}`)
      .then((d) => setInitial(toMachineValues(d.machine)))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/machines/${id}`, { method: 'PATCH', body: payload });
    router.replace(`/machines/${id}`);
  };

  return (
    <AppShell title="Edit machine" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <MachineForm initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
      ) : !error ? (
        <Skeleton className="h-[200px]" />
      ) : null}
    </AppShell>
  );
}
