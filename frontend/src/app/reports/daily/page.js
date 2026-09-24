'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TransactionCard } from '@/components/TransactionCard';
import { api, qs } from '@/lib/api';
import { todayInput, dateOnly, dateTime, money } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Row, SectionTitle, Skeleton, Empty, StatusPill } from '@/components/ui';
import { PeriodPicker, PeriodTabs, ReportBreakdown, ReportHeadline } from '@/components/ReportBits';
import { DownloadMenu, PERIOD_COPIES } from '@/components/DownloadMenu';
import { IconList, IconCheck, IconClock } from '@/components/Icons';
import { Pager, usePaged } from '@/components/Pager';

export default function DailyReportPage() {
  // useSearchParams needs a Suspense boundary above it during prerender.
  return (
    <Suspense fallback={<AppShell title="One day" back><Skeleton className="h-[180px]" /></AppShell>}>
      <DailyReport />
    </Suspense>
  );
}

function DailyReport() {
  // The monthly breakdown deep-links here with ?date=YYYY-MM-DD.
  const initialDate = useSearchParams().get('date');
  const [date, setDate] = useState(initialDate || todayInput());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');

    api(`/reports/daily${qs({ date })}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));

    return () => {
      alive = false;
    };
  }, [date, reload]);

  const txnPage = usePaged(data?.transactions, 20, date);

  return (
    <AppShell
      title="One day"
      subtitle={dateOnly(`${date}T12:00:00`)}
      back
      action={<DownloadMenu params={{ type: 'daily', date }} copies={PERIOD_COPIES} />}
    >
      <div className="space-y-5">
        <PeriodTabs current="daily" date={date} />
        <PeriodPicker type="date" label="Date" value={date} onChange={setDate} />

        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[280px]" />
          </div>
        ) : data ? (
          <div className="space-y-5 rise">
            <ReportHeadline summary={data.summary} />

            <DaySettlement
              date={date}
              summary={data.summary}
              settlements={data.settlements || []}
              onChange={() => setReload((n) => n + 1)}
            />

            <ReportBreakdown summary={data.summary} />

            {data.income && (
              <section>
                <SectionTitle>Also this day</SectionTitle>
                <Card className="ruled py-0">
                  <Row label="Other income" value={data.income.amount} tone="leaf" />
                  <Row label="Expenses" value={data.expense.amount} tone="stamp" />
                  <Row label="Loans taken" value={data.loans.taken.amount} />
                  <Row label="Loan repayments" value={data.loans.repaid.amount} tone="leaf" />
                </Card>
              </section>
            )}

            <section>
              <SectionTitle>{data.transactions.length} {data.transactions.length === 1 ? 'entry' : 'entries'}</SectionTitle>
              {data.transactions.length ? (
                <div className="space-y-2">
                  {txnPage.pageItems.map((t) => (
                    <TransactionCard key={t._id} txn={t} />
                  ))}
                  <Pager className="pt-2" page={txnPage.page} pages={txnPage.pages} total={txnPage.total} onChange={txnPage.setPage} />
                </div>
              ) : (
                <Empty
                  icon={IconList}
                  title="Nothing on this day"
                  hint="Pick another date to see its entries."
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * Day-level settlement: mark the whole day received in one action, recording
 * the amount the card company actually paid and a note. Already-settled days
 * are listed with a Revert.
 */
function DaySettlement({ date, summary, settlements, onChange }) {
  const pendingCount = summary.pendingCount || 0;
  const pendingAmount = summary.pendingAmount || 0;

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const startSettle = () => {
    setAmount(String(pendingAmount));
    setNote('');
    setErr('');
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/settlements/day', {
        method: 'POST',
        body: { date, receivedAmount: Number(amount), note },
      });
      setOpen(false);
      onChange();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const revert = async (id) => {
    if (!confirm('Move this day back to pending?')) return;
    try {
      await api(`/settlements/day/${id}`, { method: 'DELETE' });
      onChange();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  return (
    <section>
      <SectionTitle>Settlement from the card company</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="colhead">Still owed this day</p>
            <p className="sum mt-0.5 text-[22px] text-stamp-500">{money(pendingAmount)}</p>
          </div>
          <StatusPill status={pendingCount ? 'pending' : 'received'} />
        </div>

        <ErrorNote>{err}</ErrorNote>

        {pendingCount > 0 && !open && (
          <Button type="button" variant="stamp" className="w-full" onClick={startSettle}>
            <IconCheck size={16} /> Mark this day received
          </Button>
        )}

        {open && (
          <form onSubmit={submit} className="space-y-3 border-t border-[var(--rule)] pt-3">
            <Field label="Amount received from company" hint={`Expected ${money(pendingAmount)} across ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'}`}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
                <input className="field sum pl-14" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </Field>
            <Field label="Note" hint="Optional — e.g. reference, short amount reason">
              <input className="field" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="soft" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="stamp" className="flex-[2]" loading={busy}>Confirm received</Button>
            </div>
          </form>
        )}

        {settlements.length > 0 && (
          <div className="ruled">
            {settlements.map((s) => (
              <div key={s._id} className="flex items-start gap-3 border-t border-[var(--rule)] pt-3 first:border-t-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="sum text-[15px] text-leaf-600">{money(s.receivedAmount)} <span className="muted-2 text-[11px] !font-normal">received</span></p>
                  <p className="ref mt-0.5 text-[10.5px] muted-2">
                    {dateTime(s.receivedAt)} · {s.txnCount} {s.txnCount === 1 ? 'entry' : 'entries'} · expected {money(s.expectedAmount)}
                  </p>
                  {s.note ? <p className="mt-0.5 text-[12px] muted">{s.note}</p> : null}
                  {Math.abs(s.receivedAmount - s.expectedAmount) > 0.005 && (
                    <p className="mt-0.5 text-[11.5px] text-stamp-500">
                      {s.receivedAmount < s.expectedAmount ? 'Short by ' : 'Over by '}
                      {money(Math.abs(s.receivedAmount - s.expectedAmount))}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => revert(s._id)} className="colhead flex items-center gap-1 !text-stamp-500">
                  <IconClock size={13} /> Revert
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingCount === 0 && settlements.length === 0 && (
          <p className="text-[12.5px] muted-2">Nothing to settle on this day.</p>
        )}
      </Card>
    </section>
  );
}
