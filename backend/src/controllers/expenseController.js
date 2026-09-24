import Expense from '../models/Expense.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

const EDITABLE = ['entryDate', 'amount', 'category', 'payee', 'notes'];

export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };
  if (query.category) filter.category = query.category;

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ category: rx }, { payee: rx }, { expenseNumber: rx }, { notes: rx }];
  }
  return filter;
}

export const listExpenses = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = buildFilter(req.query, req.shopId);

  const [items, total, totals] = await Promise.all([
    Expense.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: { amount: round2(totals[0]?.amount || 0) },
  });
});

export const getExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, shopOwner: req.shopId }).lean();
  if (!expense) return res.status(404).json({ message: 'Expense entry not found' });
  res.json({ expense });
});

export const createExpense = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.amount) > 0)) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }
  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];

  const expense = await Expense.create(payload);
  res.status(201).json({ expense });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!expense) return res.status(404).json({ message: 'Expense entry not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) expense[key] = req.body[key];
  expense.updatedBy = req.user._id;
  await expense.save();
  res.json({ expense });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!expense) return res.status(404).json({ message: 'Expense entry not found' });
  res.json({ message: `${expense.expenseNumber} deleted` });
});
