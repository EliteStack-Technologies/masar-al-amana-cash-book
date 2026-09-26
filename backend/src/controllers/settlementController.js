import Transaction from '../models/Transaction.js';
import Settlement from '../models/Settlement.js';
import CardMachine from '../models/CardMachine.js';
import { asyncHandler } from '../middleware/error.js';
import { dayRange, todayStr } from '../utils/dates.js';
import { round2 } from '../utils/calc.js';

/* --- vendor (machine-wise) settlement ------------------------------------ */

/** Pending entries on one machine, up to the end of `upTo` (YYYY-MM-DD). */
const vendorPendingMatch = (ownerId, machineId, upTo) => {
  const match = { shopOwner: ownerId, machine: machineId, settlementStatus: 'pending' };
  if (upTo) match.txnDate = { $lt: dayRange(upTo).to };
  return match;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD as a match on `field`, both days included.
 * Either end may be left off; with neither it matches everything.
 */
function dateWindow(query, field) {
  const from = DAY.test(query.from || '') ? dayRange(query.from).from : null;
  const to = DAY.test(query.to || '') ? dayRange(query.to).to : null;
  if (!from && !to) return {};
  return { [field]: { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) } };
}

/**
 * Every machine with what its card company still owes on pending swipes and
 * the running ledger balance: + when the company has paid extra, - when it
 * has paid short.
 *
 * With ?from=&to=, the pending figures cover swipes taken in those dates and
 * the settlement count those received in them; the balance stays all time,
 * since it is a running total.
 */
export const listVendors = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const received = dateWindow(req.query, 'receivedAt');
  const [machines, pending, ledger, inWindow] = await Promise.all([
    CardMachine.find({ shopOwner: ownerId }).sort({ name: 1 }).lean(),
    Transaction.aggregate([
      { $match: { shopOwner: ownerId, settlementStatus: 'pending', ...dateWindow(req.query, 'txnDate') } },
      { $group: { _id: '$machine', amount: { $sum: '$supplierAccount' }, count: { $sum: 1 } } },
    ]),
    Settlement.aggregate([
      { $match: { shopOwner: ownerId, machine: { $ne: null } } },
      {
        $group: {
          _id: '$machine',
          balance: { $sum: '$difference' },
          received: { $sum: '$receivedAmount' },
          count: { $sum: 1 },
          lastAt: { $max: '$receivedAt' },
        },
      },
    ]),
    // Settlements received inside the date filter, when one is set.
    Object.keys(received).length
      ? Settlement.aggregate([
          { $match: { shopOwner: ownerId, machine: { $ne: null }, ...received } },
          { $group: { _id: '$machine', received: { $sum: '$receivedAmount' }, count: { $sum: 1 } } },
        ])
      : null,
  ]);

  const pendingBy = new Map(pending.map((p) => [String(p._id), p]));
  const ledgerBy = new Map(ledger.map((l) => [String(l._id), l]));
  const windowBy = new Map((inWindow || ledger).map((l) => [String(l._id), l]));

  const items = machines.map((m) => {
    const p = pendingBy.get(String(m._id));
    const l = ledgerBy.get(String(m._id));
    const w = windowBy.get(String(m._id));
    return {
      machineId: m._id,
      name: m.name,
      cardCompany: m.cardCompany || '',
      status: m.status,
      pendingAmount: round2(p?.amount || 0),
      pendingCount: p?.count || 0,
      balance: round2(l?.balance || 0),
      settlements: w?.count || 0,
      receivedAmount: round2(w?.received || 0),
      lastSettledAt: l?.lastAt || null,
    };
  });

  res.json({
    items,
    totals: {
      pendingAmount: round2(items.reduce((a, i) => a + i.pendingAmount, 0)),
      pendingCount: items.reduce((a, i) => a + i.pendingCount, 0),
      receivedAmount: round2(items.reduce((a, i) => a + i.receivedAmount, 0)),
      settlements: items.reduce((a, i) => a + i.settlements, 0),
      balance: round2(items.reduce((a, i) => a + i.balance, 0)),
    },
  });
});

/** One machine's vendor ledger: its pending swipes and every settlement made. */
export const vendorLedger = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const machine = await CardMachine.findOne({ _id: req.params.machineId, shopOwner: ownerId }).lean();
  if (!machine) return res.status(404).json({ message: 'Card machine not found' });

  const [pending, batches] = await Promise.all([
    Transaction.find(vendorPendingMatch(ownerId, machine._id)).sort({ txnDate: 1 }).lean(),
    Settlement.find({ shopOwner: ownerId, machine: machine._id }).sort({ receivedAt: 1, createdAt: 1 }).lean(),
  ]);

  // Running balance, oldest first; shown newest first.
  let balance = 0;
  const ledger = batches.map((b) => {
    balance = round2(balance + (b.difference || 0));
    return { ...b, balance };
  });

  res.json({
    machine: {
      _id: machine._id,
      name: machine.name,
      cardCompany: machine.cardCompany || '',
      machineNumber: machine.machineNumber || '',
    },
    pending,
    pendingAmount: round2(pending.reduce((a, t) => a + t.supplierAccount, 0)),
    balance,
    ledger: ledger.reverse(),
  });
});

/**
 * Mark a machine's pending swipes received in one go. Each entry settles at
 * what it was owed; the gap between that and what the company actually paid
 * goes on the machine's ledger as the difference.
 */
export const settleVendor = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
  const machine = await CardMachine.findOne({ _id: req.params.machineId, shopOwner: ownerId }).lean();
  if (!machine) return res.status(404).json({ message: 'Card machine not found' });

  const upTo = req.body.upTo || todayStr();
  const match = vendorPendingMatch(ownerId, machine._id, upTo);

  const [agg] = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, expected: { $sum: '$supplierAccount' }, count: { $sum: 1 } } },
  ]);
  if (!agg || !agg.count) {
    return res.status(400).json({ message: `No pending entries on ${machine.name} up to ${upTo}` });
  }

  const received = req.body.receivedAmount;
  if (received === undefined || received === null || received === '' || !(Number(received) >= 0)) {
    return res.status(400).json({ message: 'Enter the amount the company paid' });
  }

  const expectedAmount = round2(agg.expected);
  const receivedAmount = round2(received);
  const receivedAt = req.body.receivedAt ? new Date(req.body.receivedAt) : new Date();
  const note = String(req.body.note || '').trim();

  const batch = await Settlement.create({
    shopOwner: ownerId,
    settleDate: upTo,
    machine: machine._id,
    expectedAmount,
    receivedAmount,
    difference: round2(receivedAmount - expectedAmount),
    txnCount: agg.count,
    note,
    receivedAt,
    createdBy: req.user._id,
  });

  await Transaction.updateMany(match, [
    {
      $set: {
        settlementStatus: 'received',
        receivedAt,
        settlementNote: note,
        settlementBatch: batch._id,
        updatedBy: req.user._id,
        settlementAmount: '$supplierAccount',
        profit: { $round: [{ $subtract: ['$supplierAccount', '$givenAmount'] }, 2] },
      },
    },
  ]);

  res.status(201).json({ settlement: batch });
});

/** Settle every pending transaction on one report day in a single action. */
export const settleDay = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
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
    { $group: { _id: null, expected: { $sum: '$supplierAccount' }, count: { $sum: 1 } } },
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
    createdBy: req.user._id,
  });

  // A pipeline update so each row settles at its own expected figure. When
  // the company paid a different total, the shortfall is spread across the
  // day in proportion to what each swipe was owed.
  const factor = expectedAmount ? receivedAmount / expectedAmount : 1;
  await Transaction.updateMany(match, [
    {
      $set: {
        settlementStatus: 'received',
        receivedAt,
        settlementNote: note,
        settlementBatch: batch._id,
        updatedBy: req.user._id,
        settlementAmount: { $round: [{ $multiply: ['$supplierAccount', factor] }, 2] },
        profit: {
          $round: [
            {
              $subtract: [
                { $round: [{ $multiply: ['$supplierAccount', factor] }, 2] },
                '$givenAmount',
              ],
            },
            2,
          ],
        },
      },
    },
  ]);

  res.status(201).json({ settlement: batch });
});

/** Undo a day's settlement: put its transactions back to pending. */
export const revertDay = asyncHandler(async (req, res) => {
  const ownerId = req.shopId;
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
        settlementAmount: null,
        profit: null,
        updatedBy: req.user._id,
      },
    }
  );

  res.json({ message: `${batch.settleDate} moved back to pending` });
});

/** Settlement batches, optionally for one day (?date=YYYY-MM-DD). */
export const listSettlements = asyncHandler(async (req, res) => {
  const filter = { shopOwner: req.shopId };
  if (req.query.date) filter.settleDate = req.query.date;
  const items = await Settlement.find(filter).sort({ receivedAt: -1 }).lean();
  res.json({ items });
});
