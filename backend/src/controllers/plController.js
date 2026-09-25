import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import ProfitSettlement from '../models/ProfitSettlement.js';
import { asyncHandler } from '../middleware/error.js';
import { summarise, moneySum, periodWindow } from './reportController.js';
import { resolveAccount } from './capitalController.js';
import { dayRange, todayStr, TZ } from '../utils/dates.js';
import { round2 } from '../utils/calc.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The window a P/L request covers:
 *   ?period=daily|weekly|monthly&date=YYYY-MM-DD  - that day, its Mon-Sun week or its month
 *   ?period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD  - both days included
 *   ?month=YYYY-MM                                  - older links, same as monthly
 *   anything else                                   - all time (range null)
 */
export function plWindow(query) {
  if (/^\d{4}-\d{2}$/.test(query.month || '') && !query.period) {
    const w = periodWindow('monthly', `${query.month}-01`);
    return { period: 'monthly', range: w, label: w.label };
  }

  const period = query.period;
  if (['daily', 'weekly', 'monthly'].includes(period)) {
    const date = DAY.test(query.date || '') ? query.date : todayStr();
    const w = periodWindow(period, date);
    return { period, date, range: w, label: w.label };
  }

  if (period === 'custom' && DAY.test(query.from || '') && DAY.test(query.to || '')) {
    const [a, b] = query.from <= query.to ? [query.from, query.to] : [query.to, query.from];
    const range = { from: dayRange(a).from, to: dayRange(b).to };
    return { period, from: a, to: b, range, label: a === b ? a : `${a} to ${b}` };
  }

  return { period: 'all', range: null, label: 'All time' };
}

/** What vendor settlements paid over (+) or under (-) what was owed. */
async function vendorDifference(ownerId, range) {
  const match = { shopOwner: ownerId, machine: { $ne: null } };
  if (range) match.receivedAt = { $gte: range.from, $lt: range.to };
  const [row] = await Settlement.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$difference' } } },
  ]);
  return round2(row?.amount || 0);
}

/**
 * Profit and loss over a window, or all time when `range` is null.
 *
 * Swipe profit only counts swipes whose settlement has landed, the same as
 * everywhere else in the book; what is still pending is reported beside it as
 * expected, but kept out of the net.
 */
export async function profitAndLoss(ownerId, range) {
  const [received, pending, settleDiff, income, expense, settled] = await Promise.all([
    summarise(ownerId, range, { settlementStatus: 'received' }),
    summarise(ownerId, range, { settlementStatus: 'pending' }),
    vendorDifference(ownerId, range),
    moneySum(Income, ownerId, range),
    moneySum(Expense, ownerId, range),
    moneySum(ProfitSettlement, ownerId, range),
  ]);

  const net = round2(received.profit + settleDiff + income.amount - expense.amount);
  return {
    swipeProfit: received.profit,
    swipeCount: received.count,
    settleDiff,
    income: income.amount,
    incomeCount: income.count,
    expense: expense.amount,
    expenseCount: expense.count,
    net,
    // Margin on swipes the card company has not paid yet: profit to come.
    pendingMargin: pending.margin,
    pendingCount: pending.count,
    settled: settled.amount,
    settledCount: settled.count,
    unsettled: round2(net - settled.amount),
  };
}

/**
 * Day-by-day P/L inside a window, only days that had something on them:
 * swipe profit (settled swipes, by swipe day), settlement extra/short, other
 * income and expenses, and the profit shared out that day.
 */
async function plByDay(ownerId, range) {
  const tz = TZ();
  const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: tz } });
  const inRange = (field) => (range ? { [field]: { $gte: range.from, $lt: range.to } } : {});
  const byDay = (Model, match, dateField, amount) =>
    Model.aggregate([
      { $match: { shopOwner: ownerId, ...match, ...inRange(dateField) } },
      { $group: { _id: day('$' + dateField), amount: { $sum: amount } } },
    ]);

  const [swipes, diffs, incomes, expenses, settled] = await Promise.all([
    byDay(Transaction, { settlementStatus: 'received' }, 'txnDate', { $ifNull: ['$profit', 0] }),
    byDay(Settlement, { machine: { $ne: null } }, 'receivedAt', '$difference'),
    byDay(Income, {}, 'entryDate', '$amount'),
    byDay(Expense, {}, 'entryDate', '$amount'),
    byDay(ProfitSettlement, {}, 'entryDate', '$amount'),
  ]);

  const days = new Map();
  const add = (rows, key) =>
    rows.forEach((r) => {
      const d = days.get(r._id) || { date: r._id, swipeProfit: 0, settleDiff: 0, income: 0, expense: 0, settled: 0 };
      d[key] = round2(d[key] + r.amount);
      days.set(r._id, d);
    });
  add(swipes, 'swipeProfit');
  add(diffs, 'settleDiff');
  add(incomes, 'income');
  add(expenses, 'expense');
  add(settled, 'settled');

  return [...days.values()]
    .map((d) => ({ ...d, net: round2(d.swipeProfit + d.settleDiff + d.income - d.expense) }))
    .filter((d) => d.swipeProfit || d.settleDiff || d.income || d.expense || d.settled)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * GET /pl?period=daily|weekly|monthly|custom|all  (see plWindow)
 * The window's P/L, its day-by-day breakdown and the profit shared out in it.
 * `allTime` always carries the running position, so the screen can show how
 * much profit is still to be shared out whatever window is open.
 */
export const plReport = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const win = plWindow(req.query);
  const { range } = win;

  const settledMatch = { shopOwner: ownerId };
  if (range) settledMatch.entryDate = { $gte: range.from, $lt: range.to };

  const [summary, allTime, days, settlements, byPartner] = await Promise.all([
    profitAndLoss(ownerId, range),
    range ? profitAndLoss(ownerId, null) : null,
    // One day needs no breakdown.
    win.period === 'daily' ? [] : plByDay(ownerId, range),
    ProfitSettlement.find(settledMatch).sort({ entryDate: -1, createdAt: -1 }).lean(),
    // Who has taken how much, all time.
    ProfitSettlement.aggregate([
      { $match: { shopOwner: ownerId } },
      { $sort: { entryDate: 1 } },
      {
        $group: {
          _id: '$account',
          name: { $last: '$partnerName' },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
          lastAt: { $max: '$entryDate' },
        },
      },
      { $sort: { amount: -1 } },
    ]),
  ]);

  res.json({
    period: win.period,
    label: win.label,
    summary,
    allTime: allTime || summary,
    days,
    settlements,
    byPartner: byPartner.map((p) => ({
      accountId: p._id,
      name: p.name,
      amount: round2(p.amount),
      count: p.count,
      lastAt: p.lastAt,
    })),
  });
});

/** Share profit out to a partner. Cash leaves the drawer. */
export const createProfitSettlement = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.amount) > 0)) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  const account = await resolveAccount(body, req.shopId, req.user._id);
  const settlement = await ProfitSettlement.create({
    shopOwner: req.shopId,
    account: account._id,
    partnerName: account.name,
    amount: round2(body.amount),
    entryDate: body.entryDate || Date.now(),
    notes: body.notes || '',
    createdBy: req.user._id,
  });
  res.status(201).json({ settlement });
});

export const deleteProfitSettlement = asyncHandler(async (req, res) => {
  const settlement = await ProfitSettlement.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!settlement) return res.status(404).json({ message: 'Settlement not found' });
  res.json({ message: `${settlement.settlementNumber} removed` });
});
