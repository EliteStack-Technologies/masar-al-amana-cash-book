'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { CustomerForm, emptyCustomer } from '@/components/CustomerForm';

export default function NewCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();

  const create = async (payload) => {
    const { customer } = await api('/customers', { method: 'POST', body: payload });
    router.replace(`/customers/${customer._id}`);
  };

  return (
    <AppShell title="New customer" subtitle="Add someone to your book" back>
      <CustomerForm
        initial={emptyCustomer(user)}
        submitLabel="Save customer"
        busyLabel="Saving…"
        onSubmit={create}
        onCancel={() => router.back()}
      />
    </AppShell>
  );
}
