import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan, { directionMatch } from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import Capital from '../models/Capital.js';
import CapitalWithdrawal from '../models/CapitalWithdrawal.js';
import CardMachine from '../models/CardMachine.js';
import Settlement from '../models/Settlement.js';
import OpeningBalance from '../models/OpeningBalance.js';
import ProfitSettlement from '../models/ProfitSettlement.js';
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

// `extra` narrows the match further, e.g. { machine } for one machine's report.
const txnMatch = (ownerId, range, extra = {}) => {
  const match = { shopOwner: ownerId, ...extra };
  if (range) match.txnDate = { $gte: range.from, $lt: range.to };
  return match;
};

/** Transaction summary for any date window, scoped to one owner. */
export async function summarise(ownerId, range, extra) {
  const [row] = await Transaction.aggregate([
    { $match: txnMatch(ownerId, range, extra) },
    { $group: { _id: null, ...SUM_STAGE } },
  ]);
  return tidy(row);
}

/**
 * Amount + count for a simple money model (Income / Expense / Loan).
 * `extra` narrows the match, e.g. directionMatch('receivable') for loans.
 */
export async function moneySum(Model, ownerId, range, field = 'amount', extra = {}) {
  const match = { shopOwner: ownerId, ...extra };
  if (range) match.entryDate = { $gte: range.from, $lt: range.to };
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$' + field }, count: { $sum: 1 } } },
  ]);
  return { amount: round2(row?.amount || 0), count: row?.count || 0 };
}

/** All-time position of one side of the loan book. */
async function loanSide(ownerId, direction) {
  const [row] = await Loan.aggregate([
    { $match: { shopOwner: ownerId, ...directionMatch(direction) } },
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

/**
 * All-time loan position. The top level is the payable side - cash taken in,
 * repaid, still owed to lenders - and `receivable` is the cash the shop has
 * lent out: `taken` given, `repaid` collected back, `outstanding` still due.
 */
export async function loanTotals(ownerId) {
  const [payable, receivable] = await Promise.all([
    loanSide(ownerId, 'payable'),
    loanSide(ownerId, 'receivable'),
  ]);
  return { ...payable, receivable };
}

/** All-time capital position: put in by partners, withdrawn, still in the shop. */
export async function capitalTotals(ownerId) {
  const [row] = await Capital.aggregate([
    { $match: { shopOwner: ownerId } },
    {
      $group: {
        _id: null,
        invested: { $sum: '$amount' },
        withdrawn: { $sum: '$withdrawnAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
  const invested = round2(row?.invested || 0);
  const withdrawn = round2(row?.withdrawn || 0);
  return {
    invested,
    withdrawn,
    balance: round2(Math.max(0, invested - withdrawn)),
    count: row?.count || 0,
  };
}

/**
 * Loan movements inside a date window (for period reports): payable loans
 * taken and repaid, and receivable loans given out and collected back.
 */
async function loanActivity(ownerId, range) {
  const payable = directionMatch('payable');
  const receivable = directionMatch('receivable');
  const [taken, repaid, given, collected] = await Promise.all([
    moneySum(Loan, ownerId, range, 'principal', payable),
    moneySum(LoanSettlement, ownerId, range, 'amount', payable),
    moneySum(Loan, ownerId, range, 'principal', receivable),
    moneySum(LoanSettlement, ownerId, range, 'amount', receivable),
  ]);
  return { taken, repaid, given, collected };
}

/**
 * Cash actually in the drawer, all time: the opening balance, capital and the
 * loan float that came in, less what has been repaid, withdrawn, lent out,
 * shared out as profit and handed to customers, plus what the card company,
 * borrowers paying back and other income have brought in.
 */
export async function cashPosition(ownerId) {
  const payable = directionMatch('payable');
  const receivable = directionMatch('receivable');
  const [
    txns, loans, repaid, income, expense, opening, capital, withdrawn, vendorDiff,
    lent, collected, profitOut,
  ] = await Promise.all([
    summarise(ownerId, null),
    moneySum(Loan, ownerId, null, 'principal', payable),
    moneySum(LoanSettlement, ownerId, null, 'amount', payable),
    moneySum(Income, ownerId, null),
    moneySum(Expense, ownerId, null),
    moneySum(OpeningBalance, ownerId, null),
    moneySum(Capital, ownerId, null),
    moneySum(CapitalWithdrawal, ownerId, null),
    // Vendor settlements settle swipes at what was owed; what the company paid
    // over (+) or under (-) that is held here.
    moneySum(Settlement, ownerId, null, 'difference'),
    moneySum(Loan, ownerId, null, 'principal', receivable),
    moneySum(LoanSettlement, ownerId, null, 'amount', receivable),
    moneySum(ProfitSettlement, ownerId, null),
  ]);

  return {
    inHand: round2(
      opening.amount + capital.amount - withdrawn.amount + loans.amount - repaid.amount -
        lent.amount + collected.amount - profitOut.amount -
        txns.givenAmount + txns.receivedAmount + vendorDiff.amount + income.amount - expense.amount
    ),
    vendorDifference: vendorDiff.amount,
    opening: opening.amount,
    capitalIn: capital.amount,
    capitalWithdrawn: withdrawn.amount,
    loanTaken: loans.amount,
    loanRepaid: repaid.amount,
    loanLent: lent.amount,
    loanCollected: collected.amount,
    profitSettled: profitOut.amount,
    givenOut: txns.givenAmount,
    settled: txns.receivedAmount,
    income: income.amount,
    expense: expense.amount,
  };
}

export const dashboard = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const date = req.query.date || todayStr();
  const today = dayRange(date);
  const month = monthRange(date.slice(0, 7));

  const [todayStats, monthStats, allTime, recent, todayIncome, todayExpense, loans, cash, capital, byCompany] =
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
      capitalTotals(ownerId),
      pendingByCompany(ownerId),
    ]);

  res.json({
    date,
    today: todayStats,
    month: monthStats,
    income: { today: todayIncome },
    expense: { today: todayExpense },
    loans,
    capital,
    cash,
    // Settlement is a running balance, so it is reported across all time.
    settlement: {
      receivedAmount: allTime.receivedAmount,
      pendingAmount: allTime.pendingAmount,
      receivedCount: allTime.receivedCount,
      pendingCount: allTime.pendingCount,
      byCompany,
    },
    recent,
  });
});

export const dailyReport = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
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
  const ownerId = req.shopId;
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
  const ownerId = req.shopId;
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
  const ownerId = req.shopId;
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

/**
 * What each card company still holds on pending swipes, largest first.
 * Machines with the same company are added together; a machine with no
 * company set stands in under its own name.
 */
async function pendingByCompany(ownerId) {
  const raw = await Transaction.aggregate([
    { $match: { shopOwner: ownerId, settlementStatus: 'pending' } },
    { $group: { _id: '$machine', ...SUM_STAGE } },
  ]);
  const byCompany = new Map();
  for (const m of await withMachineNames(ownerId, raw)) {
    const name = m.cardCompany || m.machineName;
    const row = byCompany.get(name) || { company: name, pendingAmount: 0, pendingCount: 0, machines: 0, machineIds: [] };
    row.pendingAmount = round2(row.pendingAmount + m.pendingAmount);
    row.pendingCount += m.pendingCount;
    row.machines += 1;
    // So the dashboard can open this company's settlement page.
    row.machineIds.push(m.machineId);
    byCompany.set(name, row);
  }
  return [...byCompany.values()].sort((a, b) => b.pendingAmount - a.pendingAmount);
}

export const customerReport = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
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
  const ownerId = req.shopId;
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

const PERIODS = ['daily', 'weekly', 'monthly'];

/**
 * The window a period report covers, from the day being looked at:
 * that day, the Mon-Sun week holding it, or its month.
 */
export function periodWindow(period, date) {
  if (period === 'weekly') {
    const r = weekRange(date);
    return { ...r, label: `${r.start} to ${r.end}` };
  }
  if (period === 'monthly') {
    const month = date.slice(0, 7);
    return { ...monthRange(month), label: month };
  }
  return { ...dayRange(date), label: date };
}

/**
 * One card machine over a day, week or month: its totals, a day-by-day
 * breakdown and every swipe taken on it.
 */
export const machinePeriodReport = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const machine = await CardMachine.findOne({ _id: req.params.id, shopOwner: ownerId }).lean();
  if (!machine) return res.status(404).json({ message: 'Card machine not found' });

  const period = PERIODS.includes(req.query.period) ? req.query.period : 'daily';
  const date = req.query.date || todayStr();
  const range = periodWindow(period, date);
  // Aggregations do not cast ids, so match on the stored ObjectId itself.
  const only = { machine: machine._id };
  const match = txnMatch(ownerId, range, only);

  const [summary, days, transactions] = await Promise.all([
    summarise(ownerId, range, only),
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
    Transaction.find(match).populate('customer', 'name mobile').sort({ txnDate: 1 }).lean(),
  ]);

  res.json({
    machine: {
      _id: machine._id,
      name: machine.name,
      cardCompany: machine.cardCompany || '',
      machineNumber: machine.machineNumber || '',
    },
    period,
    date,
    label: range.label,
    summary,
    days: days.map((d) => ({ date: d._id, ...tidy(d) })),
    transactions,
  });
});

export const settlementReport = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const [summary, pending] = await Promise.all([
    summarise(ownerId, null),
    Transaction.find({ shopOwner: ownerId, settlementStatus: 'pending' })
      .populate('customer', 'name mobile')
      .sort({ txnDate: 1 })
      .lean(),
  ]);
  res.json({ summary, pending });
});
