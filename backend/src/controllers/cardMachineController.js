import CardMachine from '../models/CardMachine.js';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import { asyncHandler } from '../middleware/error.js';

const EDITABLE = ['name', 'deviceId', 'cardCompany', 'supplierPercent', 'status', 'notes'];

export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };
  if (query.status === 'active' || query.status === 'inactive') filter.status = query.status;

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { deviceId: rx }, { cardCompany: rx }, { machineNumber: rx }];
  }
  return filter;
}

export const listMachines = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query, req.shopId);
  const items = await CardMachine.find(filter).sort({ name: 1 }).lean();
  res.json({ items, total: items.length });
});

export const getMachine = asyncHandler(async (req, res) => {
  const machine = await CardMachine.findOne({ _id: req.params.id, shopOwner: req.shopId }).lean();
  if (!machine) return res.status(404).json({ message: 'Machine not found' });
  res.json({ machine });
});

export const createMachine = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ message: 'Machine name is required' });
  }
  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];

  const machine = await CardMachine.create(payload);
  res.status(201).json({ machine });
});

export const updateMachine = asyncHandler(async (req, res) => {
  const machine = await CardMachine.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!machine) return res.status(404).json({ message: 'Machine not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) machine[key] = req.body[key];
  machine.updatedBy = req.user._id;
  await machine.save();
  res.json({ machine });
});

export const deleteMachine = asyncHandler(async (req, res) => {
  const [txns, customers] = await Promise.all([
    Transaction.countDocuments({ machine: req.params.id, shopOwner: req.shopId }),
    Customer.countDocuments({ machine: req.params.id, shopOwner: req.shopId }),
  ]);
  if (txns || customers) {
    return res.status(409).json({
      message: `This machine is used by ${txns} transaction(s) and ${customers} customer(s). Set it inactive instead.`,
    });
  }
  const machine = await CardMachine.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!machine) return res.status(404).json({ message: 'Machine not found' });
  res.json({ message: `${machine.name} deleted` });
});
