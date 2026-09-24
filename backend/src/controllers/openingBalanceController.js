import OpeningBalance from '../models/OpeningBalance.js';
import { asyncHandler } from '../middleware/error.js';

const EDITABLE = ['entryDate', 'amount', 'notes'];

export const listOpening = asyncHandler(async (req, res) => {
  const items = await OpeningBalance.find({ shopOwner: req.shopId })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();
  res.json({ items });
});

export const createOpening = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.amount) > 0)) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }
  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];

  const opening = await OpeningBalance.create(payload);
  res.status(201).json({ opening });
});

export const updateOpening = asyncHandler(async (req, res) => {
  const opening = await OpeningBalance.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!opening) return res.status(404).json({ message: 'Opening balance not found' });
  if (req.body.amount !== undefined && !(Number(req.body.amount) > 0)) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  for (const key of EDITABLE) if (req.body[key] !== undefined) opening[key] = req.body[key];
  opening.updatedBy = req.user._id;
  await opening.save();
  res.json({ opening });
});

export const deleteOpening = asyncHandler(async (req, res) => {
  const opening = await OpeningBalance.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!opening) return res.status(404).json({ message: 'Opening balance not found' });
  res.json({ message: `${opening.openingNumber} deleted` });
});
