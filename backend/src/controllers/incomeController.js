import Income from '../models/Income.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

const EDITABLE = ['entryDate', 'amount', 'category', 'receiver', 'notes'];

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
    filter.$or = [{ category: rx }, { receiver: rx }, { incomeNumber: rx }, { notes: rx }];
  }
  return filter;
}

export const listIncome = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = buildFilter(req.query, req.shopId);

  const [items, total, totals] = await Promise.all([
    Income.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Income.countDocuments(filter),
    Income.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
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

export const getIncome = asyncHandler(async (req, res) => {
  const income = await Income.findOne({ _id: req.params.id, shopOwner: req.shopId }).lean();
  if (!income) return res.status(404).json({ message: 'Income entry not found' });
  res.json({ income });
});

export const createIncome = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.amount) > 0)) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }
  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];

  const income = await Income.create(payload);
  res.status(201).json({ income });
});

export const updateIncome = asyncHandler(async (req, res) => {
  const income = await Income.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!income) return res.status(404).json({ message: 'Income entry not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) income[key] = req.body[key];
  income.updatedBy = req.user._id;
  await income.save();
  res.json({ income });
});

export const deleteIncome = asyncHandler(async (req, res) => {
  const income = await Income.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!income) return res.status(404).json({ message: 'Income entry not found' });
  res.json({ message: `${income.incomeNumber} deleted` });
});
