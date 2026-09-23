import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import Customer from '../models/Customer.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

const EDITABLE = ['customer', 'lenderName', 'lenderMobile', 'principal', 'entryDate', 'notes'];

/**
 * A loan is cash a customer put into the shop, so the lender is picked from
 * the customer list. A name with no match creates the customer on the spot -
 * the add-loan screen asks for nothing else.
 */
async function resolveLender(body, ownerId) {
  if (body.customer) {
    const customer = await Customer.findOne({ _id: body.customer, shopOwner: ownerId });
    if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
    return customer;
  }

  const name = String(body.lenderName || '').trim();
  if (!name) throw Object.assign(new Error('Choose a customer or type a name'), { status: 400 });

  // Case-insensitive exact match, so "rashid" finds "Rashid".
  const existing = await Customer.findOne({ shopOwner: ownerId, name }).collation({
    locale: 'en',
    strength: 2,
  });
  if (existing) return existing;

  return Customer.create({
    shopOwner: ownerId,
    name,
    mobile: String(body.lenderMobile || '').trim(),
    createdBy: ownerId,
  });
}

export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };
  if (query.status === 'open' || query.status === 'closed') filter.status = query.status;

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ lenderName: rx }, { lenderMobile: rx }, { loanNumber: rx }];
  }
  return filter;
}

/** Recomputes settledAmount + status from a loan's settlements. */
async function refreshLoan(loan) {
  const [agg] = await LoanSettlement.aggregate([
    { $match: { loan: loan._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const settled = round2(agg?.total || 0);
  loan.settledAmount = settled;
  loan.status = settled >= loan.principal ? 'closed' : 'open';
  await loan.save();
  return loan;
}

export const listLoans = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = buildFilter(req.query, req.user._id);

  const [items, total, totals, byCustomer] = await Promise.all([
    Loan.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Loan.countDocuments(filter),
    Loan.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          principal: { $sum: '$principal' },
          settled: { $sum: '$settledAmount' },
        },
      },
    ]),
    // Customer-wise position, so the loan screen can be read per lender.
    Loan.aggregate([
      { $match: { shopOwner: req.user._id } },
      {
        $group: {
          _id: { customer: '$customer', name: '$lenderName' },
          taken: { $sum: '$principal' },
          repaid: { $sum: '$settledAmount' },
          loans: { $sum: 1 },
          openLoans: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          lastAt: { $max: '$entryDate' },
        },
      },
      { $sort: { taken: -1 } },
    ]),
  ]);

  const taken = round2(totals[0]?.principal || 0);
  const settled = round2(totals[0]?.settled || 0);
  res.json({
    items: items.map((l) => ({ ...l, outstanding: round2(Math.max(0, l.principal - l.settledAmount)) })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: { taken, settled, outstanding: round2(Math.max(0, taken - settled)) },
    byCustomer: byCustomer.map((r) => ({
      customerId: r._id.customer,
      name: r._id.name,
      taken: round2(r.taken),
      repaid: round2(r.repaid),
      outstanding: round2(Math.max(0, r.taken - r.repaid)),
      loans: r.loans,
      openLoans: r.openLoans,
      lastAt: r.lastAt,
    })),
  });
});

export const getLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  const settlements = await LoanSettlement.find({ loan: loan._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  res.json({ loan: loan.toJSON(), settlements });
});

export const createLoan = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.principal) > 0)) {
    return res.status(400).json({ message: 'Loan amount must be greater than 0' });
  }

  const lender = await resolveLender(body, req.user._id);

  const payload = { shopOwner: req.user._id, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];
  // Snapshot the lender so renaming the customer never rewrites history.
  payload.customer = lender._id;
  payload.lenderName = lender.name;
  payload.lenderMobile = lender.mobile || '';

  const loan = await Loan.create(payload);
  res.status(201).json({ loan: loan.toJSON() });
});

export const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) loan[key] = req.body[key];
  if (req.body.customer !== undefined || req.body.lenderName !== undefined) {
    const lender = await resolveLender({ ...req.body, lenderName: loan.lenderName }, req.user._id);
    loan.customer = lender._id;
    loan.lenderName = lender.name;
    loan.lenderMobile = lender.mobile || '';
  }
  loan.updatedBy = req.user._id;
  // Principal may have changed, so re-evaluate open/closed.
  loan.status = loan.settledAmount >= loan.principal ? 'closed' : 'open';
  await loan.save();
  res.json({ loan: loan.toJSON() });
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({ _id: req.params.id, shopOwner: req.user._id });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  await LoanSettlement.deleteMany({ loan: loan._id });
  res.json({ message: `${loan.loanNumber} deleted` });
});

/** Record a repayment against a loan. */
export const addSettlement = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  if (!(Number(req.body.amount) > 0)) {
    return res.status(400).json({ message: 'Settlement amount must be greater than 0' });
  }

  await LoanSettlement.create({
    shopOwner: req.user._id,
    loan: loan._id,
    amount: Number(req.body.amount),
    entryDate: req.body.entryDate || Date.now(),
    notes: req.body.notes || '',
    createdBy: req.user._id,
  });

  await refreshLoan(loan);
  const settlements = await LoanSettlement.find({ loan: loan._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();
  res.status(201).json({ loan: loan.toJSON(), settlements });
});

export const deleteSettlement = asyncHandler(async (req, res) => {
  const settlement = await LoanSettlement.findOneAndDelete({
    _id: req.params.settlementId,
    loan: req.params.id,
    shopOwner: req.user._id,
  });
  if (!settlement) return res.status(404).json({ message: 'Settlement not found' });

  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.user._id });
  if (loan) await refreshLoan(loan);
  res.json({ message: 'Settlement removed' });
});
