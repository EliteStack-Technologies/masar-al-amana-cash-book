'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Row, Skeleton } from '@/components/ui';
import { IconEdit, IconTrash, IconChevron } from '@/components/Icons';

export default function MachineDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [machine, setMachine] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/machines/${id}`)
      .then((d) => setMachine(d.machine))
      .catch((err) => setError(err.message));
  }, [id]);

  const remove = async () => {
    if (!confirm('Delete this machine?')) return;
    setBusy(true);
    try {
      await api(`/machines/${id}`, { method: 'DELETE' });
      router.replace('/machines');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title={machine?.name || 'Machine'} subtitle={machine?.machineNumber} back>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!machine && !error ? (
        <Skeleton className="h-[200px]" />
      ) : machine ? (
        <div className="space-y-5 rise">
          <Card className="ruled py-0">
            <Row label="Name" value={machine.name} isMoney={false} />
            <Row label="Card company" value={machine.cardCompany || '—'} isMoney={false} />
            <Row
              label="Supplier %"
              sub="Taken off every swipe on this machine"
              value={machine.supplierPercent ? `${machine.supplierPercent}%` : 'Not set'}
              isMoney={false}
            />
            <Row label="Device ID" value={machine.deviceId || '—'} isMoney={false} />
            <Row label="Status" value={machine.status === 'active' ? 'Active' : 'Inactive'} isMoney={false} />
            {machine.notes ? <Row label="Notes" value={machine.notes} isMoney={false} /> : null}
          </Card>

          <Link href={`/transactions?machine=${machine._id}`} className="block">
            <Button variant="soft" className="w-full">View this machine's entries <IconChevron size={15} /></Button>
          </Link>

          <div className="flex gap-3 pb-2">
            <Link href={`/machines/${id}/edit`} className="flex-1">
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
