import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import CardMachine from '../models/CardMachine.js';
import { asyncHandler } from '../middleware/error.js';

const EDITABLE = [
  'machine', 'customer', 'customerName', 'customerMobile', 'swipedAmount',
  'custPercent', 'givenAmount', 'commissionType', 'cardRefNumber', 'notes',
  'txnDate',
];

/**
 * Verifies the machine exists (required) and, if a customer was chosen,
 * verifies it too. Returns the resolved machine and customer (customer may be
 * null for a walk-in entry).
 */
async function resolveRefs(body, ownerId) {
  if (!body.machine) throw Object.assign(new Error('Choose a card machine'), { status: 400 });

  const machine = await CardMachine.findOne({ _id: body.machine, shopOwner: ownerId });
  if (!machine) throw Object.assign(new Error('Card machine not found'), { status: 404 });

  let customer = null;
  if (body.customer) {
    customer = await Customer.findOne({ _id: body.customer, shopOwner: ownerId });
    if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  }

  return { machine, customer };
}

/** Turns query params into a Mongo filter shared by list + export. */
export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };

  if (query.status === 'pending' || query.status === 'received') {
    filter.settlementStatus = query.status;
  }
  if (query.machine) filter.machine = query.machine;
  if (query.customer) filter.customer = query.customer;

  if (query.from || query.to) {
    filter.txnDate = {};
    if (query.from) filter.txnDate.$gte = new Date(query.from);
    if (query.to) filter.txnDate.$lte = new Date(query.to);
  }

  if (query.minAmount || query.maxAmount) {
    filter.swipedAmount = {};
    if (query.minAmount) filter.swipedAmount.$gte = Number(query.minAmount);
    if (query.maxAmount) filter.swipedAmount.$lte = Number(query.maxAmount);
  }

  const q = String(query.q || '').trim();
  if (q) {
    // One search box across mobile / txn number / card ref / customer name.
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const or = [
      { customerMobile: rx },
      { txnNumber: rx },
      { cardRefNumber: rx },
      { customerName: rx },
    ];
    if (!Number.isNaN(Number(q))) or.push({ swipedAmount: Number(q) });
    filter.$or = or;
  }

  return filter;
}

export const listTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = buildFilter(req.query, req.user._id);

  const [items, total, totals] = await Promise.all([
    Transaction.find(filter)
      .populate('machine', 'name cardCompany')
      .populate('customer', 'name mobile')
      .sort({ txnDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
    // Totals for the whole filtered set, not just the current page.
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          swipedAmount: { $sum: '$swipedAmount' },
          givenAmount: { $sum: '$givenAmount' },
          chargeToCustomer: { $sum: '$chargeToCustomer' },
          supplierFee: { $sum: '$supplierFee' },
          margin: { $sum: '$margin' },
        },
      },
    ]),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: totals[0] || {},
  });
});

export const getTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, shopOwner: req.user._id })
    .populate('createdBy', 'name')
    .populate('machine', 'name cardCompany')
    .populate('customer', 'name mobile commissionPercent')
    .lean();
  if (!txn) return res.status(404).json({ message: 'Transaction not found' });
  res.json({ transaction: txn });
});

export const createTransaction = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const excluded = body.commissionType === 'excluded';
  // Whichever end the owner typed has to be there; the other is derived.
  const typed = excluded ? body.givenAmount : body.swipedAmount;
  if (!(Number(typed) > 0)) {
    return res.status(400).json({
      message: excluded
        ? 'Cash to the customer must be greater than 0'
        : 'Swiped amount must be greater than 0',
    });
  }

  const { machine, customer } = await resolveRefs(body, req.user._id);

  const payload = {};
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];

  if (customer) {
    // Snapshot the chosen customer so history is stable.
    payload.customer = customer._id;
    payload.customerName = customer.name;
    payload.customerMobile = customer.mobile;
    if (body.custPercent === undefined || body.custPercent === '') {
      payload.custPercent = customer.commissionPercent;
    }
  } else {
    // Walk-in: keep whatever name/mobile was typed (may be blank).
    payload.customer = null;
  }
  // The machine's rate is snapshotted, never typed per entry.
  payload.supplierPercent = machine.supplierPercent || 0;
  payload.shopOwner = req.user._id;
  payload.createdBy = req.user._id;

  const txn = await Transaction.create(payload);
  res.status(201).json({ transaction: txn });
});

export const updateTransaction = asyncHandler(async (req, res) => {
  // save() rather than findByIdAndUpdate so the pre-validate hook recalculates
  // every derived amount.
  const txn = await Transaction.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!txn) return res.status(404).json({ message: 'Transaction not found' });

  for (const key of EDITABLE) {
    if (req.body[key] !== undefined) txn[key] = req.body[key];
  }

  // Whichever of the two the owner just touched wins: a re-typed rate has to
  // clear the amount derived from it, or computeAmounts() would keep reading
  // the rate back out of the stored pair. Which one to clear depends on the
  // end the entry was typed from.
  if (req.body.custPercent !== undefined) {
    const excluded = (req.body.commissionType || txn.commissionType) === 'excluded';
    if (excluded && req.body.swipedAmount === undefined) txn.swipedAmount = undefined;
    if (!excluded && req.body.givenAmount === undefined) txn.givenAmount = undefined;
  }

  // If the machine/customer changed, re-verify and re-snapshot.
  if (req.body.machine !== undefined || req.body.customer !== undefined) {
    const { machine, customer } = await resolveRefs(
      { machine: txn.machine, customer: txn.customer || undefined },
      req.user._id
    );
    if (req.body.machine !== undefined) txn.supplierPercent = machine.supplierPercent || 0;
    if (customer) {
      txn.customer = customer._id;
      txn.customerName = customer.name;
      txn.customerMobile = customer.mobile;
    } else {
      txn.customer = null;
    }
  }

  txn.updatedBy = req.user._id;

  await txn.save();
  res.json({ transaction: txn });
});

export const setSettlement = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['pending', 'received'].includes(status)) {
    return res.status(400).json({ message: 'Status must be pending or received' });
  }

  const txn = await Transaction.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!txn) return res.status(404).json({ message: 'Transaction not found' });

  if (status === 'received') {
    // Default to what the company owes; the owner corrects it when the bank
    // rounds the deposit down. Profit follows from it in the model hook.
    const typed = req.body.settlementAmount;
    txn.settlementAmount =
      typed === undefined || typed === '' || typed === null ? txn.supplierAccount : Number(typed);
    txn.receivedAt = new Date(req.body.receivedAt || Date.now());
  } else {
    txn.settlementAmount = null;
    txn.receivedAt = null;
    txn.settlementNote = '';
    txn.settlementBatch = null;
  }
  txn.settlementStatus = status;
  txn.updatedBy = req.user._id;

  await txn.save();
  res.json({ transaction: txn });
});

/** Mark many pending rows received in one tap from the settlements screen. */
export const bulkSettle = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ message: 'No transactions selected' });

  // A pipeline update so every row settles at its own expected figure.
  const result = await Transaction.updateMany(
    { _id: { $in: ids }, shopOwner: req.user._id, settlementStatus: 'pending' },
    [
      {
        $set: {
          settlementStatus: 'received',
          receivedAt: new Date(),
          updatedBy: req.user._id,
          settlementAmount: '$supplierAccount',
          profit: { $round: [{ $subtract: ['$supplierAccount', '$givenAmount'] }, 2] },
        },
      },
    ]
  );
  res.json({ updated: result.modifiedCount });
});

export const deleteTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOneAndDelete({ _id: req.params.id, shopOwner: req.user._id });
  if (!txn) return res.status(404).json({ message: 'Transaction not found' });
  res.json({ message: `${txn.txnNumber} deleted` });
});
