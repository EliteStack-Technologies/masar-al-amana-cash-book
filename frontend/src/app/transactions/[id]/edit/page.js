'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionForm, toFormValues } from '@/components/TransactionForm';
import { api } from '@/lib/api';
import { ErrorNote, Skeleton } from '@/components/ui';

export default function EditTransactionPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [initial, setInitial] = useState(null);
  const [txnNumber, setTxnNumber] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/transactions/${id}`)
      .then((d) => {
        setInitial(toFormValues(d.transaction));
        setTxnNumber(d.transaction.txnNumber);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const save = async (payload) => {
    await api(`/transactions/${id}`, { method: 'PATCH', body: payload });
    router.replace(`/transactions/${id}`);
  };

  return (
    <AppShell title="Edit entry" subtitle={txnNumber} back>
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {initial ? (
        <TransactionForm
          initial={initial}
          submitLabel="Save changes"
          busyLabel="Saving…"
          onSubmit={save}
          onCancel={() => router.back()}
        />
      ) : (
        !error && (
          <div className="space-y-3">
            <Skeleton className="h-[160px]" />
            <Skeleton className="h-[280px]" />
          </div>
        )
      )}
    </AppShell>
  );
}
