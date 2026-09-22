'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { ErrorNote, Skeleton } from '@/components/ui';
import { LoanForm, toLoanValues } from '@/components/LoanForm';

export default function EditLoanPage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/loans/${id}`)
      .then((d) => setInitial(toLoanValues(d.loan)))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/loans/${id}`, { method: 'PATCH', body: payload });
    router.replace(`/loans/${id}`);
  };

  return (
    <AppShell title="Edit loan" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <LoanForm initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
      ) : !error ? (
        <Skeleton className="h-[280px]" />
      ) : null}
    </AppShell>
  );
}
