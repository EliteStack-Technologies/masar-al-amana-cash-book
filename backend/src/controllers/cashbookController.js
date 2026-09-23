import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

/**
 * One ledger for the whole book. Every entry the shop makes - swipes, the
 * settlements that pay them back, loans taken from customers, repayments,
 * income and expenses - lands here as a single cash-in or cash-out line.
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

  const [txns, loans, repayments, incomes, expenses] = await Promise.all([
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
    LoanSettlement.find(rangeMatch('entryDate')).populate('loan', 'loanNumber lenderName').sort({ entryDate: 1 }).lean(),
    Income.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
    Expense.find(rangeMatch('entryDate')).sort({ entryDate: 1 }).lean(),
  ]);

  const rows = [];

  for (const t of txns) {
    const who = t.customerName || 'Walk-in';
    if (inWindow(t.txnDate)) {
      rows.push(line({
        date: t.txnDate,
        kind: 'swipe',
        direction: OUT,
        amount: t.givenAmount,
        ref: t.txnNumber,
        title: `Cash to ${who}`,
        detail: `Swiped ${t.swipedAmount} on ${t.machine?.name || 'machine'} - charge ${t.chargeToCustomer}`,
        link: `/transactions/${t._id}`,
      }));
    }
    if (t.settlementStatus === 'received' && t.receivedAt && inWindow(t.receivedAt)) {
      rows.push(line({
        date: t.receivedAt,
        kind: 'settlement',
        direction: IN,
        amount: t.settlementAmount ?? t.supplierAccount,
        ref: t.txnNumber,
        title: `Settlement - ${t.machine?.cardCompany || t.machine?.name || 'card company'}`,
        detail: `Profit ${round2((t.settlementAmount ?? t.supplierAccount) - t.givenAmount)}`,
        link: `/transactions/${t._id}`,
      }));
    }
  }

  for (const l of loans) {
    rows.push(line({
      date: l.entryDate,
      kind: 'loan',
      direction: IN,
      amount: l.principal,
      ref: l.loanNumber,
      title: `Loan from ${l.lenderName}`,
      detail: l.notes || '',
      link: `/loans/${l._id}`,
    }));
  }

  for (const r of repayments) {
    rows.push(line({
      date: r.entryDate,
      kind: 'repayment',
      direction: OUT,
      amount: r.amount,
      ref: r.loan?.loanNumber || '',
      title: `Repaid ${r.loan?.lenderName || 'lender'}`,
      detail: r.notes || '',
      link: r.loan ? `/loans/${r.loan._id}` : '',
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
  const ownerId = req.user._id;
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
