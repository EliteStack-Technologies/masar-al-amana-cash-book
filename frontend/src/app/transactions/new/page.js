'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { TransactionForm, emptyTransaction } from '@/components/TransactionForm';
import { api } from '@/lib/api';

export default function NewTransactionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const create = async (payload) => {
    const { transaction } = await api('/transactions', { method: 'POST', body: payload });
    router.replace(`/transactions/${transaction._id}?created=1`);
  };

  return (
    <AppShell title="New entry" subtitle="Cash given against a card" back>
      <TransactionForm
        initial={emptyTransaction(user)}
        submitLabel="Save entry"
        busyLabel="Saving…"
        onSubmit={create}
        onCancel={() => router.back()}
      />
    </AppShell>
  );
}
