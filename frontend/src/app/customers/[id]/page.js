'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Row, SectionTitle, Skeleton, StatusPill } from '@/components/ui';
import { IconEdit, IconTrash, IconChevron } from '@/components/Icons';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/customers/${id}`)
      .then((d) => setCustomer(d.customer))
      .catch((err) => setError(err.message));
  }, [id]);

  const remove = async () => {
    if (!confirm('Delete this customer?')) return;
    setBusy(true);
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      router.replace('/customers');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title={customer?.name || 'Customer'} subtitle={customer?.custNumber} back>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!customer && !error ? (
        <Skeleton className="h-[240px]" />
      ) : customer ? (
        <div className="space-y-5 rise">
          <Card className="ruled py-0">
            <Row label="Name" value={customer.name} isMoney={false} />
            <Row label="Mobile" value={customer.mobile} isMoney={false} />
            <Row label="Charge to customer" value={`${customer.commissionPercent}%`} isMoney={false} />
            <Row label="Machine" value={customer.machine?.name || '—'} isMoney={false} />
            <Row label="Status" value={customer.status === 'active' ? 'Active' : 'Inactive'} isMoney={false} />
            {customer.notes ? <Row label="Notes" value={customer.notes} isMoney={false} /> : null}
          </Card>

          <Link href={`/transactions?customer=${customer._id}`} className="block">
            <Button variant="soft" className="w-full">View this customer's entries <IconChevron size={15} /></Button>
          </Link>

          <div className="flex gap-3 pb-2">
            <Link href={`/customers/${id}/edit`} className="flex-1">
              <Button variant="soft" className="w-full"><IconEdit size={16} /> Edit</Button>
            </Link>
            <Button variant="danger" className="flex-1" loading={busy} onClick={remove}>
              <IconTrash size={16} /> Delete
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
