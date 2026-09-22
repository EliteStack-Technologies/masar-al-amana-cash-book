'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { ErrorNote, Skeleton } from '@/components/ui';
import { CustomerForm, toCustomerValues } from '@/components/CustomerForm';

export default function EditCustomerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/customers/${id}`)
      .then((d) => setInitial(toCustomerValues(d.customer)))
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/customers/${id}`, { method: 'PATCH', body: payload });
    router.replace(`/customers/${id}`);
  };

  return (
    <AppShell title="Edit customer" back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <CustomerForm initial={initial} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} onCancel={() => router.back()} />
      ) : !error ? (
        <Skeleton className="h-[240px]" />
      ) : null}
    </AppShell>
  );
}
