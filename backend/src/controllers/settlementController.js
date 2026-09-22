import Transaction from '../models/Transaction.js';
import Settlement from '../models/Settlement.js';
import { asyncHandler } from '../middleware/error.js';
import { dayRange } from '../utils/dates.js';
import { round2 } from '../utils/calc.js';

/** Settle every pending transaction on one report day in a single action. */
export const settleDay = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const { date, note = '' } = req.body || {};
  if (!date) return res.status(400).json({ message: 'Date is required' });

  const range = dayRange(date); // also validates the YYYY-MM-DD format
  const match = {
    shopOwner: ownerId,
    settlementStatus: 'pending',
    txnDate: { $gte: range.from, $lt: range.to },
  };

  const [agg] = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, expected: { $sum: '$settlementAmount' }, count: { $sum: 1 } } },
  ]);
  if (!agg || !agg.count) {
    return res.status(400).json({ message: 'No pending entries on this day' });
  }

  const expectedAmount = round2(agg.expected);
  const receivedAmount =
    req.body.receivedAmount !== undefined && req.body.receivedAmount !== ''
      ? round2(req.body.receivedAmount)
      : expectedAmount;
  const receivedAt = req.body.receivedAt ? new Date(req.body.receivedAt) : new Date();

  const batch = await Settlement.create({
    shopOwner: ownerId,
    settleDate: date,
    expectedAmount,
    receivedAmount,
    txnCount: agg.count,
    note,
    receivedAt,
    createdBy: ownerId,
  });

  await Transaction.updateMany(match, {
    $set: {
      settlementStatus: 'received',
      receivedAt,
      settlementNote: note,
      settlementBatch: batch._id,
      updatedBy: ownerId,
    },
  });

  res.status(201).json({ settlement: batch });
});

/** Undo a day's settlement: put its transactions back to pending. */
export const revertDay = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const batch = await Settlement.findOneAndDelete({ _id: req.params.id, shopOwner: ownerId });
  if (!batch) return res.status(404).json({ message: 'Settlement not found' });

  await Transaction.updateMany(
    { shopOwner: ownerId, settlementBatch: batch._id },
    {
      $set: {
        settlementStatus: 'pending',
        receivedAt: null,
        settlementNote: '',
        settlementBatch: null,
        updatedBy: ownerId,
      },
    }
  );

  res.json({ message: `${batch.settleDate} moved back to pending` });
});

/** Settlement batches, optionally for one day (?date=YYYY-MM-DD). */
export const listSettlements = asyncHandler(async (req, res) => {
  const filter = { shopOwner: req.user._id };
  if (req.query.date) filter.settleDate = req.query.date;
  const items = await Settlement.find(filter).sort({ receivedAt: -1 }).lean();
  res.json({ items });
});
