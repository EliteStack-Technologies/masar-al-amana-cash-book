import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import Capital from '../models/Capital.js';
import CapitalWithdrawal from '../models/CapitalWithdrawal.js';
import Settlement from '../models/Settlement.js';
import OpeningBalance from '../models/OpeningBalance.js';
import ProfitSettlement from '../models/ProfitSettlement.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

/**
 * One ledger for the whole book. Every entry the shop makes - opening
 * balances, swipes, the settlements that pay them back, loans taken in and
 * repaid, loans lent out and collected back, capital put in and withdrawn,
 * profit shared out, income and expenses - lands here as a single cash-in or
 * cash-out line.
 *
 * A swipe puts out two separate lines: the cash handed over on the day of the
 * swipe, and the company's payment on the day it actually arrived. That is
 * what makes the running balance match the drawer.
 */
const IN = 'in';
const OUT = 'out';

const line = (o) => ({ ...o, amount: round2(o.amount) });

async function collect(ownerId, from, to) {
  const inWindow = (d) => (!from || d >= from) && (!to || d < to);
  const rangeMatch = (field) => {
    const m = { shopOwner: ownerId };
    if (from || to) {
      m[field] = {};
      if (from) m[field].$gte = from;
      if (to) m[field].$lt = to;
    }
    return m;
  };

  const [txns, loans, repayments, incomes, expenses, openings, capitals, withdrawals, vendorDiffs, profitOuts] = await Promise.all([
    // Swipes are pulled on either date, then split into their two lines.
    Transaction.find({
      shopOwner: ownerId,
      ...(from || to
        ? { $or: [rangeMatch('txnDate'), rangeMatch('receivedAt')] }
        : {}),
    })
      .populate('machine', 'name cardCompany')
      .sort({ txnDate: 1 })
      .lean(),
    Loan.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    LoanSettlement.find(rangeMatch('entryDate')).populate('loan', 'loanNumber lenderName direction').sort({ entryDate: 1 }).lean(),
    Income.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    Expense.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    OpeningBalance.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    Capital.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    CapitalWithdrawal.find(rangeMatch('entryDate')).populate('capital', 'capitalNumber partnerName').sort({ entryDate: 1 }).lean(),
    // Vendor settlements whose payment did not match what was owed.
    Settlement.find({ ...rangeMatch('receivedAt'), machine: { $ne: null }, difference: { $ne: 0 } })
      .populate('machine', 'name cardCompany')
      .sort({ receivedAt: 1 })
      .lean(),
    ProfitSettlement.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
  ]);

  const rows = [];

  for (const o of openings) {
    rows.push(line({
      id: String(o._id),
      date: o.entryDate,
      kind: 'opening',
      direction: IN,
      amount: o.amount,
      ref: o.openingNumber,
      title: 'Opening balance',
      detail: o.notes || '',
      notes: o.notes || '',
      // Opening balances are added and edited on their own page (More).
      link: '/opening',
    }));
  }

  for (const t of txns) {
    const who = t.customerName || 'Walk-in';
    // Swipes are told apart by the machine and the supplier % the swipe was
    // charged at (snapshotted on the swipe), not by their txn number.
    const machineRef = `${t.machine?.name || 'Machine'} · ${+Number(t.supplierPercent || 0).toFixed(4)}%`;
    if (inWindow(t.txnDate)) {
      rows.push(line({
        date: t.txnDate,
        kind: 'swipe',
        direction: OUT,
        amount: t.givenAmount,
        ref: machineRef,
        title: `Cash to ${who}`,
        detail: `Swiped ${t.swipedAmount} - charge ${t.chargeToCustomer}`,
        link: `/transactions/${t._id}`,
      }));
    }
    if (t.settlementStatus === 'received' && t.receivedAt && inWindow(t.receivedAt)) {
      rows.push(line({
        date: t.receivedAt,
        kind: 'settlement',
        direction: IN,
        amount: t.settlementAmount ?? t.supplierAccount,
        ref: machineRef,
        title: `Settlement - ${t.machine?.cardCompany || t.machine?.name || 'card company'}`,
        detail: `Profit ${round2((t.settlementAmount ?? t.supplierAccount) - t.givenAmount)}`,
        link: `/transactions/${t._id}`,
      }));
    }
  }

  // A payable loan brings cash in and its repayments take it out; a
  // receivable loan is the other way round.
  for (const l of loans) {
    const lent = l.direction === 'receivable';
    rows.push(line({
      date: l.entryDate,
      kind: lent ? 'lend' : 'loan',
      direction: lent ? OUT : IN,
      amount: l.principal,
      ref: l.loanNumber,
      title: lent ? `Loan to ${l.lenderName}` : `Loan from ${l.lenderName}`,
      detail: l.notes || '',
      link: `/loans/${l._id}`,
    }));
  }

  for (const r of repayments) {
    const collected = (r.loan?.direction || r.direction) === 'receivable';
    rows.push(line({
      date: r.entryDate,
      kind: collected ? 'collection' : 'repayment',
      direction: collected ? IN : OUT,
      amount: r.amount,
      ref: r.loan?.loanNumber || '',
      title: collected
        ? `Collected from ${r.loan?.lenderName || 'borrower'}`
        : `Repaid ${r.loan?.lenderName || 'lender'}`,
      detail: r.notes || '',
      link: r.loan ? `/loans/${r.loan._id}` : '',
    }));
  }

  // A vendor settlement settles its swipes at what they were owed, so the
  // cash the company paid over or under that is its own line.
  for (const s of vendorDiffs) {
    const extra = s.difference > 0;
    rows.push(line({
      date: s.receivedAt,
      kind: 'settle-diff',
      direction: extra ? IN : OUT,
      amount: Math.abs(s.difference),
      ref: '',
      title: `Settlement ${extra ? 'extra' : 'short'} - ${s.machine?.cardCompany || s.machine?.name || 'card company'}`,
      detail: `Paid ${s.receivedAmount} for ${s.expectedAmount} due`,
      link: s.machine ? `/settlements/machine/${s.machine._id}` : '',
    }));
  }

  for (const c of capitals) {
    rows.push(line({
      date: c.entryDate,
      kind: 'capital',
      direction: IN,
      amount: c.amount,
      ref: c.capitalNumber,
      title: `Capital from ${c.partnerName}`,
      detail: c.notes || '',
      link: `/capital/${c._id}`,
    }));
  }

  for (const w of withdrawals) {
    rows.push(line({
      date: w.entryDate,
      kind: 'withdrawal',
      direction: OUT,
      amount: w.amount,
      ref: w.capital?.capitalNumber || '',
      title: `Capital withdrawn by ${w.capital?.partnerName || 'partner'}`,
      detail: w.notes || '',
      link: w.capital ? `/capital/${w.capital._id}` : '',
    }));
  }

  for (const p of profitOuts) {
    rows.push(line({
      date: p.entryDate,
      kind: 'profit-out',
      direction: OUT,
      amount: p.amount,
      ref: p.settlementNumber,
      title: `Profit to ${p.partnerName}`,
      detail: p.notes || '',
      link: '/pl',
    }));
  }

  for (const i of incomes) {
    rows.push(line({
      date: i.entryDate,
      kind: 'income',
      direction: IN,
      amount: i.amount,
      ref: i.incomeNumber,
      title: i.category || 'Income',
      detail: i.receiver ? `From ${i.receiver}` : '',
      link: `/income`,
    }));
  }

  for (const e of expenses) {
    rows.push(line({
      date: e.entryDate,
      kind: 'expense',
      direction: OUT,
      amount: e.amount,
      ref: e.expenseNumber,
      title: e.category || 'Expense',
      detail: e.payee ? `To ${e.payee}` : '',
      link: `/expenses`,
    }));
  }

  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  return rows;
}

/** Net cash movement of a set of ledger lines. */
const net = (rows) =>
  round2(rows.reduce((sum, r) => sum + (r.direction === IN ? r.amount : -r.amount), 0));

export const cashbook = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if (to) to.setDate(to.getDate() + 1); // ?to= is inclusive of that whole day

  const [rows, before] = await Promise.all([
    collect(ownerId, from, to),
    from ? collect(ownerId, null, from) : Promise.resolve([]),
  ]);

  const opening = net(before);
  let balance = opening;
  const ledger = rows.map((r) => {
    balance = round2(balance + (r.direction === IN ? r.amount : -r.amount));
    return { ...r, balance };
  });

  const totalIn = round2(rows.filter((r) => r.direction === IN).reduce((s, r) => s + r.amount, 0));
  const totalOut = round2(rows.filter((r) => r.direction === OUT).reduce((s, r) => s + r.amount, 0));

  res.json({
    from: req.query.from || null,
    to: req.query.to || null,
    opening,
    totalIn,
    totalOut,
    closing: round2(opening + totalIn - totalOut),
    count: ledger.length,
    // Newest first for reading; the balance column was built oldest first.
    ledger: ledger.reverse(),
  });
});
