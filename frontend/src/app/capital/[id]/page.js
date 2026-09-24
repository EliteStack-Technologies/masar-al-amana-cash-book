'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateTime, toLocalInput } from '@/lib/format';
import { Button, Card, ErrorNote, Field, SectionTitle, Skeleton, SplitRail } from '@/components/ui';
import { IconEdit, IconTrash } from '@/components/Icons';

export default function CapitalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [capital, setCapital] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toLocalInput);
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () =>
    api(`/capital/${id}`)
      .then((d) => { setCapital(d.capital); setWithdrawals(d.withdrawals); })
      .catch((err) => setError(err.message));

  useEffect(() => { load(); }, [id]);

  const addWithdrawal = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) return setError('Enter a withdrawal amount greater than 0.');
    setAdding(true);
    try {
      const d = await api(`/capital/${id}/withdrawals`, {
        method: 'POST',
        body: { amount: Number(amount), entryDate: new Date(date).toISOString(), notes },
      });
      setCapital(d.capital);
      setWithdrawals(d.withdrawals);
      setAmount(''); setNotes(''); setDate(toLocalInput());
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const removeWithdrawal = async (withdrawalId) => {
    if (!confirm('Remove this withdrawal?')) return;
    try {
      await api(`/capital/${id}/withdrawals/${withdrawalId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeCapital = async () => {
    if (!confirm('Delete this capital entry and all its withdrawals?')) return;
    setBusy(true);
    try {
      await api(`/capital/${id}`, { method: 'DELETE' });
      router.replace('/capital');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title={capital?.partnerName || 'Capital'} subtitle={capital?.capitalNumber} back>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!capital && !error ? (
        <Skeleton className="h-[300px]" />
      ) : capital ? (
        <div className="space-y-5 rise">
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <span className="colhead">Still in the shop</span>
              <span className="sum text-[28px] leading-none text-leaf-500 dark:text-leaf-400">{money(capital.balance)}</span>
            </div>
            <div className="border-t border-[var(--rule)] pt-3">
              <SplitRail
                segments={[
                  { label: 'Withdrawn', value: capital.withdrawnAmount, tone: 'stamp' },
                  { label: 'In the shop', value: capital.balance, tone: 'leaf' },
                ]}
                caption={`Capital of ${money(capital.amount)} put in on ${dateTime(capital.entryDate)}.`}
              />
            </div>
          </Card>

          {capital.status === 'open' && (
            <section>
              <SectionTitle>Record a withdrawal</SectionTitle>
              <Card className="space-y-3.5">
                <form onSubmit={addWithdrawal} className="space-y-3.5">
                  <Field label="Withdrawal amount">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
                      <input className="field sum pl-14" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                  </Field>
                  <Field label="Date & time"><input className="field ref" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
                  <Field label="Notes"><input className="field ref" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                  <Button type="submit" variant="stamp" className="w-full" loading={adding}>Add withdrawal</Button>
                </form>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle>{withdrawals.length} withdrawal{withdrawals.length === 1 ? '' : 's'}</SectionTitle>
            {withdrawals.length ? (
              <Card className="ruled py-0">
                {withdrawals.map((w) => (
                  <div key={w._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="sum text-[14px] text-stamp-500 dark:text-stamp-400">{money(w.amount)}</p>
                      <p className="ref mt-0.5 text-[10.5px] muted-2">{dateTime(w.entryDate)}{w.notes ? ` · ${w.notes}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => removeWithdrawal(w._id)} aria-label="Remove withdrawal" className="muted-2 active:text-stamp-500">
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </Card>
            ) : (
              <p className="text-[13px] muted">No withdrawals recorded yet.</p>
            )}
          </section>

          <div className="flex gap-3 pb-2">
            <Link href={`/capital/${id}/edit`} className="flex-1">
              <Button variant="soft" className="w-full"><IconEdit size={16} /> Edit capital</Button>
            </Link>
            <Button variant="danger" className="flex-1" loading={busy} onClick={removeCapital}><IconTrash size={16} /> Delete</Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
