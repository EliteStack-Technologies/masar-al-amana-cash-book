'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { ErrorNote, Skeleton } from '@/components/ui';
import { CapitalForm, toCapitalValues } from '@/components/CapitalForm';

export default function EditCapitalPage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/capital/${id}`)
      .then((d) => setInitial(toCapitalValues(d.capital)))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/capital/${id}`, { method: 'PATCH', body: payload });
    router.replace(`/capital/${id}`);
  };

  return (
    <AppShell title="Edit capital" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <CapitalForm initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
      ) : !error ? (
        <Skeleton className="h-[280px]" />
      ) : null}
    </AppShell>
  );
}
