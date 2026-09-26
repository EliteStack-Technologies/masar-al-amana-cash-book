'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, qs } from '@/lib/api';
import { money, dateOnly, thisMonthInput, todayInput, toLocalInput } from '@/lib/format';
import {
  Button, Card, Empty, ErrorNote, Field, Figure, Row, SectionTitle, Segmented, Skeleton,
} from '@/components/ui';
import { IconChart, IconTrash } from '@/components/Icons';
import { PeriodPicker } from '@/components/ReportBits';
import { DownloadMenu } from '@/components/DownloadMenu';

import { Amt } from '@/components/Amount';
const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
  { value: 'all', label: 'All time' },
];

/** How the open window reads in headings. */
const WINDOW_NAME = {
  daily: 'This day',
  weekly: 'This week',
  monthly: 'This month',
  custom: 'These dates',
  all: 'All time',
};

/** First day of this month, as YYYY-MM-DD. */
const monthStart = () => `${todayInput().slice(0, 7)}-01`;

const emptySettle = () => ({ account: '', partnerName: '', amount: '', entryDate: toLocalInput(), notes: '' });

/**
 * Profit and loss, worked out from the book: swipe profit on settled swipes,
 * what vendor settlements paid over or under, other income, less expenses.
 * Settling shares that profit out to a partner, as cash leaving the drawer.
 */
export default function ProfitLossPage() {
  const [period, setPeriod] = useState('monthly');
  const [date, setDate] = useState(todayInput);
  const [month, setMonth] = useState(thisMonthInput);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayInput);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [partners, setPartners] = useState([]);
  const [settleOpen, setSettleOpen] = useState(false);
  const [form, setForm] = useState(emptySettle);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // The query for the open window; the same one drives the download.
  const params =
    period === 'monthly' ? { period, date: `${month}-01` }
      : period === 'custom' ? { period, from, to }
        : period === 'all' ? { period }
          : { period, date };
  const paramsKey = qs(params);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/pl${paramsKey}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [paramsKey, reload]);

  // Partners are the capital accounts.
  useEffect(() => {
    api('/capital/accounts')
      .then((d) => setPartners(d.items))
      .catch(() => {});
  }, [reload]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickPartner = (e) => {
    const value = e.target.value;
    setAdding(value === '__new');
    setForm((f) => ({ ...f, account: value === '__new' ? '' : value, partnerName: '' }));
  };

  const openSettle = () => {
    setForm({ ...emptySettle(), amount: data.allTime.unsettled > 0 ? String(data.allTime.unsettled) : '' });
    setAdding(false);
    setFormError('');
    setSettleOpen(true);
  };

  const settle = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.account && !form.partnerName.trim()) return setFormError('Choose a partner, or type a name for a new one.');
    if (!(Number(form.amount) > 0)) return setFormError('Amount must be greater than 0.');
    if (Number(form.amount) > data.allTime.unsettled &&
        !confirm(`That is more than the ${money(data.allTime.unsettled)} of profit still unsettled. Settle it anyway?`)) {
      return;
    }

    setBusy(true);
    try {
      await api('/pl/settlements', {
        method: 'POST',
        body: {
          account: form.account || null,
          partnerName: form.partnerName.trim(),
          amount: Number(form.amount),
          entryDate: new Date(form.entryDate).toISOString(),
          notes: form.notes,
        },
      });
      setSettleOpen(false);
      setReload((n) => n + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s) => {
    if (!confirm(`Remove ${s.settlementNumber} (${money(s.amount)} to ${s.partnerName})?`)) return;
    try {
      await api(`/pl/settlements/${s._id}`, { method: 'DELETE' });
      setReload((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const p = data?.summary;
  const all = data?.allTime;
  const loss = p && p.net < 0;

  return (
    <AppShell
      title="Profit & loss"
      subtitle={data ? windowLabel(data) : 'Loading…'}
      back
      action={<DownloadMenu params={{ type: 'pl', ...params }} label="Download P/L" />}
    >
      <div className="space-y-4">
        <Segmented value={period} onChange={setPeriod} options={PERIODS} className="overflow-x-auto" />
        {period === 'daily' ? <PeriodPicker type="date" label="Date" value={date} onChange={setDate} /> : null}
        {period === 'weekly' ? <PeriodPicker type="date" label="Any day in the week" value={date} onChange={setDate} /> : null}
        {period === 'monthly' ? <PeriodPicker type="month" label="Month" value={month} onChange={setMonth} /> : null}
        {period === 'custom' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <PeriodPicker type="date" label="From" value={from} onChange={setFrom} />
            <PeriodPicker type="date" label="To" value={to} onChange={setTo} />
          </div>
        ) : null}
        <ErrorNote>{error}</ErrorNote>

        {!data && !error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[240px]" />
          </div>
        ) : data ? (
          <div className="space-y-5 rise">
            {/* What is still to share out, whatever window is open. */}
            <Card className="p-0">
              <div className="grid grid-cols-2">
                <div className="border-r border-[var(--rule)] p-3.5">
                  <Figure label="Unsettled profit" amount={all.unsettled} tone={all.unsettled < 0 ? 'stamp' : 'leaf'} size="lg" sub="all time, still to share out" />
                </div>
                <div className="p-3.5">
                  <Figure label="Settled to partners" amount={all.settled} size="lg" sub={`of ${money(all.net)} net profit`} />
                </div>
              </div>
              <div className="border-t border-[var(--rule)] p-3.5">
                <Button variant="stamp" className="w-full" onClick={openSettle}>Settle profit</Button>
              </div>
            </Card>

            {settleOpen && (
              <section>
                <SectionTitle>Settle profit to a partner</SectionTitle>
                <Card>
                  <form onSubmit={settle} className="space-y-3.5">
                    <Field label="Partner" hint="From your capital accounts">
                      <select className="field" value={adding ? '__new' : form.account} onChange={pickPartner}>
                        <option value="">Choose a partner</option>
                        {partners.map((a) => (
                          <option key={a._id} value={a._id}>{a.name}</option>
                        ))}
                        <option value="__new">+ New partner</option>
                      </select>
                    </Field>
                    {adding ? (
                      <Field label="New partner name" hint="Saved to your capital accounts">
                        <input className="field" type="text" placeholder="e.g. Rinash" value={form.partnerName} onChange={set('partnerName')} autoFocus required />
                      </Field>
                    ) : null}
                    <Field label="Amount">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sum text-[12.5px] muted-2">AED</span>
                        <input className="field sum pl-14" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} required />
                      </div>
                    </Field>
                    <Field label="Date & time">
                      <input className="field ref" type="datetime-local" value={form.entryDate} onChange={set('entryDate')} required />
                    </Field>
                    <Field label="Notes" hint="Optional">
                      <input className="field ref" type="text" value={form.notes} onChange={set('notes')} />
                    </Field>
                    <ErrorNote>{formError}</ErrorNote>
                    <div className="flex gap-3">
                      <Button type="button" variant="soft" className="flex-1" onClick={() => setSettleOpen(false)}>Cancel</Button>
                      <Button type="submit" variant="stamp" className="flex-[2]" loading={busy}>Save settlement</Button>
                    </div>
                  </form>
                </Card>
              </section>
            )}

            <section>
              <SectionTitle>{WINDOW_NAME[period]}</SectionTitle>
              <Card className="ruled py-0">
                <Row label="Swipe profit" sub={`${p.swipeCount} settled ${p.swipeCount === 1 ? 'swipe' : 'swipes'}`} value={p.swipeProfit} tone="leaf" />
                {p.settleDiff ? (
                  <Row
                    label={p.settleDiff > 0 ? 'Settlements paid extra' : 'Settlements paid short'}
                    value={Math.abs(p.settleDiff)}
                    tone={p.settleDiff > 0 ? 'leaf' : 'stamp'}
                  />
                ) : null}
                <Row label="Other income" sub={`${p.incomeCount} ${p.incomeCount === 1 ? 'entry' : 'entries'}`} value={p.income} tone="leaf" />
                <Row label="Expenses" sub={`${p.expenseCount} ${p.expenseCount === 1 ? 'entry' : 'entries'}`} value={p.expense} tone="stamp" />
                <Row label={loss ? 'Net loss' : 'Net profit'} value={Math.abs(p.net)} tone={loss ? 'stamp' : 'leaf'} strong />
                <Row label="Settled to partners" sub={`${p.settledCount} ${p.settledCount === 1 ? 'payout' : 'payouts'}`} value={p.settled} />
                <Row label="Left unsettled" value={p.unsettled} tone={p.unsettled < 0 ? 'stamp' : undefined} strong />
              </Card>
              {p.pendingCount ? (
                <p className="mt-2 text-[11.5px] leading-snug muted-2">
                  Not counted yet: <Amt value={p.pendingMargin} /> expected margin on {p.pendingCount} {p.pendingCount === 1 ? 'swipe' : 'swipes'} the card company has not paid.
                </p>
              ) : null}
            </section>

            {data.days.length > 1 ? (
              <section>
                <SectionTitle>Day by day</SectionTitle>
                <Card className="ruled py-0">
                  {data.days.map((d) => (
                    <div key={d.date} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13.5px] font-semibold">{dateOnly(`${d.date}T12:00:00`)}</p>
                        <p className={`sum shrink-0 text-[15px] ${d.net < 0 ? 'text-stamp-500 dark:text-stamp-400' : 'text-leaf-500 dark:text-leaf-400'}`}>
                          {d.net < 0 ? '−' : ''}<Amt value={Math.abs(d.net)} />
                        </p>
                      </div>
                      <p className="ref mt-0.5 text-[10.5px] muted-2">
                        {[
                          d.swipeProfit ? `swipes ${money(d.swipeProfit)}` : '',
                          d.settleDiff ? `settle ${d.settleDiff > 0 ? '+' : '−'}${money(Math.abs(d.settleDiff))}` : '',
                          d.income ? `income ${money(d.income)}` : '',
                          d.expense ? `expense ${money(d.expense)}` : '',
                          d.settled ? `settled ${money(d.settled)}` : '',
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </Card>
              </section>
            ) : null}

            {data.byPartner.length ? (
              <section>
                <SectionTitle>Settled by partner · all time</SectionTitle>
                <Card className="ruled py-0">
                  {data.byPartner.map((b) => (
                    <Row
                      key={String(b.accountId)}
                      label={b.name}
                      sub={`${b.count} ${b.count === 1 ? 'payout' : 'payouts'} · last ${dateOnly(b.lastAt)}`}
                      value={b.amount}
                    />
                  ))}
                </Card>
              </section>
            ) : null}

            <section>
              <SectionTitle>
                {data.settlements.length} {data.settlements.length === 1 ? 'settlement' : 'settlements'}
                {period === 'all' ? '' : ` · ${windowLabel(data)}`}
              </SectionTitle>
              {data.settlements.length ? (
                <Card className="ruled py-0">
                  {data.settlements.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{s.partnerName}</p>
                        <p className="ref mt-0.5 text-[10.5px] muted-2">
                          {s.settlementNumber} · {dateOnly(s.entryDate)}{s.notes ? ` · ${s.notes}` : ''}
                        </p>
                      </div>
                      <p className="sum shrink-0 text-[15px] text-stamp-500 dark:text-stamp-400"><Amt value={s.amount} /></p>
                      <button type="button" onClick={() => remove(s)} aria-label="Remove settlement" className="muted-2 active:text-stamp-500">
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ))}
                </Card>
              ) : (
                <Empty
                  icon={IconChart}
                  title="No profit settled"
                  hint="Tap Settle profit to record profit paid out to a partner. It leaves the cash in hand."
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/** The open window in words: "25 Sep 2026", "22 Sep 2026 to 28 Sep 2026", "Sep 2026". */
function windowLabel(data) {
  const day = (d) => dateOnly(`${d}T12:00:00`);
  const label = data.label || '';
  if (/^\d{4}-\d{2}$/.test(label)) return day(`${label}-01`).replace(/^\d+ /, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return day(label);
  const m = label.match(/^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/);
  return m ? `${day(m[1])} to ${day(m[2])}` : label;
}
