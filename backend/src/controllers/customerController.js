import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { asyncHandler } from '../middleware/error.js';

const EDITABLE = [
  'name', 'mobile', 'commissionPercent', 'machine', 'status', 'notes',
];

/** Query params -> Mongo filter, always scoped to the signed-in owner. */
export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };

  if (query.status === 'active' || query.status === 'inactive') {
    filter.status = query.status;
  }
  if (query.machine) filter.machine = query.machine;

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { mobile: rx }, { custNumber: rx }];
  }
  return filter;
}

export const listCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const filter = buildFilter(req.query, req.user._id);

  const [items, total] = await Promise.all([
    Customer.find(filter)
      .populate('machine', 'name cardCompany')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shopOwner: req.user._id })
    .populate('machine', 'name cardCompany')
    .lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  res.json({ customer });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ message: 'Customer name is required' });
  }
  const payload = { shopOwner: req.user._id, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];
  if (!payload.machine) payload.machine = null;

  const customer = await Customer.create(payload);
  res.status(201).json({ customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  for (const key of EDITABLE) {
    if (req.body[key] !== undefined) customer[key] = req.body[key] === '' && key === 'machine' ? null : req.body[key];
  }
  customer.updatedBy = req.user._id;
  await customer.save();
  res.json({ customer });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const used = await Transaction.countDocuments({ customer: req.params.id, shopOwner: req.user._id });
  if (used) {
    return res.status(409).json({
      message: `This customer has ${used} transaction(s). Set them to inactive instead of deleting.`,
    });
  }
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, shopOwner: req.user._id });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  res.json({ message: `${customer.name} deleted` });
});
