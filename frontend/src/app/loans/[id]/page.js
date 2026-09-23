'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { money, dateOnly, todayInput } from '@/lib/format';
import {
  Button, Card, ErrorNote, Field, Row, SectionTitle, Skeleton, SplitRail,
} from '@/components/ui';
import { IconEdit, IconTrash } from '@/components/Icons';

export default function LoanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loan, setLoan] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInput());
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () =>
    api(`/loans/${id}`)
      .then((d) => { setLoan(d.loan); setSettlements(d.settlements); })
      .catch((err) => setError(err.message));

  useEffect(() => { load(); }, [id]);

  const addSettlement = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) return setError('Enter a repayment amount greater than 0.');
    setAdding(true);
    try {
      const d = await api(`/loans/${id}/settlements`, {
        method: 'POST',
        body: { amount: Number(amount), entryDate: new Date(`${date}T12:00:00`).toISOString(), notes },
      });
      setLoan(d.loan);
      setSettlements(d.settlements);
      setAmount(''); setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const removeSettlement = async (settlementId) => {
    if (!confirm('Remove this repayment?')) return;
    try {
      await api(`/loans/${id}/settlements/${settlementId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeLoan = async () => {
    if (!confirm('Delete this loan and all its repayments?')) return;
    setBusy(true);
    try {
      await api(`/loans/${id}`, { method: 'DELETE' });
      router.replace('/loans');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AppShell title={loan?.lenderName || 'Loan'} subtitle={loan?.loanNumber} back>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!loan && !error ? (
        <Skeleton className="h-[300px]" />
      ) : loan ? (
        <div className="space-y-5 rise">
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <span className="colhead">Still outstanding</span>
              <span className="sum text-[28px] leading-none text-stamp-500 dark:text-stamp-400">{money(loan.outstanding)}</span>
            </div>
            <div className="border-t border-[var(--rule)] pt-3">
              <SplitRail
                segments={[
                  { label: 'Repaid', value: loan.settledAmount, tone: 'leaf' },
                  { label: 'Outstanding', value: loan.outstanding, tone: 'stamp' },
                ]}
                caption={`Loan of ${money(loan.principal)} taken in on ${dateOnly(loan.entryDate)}.`}
              />
            </div>
          </Card>

          {loan.status === 'open' && (
            <section>
              <SectionTitle>Record a repayment</SectionTitle>
              <Card className="space-y-3.5">
                <form onSubmit={addSettlement} className="space-y-3.5">
                  <Field label="Repayment amount">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
                      <input className="field sum pl-14" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date"><input className="field ref" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                    <Field label="Notes"><input className="field ref" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                  </div>
                  <Button type="submit" variant="stamp" className="w-full" loading={adding}>Add repayment</Button>
                </form>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle>{settlements.length} repayment{settlements.length === 1 ? '' : 's'}</SectionTitle>
            {settlements.length ? (
              <Card className="ruled py-0">
                {settlements.map((s) => (
                  <div key={s._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="sum text-[14px] text-leaf-500 dark:text-leaf-400">{money(s.amount)}</p>
                      <p className="ref mt-0.5 text-[10.5px] muted-2">{dateOnly(s.entryDate)}{s.notes ? ` · ${s.notes}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => removeSettlement(s._id)} aria-label="Remove repayment" className="muted-2 active:text-stamp-500">
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </Card>
            ) : (
              <p className="text-[13px] muted">No repayments recorded yet.</p>
            )}
          </section>

          <div className="flex gap-3 pb-2">
            <Link href={`/loans/${id}/edit`} className="flex-1">
              <Button variant="soft" className="w-full"><IconEdit size={16} /> Edit loan</Button>
            </Link>
            <Button variant="danger" className="flex-1" loading={busy} onClick={removeLoan}><IconTrash size={16} /> Delete</Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
