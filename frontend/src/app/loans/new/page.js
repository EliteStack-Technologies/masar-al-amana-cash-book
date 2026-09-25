'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui';
import { LoanForm, emptyLoan } from '@/components/LoanForm';

export default function NewLoanPage() {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense fallback={<AppShell title="New loan" back><Skeleton className="h-[220px]" /></AppShell>}>
      <NewLoan />
    </Suspense>
  );
}

function NewLoan() {
  const router = useRouter();
  // Opened from the Receivable tab, the form starts on that side.
  const direction = useSearchParams().get('direction') === 'receivable' ? 'receivable' : 'payable';

  const create = async (payload) => {
    const { loan } = await api('/loans', { method: 'POST', body: payload });
    router.replace(`/loans/${loan._id}`);
  };

  return (
    <AppShell title="New loan" subtitle="Payable or receivable" back>
      <LoanForm initial={emptyLoan(direction)} submitLabel="Save loan" busyLabel="Saving…" onSubmit={create} onCancel={() => router.back()} />
    </AppShell>
  );
}
