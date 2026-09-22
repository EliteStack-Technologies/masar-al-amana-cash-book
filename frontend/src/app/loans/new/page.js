'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { LoanForm, emptyLoan } from '@/components/LoanForm';

export default function NewLoanPage() {
  const router = useRouter();

  const create = async (payload) => {
    const { loan } = await api('/loans', { method: 'POST', body: payload });
    router.replace(`/loans/${loan._id}`);
  };

  return (
    <AppShell title="New loan" subtitle="Money you are lending out" back>
      <LoanForm initial={emptyLoan()} submitLabel="Save loan" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
