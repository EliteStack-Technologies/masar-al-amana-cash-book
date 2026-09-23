import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import CardMachine from '../models/CardMachine.js';
import Settlement from '../models/Settlement.js';
import OpeningBalance from '../models/OpeningBalance.js';
import { asyncHandler } from '../middleware/error.js';
import { dayRange, weekRange, monthRange, todayStr, TZ } from '../utils/dates.js';
import { round2 } from '../utils/calc.js';

const EMPTY = {
  count: 0, swipedAmount: 0, givenAmount: 0, chargeToCustomer: 0,
  supplierFee: 0, supplierAccount: 0, margin: 0, profit: 0,
  receivedAmount: 0, pendingAmount: 0, receivedCount: 0, pendingCount: 0,
};

const SUM_STAGE = {
  count: { $sum: 1 },
  swipedAmount: { $sum: '$swipedAmount' },
  givenAmount: { $sum: '$givenAmount' },
  chargeToCustomer: { $sum: '$chargeToCustomer' },
  supplierFee: { $sum: '$supplierFee' },
  supplierAccount: { $sum: '$supplierAccount' },
  margin: { $sum: '$margin' },
  // Real profit, so it only counts rows whose money has actually landed.
  profit: { $sum: { $ifNull: ['$profit', 0] } },
  receivedAmount: {
    $sum: { $cond: [{ $eq: ['$settlementStatus', 'received'] }, '$settlementAmount', 0] },
  },
  // Still sitting with the card company: what it owes, not what it paid.
  pendingAmount: {
    $sum: { $cond: [{ $eq: ['$settlementStatus', 'pending'] }, '$supplierAccount', 0] },
  },
  receivedCount: {
    $sum: { $cond: [{ $eq: ['$settlementStatus', 'received'] }, 1, 0] },
  },
  pendingCount: {
    $sum: { $cond: [{ $eq: ['$settlementStatus', 'pending'] }, 1, 0] },
  },
};

const tidy = (row) => {
  const out = { ...EMPTY, ...(row || {}) };
  delete out._id;
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'number') out[k] = round2(out[k]);
  }
  return out;
};

const txnMatch = (ownerId, range) => {
  const match = { shopOwner: ownerId };
  if (range) match.txnDate = { $gte: range.from, $lt: range.to };
  return match;
};

/** Transaction summary for any date window, scoped to one owner. */
export async function summarise(ownerId, range) {
  const [row] = await Transaction.aggregate([
    { $match: txnMatch(ownerId, range) },
    { $group: { _id: null, ...SUM_STAGE } },
  ]);
  return tidy(row);
}

/** Amount + count for a simple money model (Income / Expense / Loan). */
export async function moneySum(Model, ownerId, range, field = 'amount') {
  const match = { shopOwner: ownerId };
  if (range) match.entryDate = { $gte: range.from, $lt: range.to };
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$' + field }, count: { $sum: 1 } } },
  ]);
  return { amount: round2(row?.amount || 0), count: row?.count || 0 };
}

/** All-time loan position: cash taken in, repaid, still owed to lenders. */
export async function loanTotals(ownerId) {
  const [row] = await Loan.aggregate([
    { $match: { shopOwner: ownerId } },
    {
      $group: {
        _id: null,
        taken: { $sum: '$principal' },
        repaid: { $sum: '$settledAmount' },
        count: { $sum: 1 },
        openCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
      },
    },
  ]);
  const taken = round2(row?.taken || 0);
  const repaid = round2(row?.repaid || 0);
  return {
    taken,
    repaid,
    outstanding: round2(Math.max(0, taken - repaid)),
    count: row?.count || 0,
    openCount: row?.openCount || 0,
  };
}

/** Loans taken + repayments made inside a date window (for period reports). */
async function loanActivity(ownerId, range) {
  const [givenRow] = await Loan.aggregate([
    { $match: { shopOwner: ownerId, entryDate: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, amount: { $sum: '$principal' }, count: { $sum: 1 } } },
  ]);
  const [repaidRow] = await LoanSettlement.aggregate([
    { $match: { shopOwner: ownerId, entryDate: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return {
    taken: { amount: round2(givenRow?.amount || 0), count: givenRow?.count || 0 },
    repaid: { amount: round2(repaidRow?.amount || 0), count: repaidRow?.count || 0 },
  };
}

/**
 * Cash actually in the drawer, all time: the opening balance and the loan
 * float that came in, less what has been repaid and handed to customers, plus
 * what the card company and other income have paid back.
 */
export async function cashPosition(ownerId) {
  const [txns, loans, repaid, income, expense, opening] = await Promise.all([
    summarise(ownerId, null),
    moneySum(Loan, ownerId, null, 'principal'),
    moneySum(LoanSettlement, ownerId, null),
    moneySum(Income, ownerId, null),
    moneySum(Expense, ownerId, null),
    moneySum(OpeningBalance, ownerId, null),
  ]);

  return {
    inHand: round2(
      opening.amount + loans.amount - repaid.amount - txns.givenAmount + txns.receivedAmount +
        income.amount - expense.amount
    ),
    opening: opening.amount,
    loanTaken: loans.amount,
    loanRepaid: repaid.amount,
    givenOut: txns.givenAmount,
    settled: txns.receivedAmount,
    income: income.amount,
    expense: expense.amount,
  };
}

export const dashboard = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const date = req.query.date || todayStr();
  const today = dayRange(date);
  const month = monthRange(date.slice(0, 7));

  const [todayStats, monthStats, allTime, recent, todayIncome, todayExpense, loans, cash] =
    await Promise.all([
      summarise(ownerId, today),
      summarise(ownerId, month),
      summarise(ownerId, null),
      Transaction.find({ shopOwner: ownerId })
        .populate('customer', 'name mobile')
        .sort({ txnDate: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      moneySum(Income, ownerId, today),
      moneySum(Expense, ownerId, today),
      loanTotals(ownerId),
      cashPosition(ownerId),
    ]);

  res.json({
    date,
    today: todayStats,
    month: monthStats,
    income: { today: todayIncome },
    expense: { today: todayExpense },
    loans,
    cash,
    // Settlement is a running balance, so it is reported across all time.
    settlement: {
      receivedAmount: allTime.receivedAmount,
      pendingAmount: allTime.pendingAmount,
      receivedCount: allTime.receivedCount,
      pendingCount: allTime.pendingCount,
    },
    recent,
  });
});

export const dailyReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const date = req.query.date || todayStr();
  const range = dayRange(date);

  const [summary, transactions, income, expense, loans, settlements] = await Promise.all([
    summarise(ownerId, range),
    Transaction.find({ shopOwner: ownerId, txnDate: { $gte: range.from, $lt: range.to } })
      .populate('customer', 'name mobile')
      .sort({ txnDate: 1 })
      .lean(),
    moneySum(Income, ownerId, range),
    moneySum(Expense, ownerId, range),
    loanActivity(ownerId, range),
    Settlement.find({ shopOwner: ownerId, settleDate: date }).sort({ receivedAt: -1 }).lean(),
  ]);

  res.json({ date, summary, transactions, income, expense, loans, settlements });
});

export const weeklyReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const date = req.query.date || todayStr();
  const range = weekRange(date);
  const match = txnMatch(ownerId, range);

  const [summary, days, income, expense, loans] = await Promise.all([
    summarise(ownerId, range),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$txnDate', timezone: TZ() } },
          ...SUM_STAGE,
        },
      },
      { $sort: { _id: 1 } },
    ]),
    moneySum(Income, ownerId, range),
    moneySum(Expense, ownerId, range),
    loanActivity(ownerId, range),
  ]);

  res.json({
    date,
    start: range.start,
    end: range.end,
    summary,
    income,
    expense,
    loans,
    days: days.map((d) => ({ date: d._id, ...tidy(d) })),
  });
});

export const monthlyReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const month = req.query.month || todayStr().slice(0, 7);
  const range = monthRange(month);
  const match = txnMatch(ownerId, range);

  const [summary, days, income, expense, loans] = await Promise.all([
    summarise(ownerId, range),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$txnDate', timezone: TZ() } },
          ...SUM_STAGE,
        },
      },
      { $sort: { _id: 1 } },
    ]),
    moneySum(Income, ownerId, range),
    moneySum(Expense, ownerId, range),
    loanActivity(ownerId, range),
  ]);

  res.json({
    month,
    summary,
    income,
    expense,
    loans,
    days: days.map((d) => ({ date: d._id, ...tidy(d) })),
  });
});

export const commissionReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const month = req.query.month || todayStr().slice(0, 7);
  const range = monthRange(month);
  const match = txnMatch(ownerId, range);

  const [summary, byPercent, bySupplierRate, byCustomer, byMachineRaw] = await Promise.all([
    summarise(ownerId, range),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$custPercent', ...SUM_STAGE } },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$supplierPercent', ...SUM_STAGE } },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$customer',
          customerName: { $first: '$customerName' },
          customerMobile: { $first: '$customerMobile' },
          ...SUM_STAGE,
        },
      },
      { $sort: { margin: -1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$machine', ...SUM_STAGE } },
      { $sort: { margin: -1 } },
    ]),
  ]);

  const byMachine = await withMachineNames(ownerId, byMachineRaw);

  const avg = summary.swipedAmount
    ? round2((summary.chargeToCustomer / summary.swipedAmount) * 100)
    : 0;

  res.json({
    month,
    summary: { ...summary, averageCustPercent: avg },
    byPercent: byPercent.map((r) => ({ custPercent: r._id, ...tidy(r) })),
    bySupplierRate: bySupplierRate.map((r) => ({ supplierPercent: r._id, ...tidy(r) })),
    byCustomer: byCustomer.map((r) => ({
      customerId: r._id,
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      ...tidy(r),
    })),
    byMachine,
  });
});

/** Attaches machine name/company to machine-grouped aggregation rows. */
async function withMachineNames(ownerId, rows) {
  const machines = await CardMachine.find({ shopOwner: ownerId }).select('name cardCompany').lean();
  const byId = new Map(machines.map((m) => [String(m._id), m]));
  return rows.map((r) => {
    const m = byId.get(String(r._id));
    return {
      machineId: r._id,
      machineName: m?.name || 'Unknown machine',
      cardCompany: m?.cardCompany || '',
      ...tidy(r),
    };
  });
}

export const customerReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const month = req.query.month;
  const range = month ? monthRange(month) : null;

  const rows = await Transaction.aggregate([
    { $match: txnMatch(ownerId, range) },
    {
      $group: {
        _id: '$customer',
        customerName: { $first: '$customerName' },
        customerMobile: { $first: '$customerMobile' },
        ...SUM_STAGE,
      },
    },
    { $sort: { swipedAmount: -1 } },
  ]);

  res.json({
    month: month || null,
    summary: await summarise(ownerId, range),
    customers: rows.map((r) => ({
      customerId: r._id,
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      ...tidy(r),
    })),
  });
});

export const machineReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const month = req.query.month;
  const range = month ? monthRange(month) : null;

  const raw = await Transaction.aggregate([
    { $match: txnMatch(ownerId, range) },
    { $group: { _id: '$machine', ...SUM_STAGE } },
    { $sort: { swipedAmount: -1 } },
  ]);

  res.json({
    month: month || null,
    summary: await summarise(ownerId, range),
    machines: await withMachineNames(ownerId, raw),
  });
});

export const settlementReport = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const [summary, pending] = await Promise.all([
    summarise(ownerId, null),
    Transaction.find({ shopOwner: ownerId, settlementStatus: 'pending' })
      .populate('customer', 'name mobile')
      .sort({ txnDate: 1 })
      .lean(),
  ]);
  res.json({ summary, pending });
});
