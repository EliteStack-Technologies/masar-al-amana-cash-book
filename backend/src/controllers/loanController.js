import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import LoanAccount from '../models/LoanAccount.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

const EDITABLE = ['account', 'lenderName', 'lenderMobile', 'principal', 'entryDate', 'notes'];

/** Case-insensitive exact name match, so "rashid" finds "Rashid". */
const findAccountByName = (ownerId, name) =>
  LoanAccount.findOne({ shopOwner: ownerId, name }).collation({ locale: 'en', strength: 2 });

/**
 * A loan is cash an account holder put into the shop, so the lender is picked
 * from the loan accounts list. A name with no match opens a new account on
 * the spot - the add-loan screen asks for nothing else.
 */
async function resolveAccount(body, ownerId, userId) {
  if (body.account) {
    const account = await LoanAccount.findOne({ _id: body.account, shopOwner: ownerId });
    if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });
    return account;
  }

  const name = String(body.lenderName || '').trim();
  if (!name) throw Object.assign(new Error('Choose an account or type a name'), { status: 400 });

  const existing = await findAccountByName(ownerId, name);
  if (existing) return existing;

  return LoanAccount.create({
    shopOwner: ownerId,
    name,
    mobile: String(body.lenderMobile || '').trim(),
    createdBy: userId,
  });
}

/**
 * Loans written before accounts existed point at a swipe customer instead.
 * Each is moved onto an account of the same name (opened if needed), once;
 * after that every loan has an account and this finds nothing to do.
 */
async function adoptLegacyLoans(ownerId) {
  const legacy = await Loan.find({ shopOwner: ownerId, account: null }).sort({ entryDate: 1 });
  for (const loan of legacy) {
    const account = await resolveAccount(
      { lenderName: loan.lenderName, lenderMobile: loan.lenderMobile },
      ownerId,
      loan.createdBy
    );
    loan.account = account._id;
    await loan.save();
  }
}

/** The loan accounts list, for the add-loan picker. */
export const listAccounts = asyncHandler(async (req, res) => {
  await adoptLegacyLoans(req.shopId);
  const items = await LoanAccount.find({ shopOwner: req.shopId })
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1 })
    .lean();
  res.json({ items });
});

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
  await adoptLegacyLoans(req.shopId);
  const filter = buildFilter(req.query, req.shopId);

  const [items, total, totals, byAccount] = await Promise.all([
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
    // Account-wise position, so the loan screen can be read per lender.
    Loan.aggregate([
      { $match: { shopOwner: req.shopId } },
      { $sort: { entryDate: 1 } },
      {
        $group: {
          _id: '$account',
          name: { $last: '$lenderName' },
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
    byAccount: byAccount.map((r) => ({
      accountId: r._id,
      name: r.name,
      taken: round2(r.taken),
      repaid: round2(r.repaid),
      outstanding: round2(Math.max(0, r.taken - r.repaid)),
      loans: r.loans,
      openLoans: r.openLoans,
      lastAt: r.lastAt,
    })),
  });
});

/**
 * Everything the shop holds on one lender: every loan they have put in, the
 * repayments under each, and the combined position. This is what the loans
 * screen opens when an account row is tapped.
 */
export const accountLoans = asyncHandler(async (req, res) => {
  const account = await LoanAccount.findOne({
    _id: req.params.accountId,
    shopOwner: req.shopId,
  }).lean();
  if (!account) return res.status(404).json({ message: 'Account not found' });

  const loans = await Loan.find({ shopOwner: req.shopId, account: account._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  const settlements = await LoanSettlement.find({
    shopOwner: req.shopId,
    loan: { $in: loans.map((l) => l._id) },
  })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  // Hang each repayment under its own loan, keeping the sort above.
  const byLoan = new Map();
  settlements.forEach((s) => {
    const key = String(s.loan);
    if (!byLoan.has(key)) byLoan.set(key, []);
    byLoan.get(key).push(s);
  });

  const rows = loans.map((l) => ({
    ...l,
    outstanding: round2(Math.max(0, l.principal - l.settledAmount)),
    settlements: byLoan.get(String(l._id)) || [],
  }));

  const taken = round2(rows.reduce((a, l) => a + l.principal, 0));
  const repaid = round2(rows.reduce((a, l) => a + l.settledAmount, 0));
  const dates = rows.map((l) => new Date(l.entryDate).getTime()).filter(Boolean);

  res.json({
    account: {
      _id: account._id,
      accountNumber: account.accountNumber,
      name: account.name,
      mobile: account.mobile || '',
      notes: account.notes || '',
    },
    loans: rows,
    // Flat timeline across every loan, newest first.
    settlements: settlements.map((s) => ({
      ...s,
      loanNumber: loans.find((l) => String(l._id) === String(s.loan))?.loanNumber || '',
    })),
    totals: {
      taken,
      repaid,
      outstanding: round2(Math.max(0, taken - repaid)),
      loans: rows.length,
      openLoans: rows.filter((l) => l.status === 'open').length,
      closedLoans: rows.filter((l) => l.status === 'closed').length,
      repayments: settlements.length,
      firstAt: dates.length ? new Date(Math.min(...dates)) : null,
      lastAt: dates.length ? new Date(Math.max(...dates)) : null,
    },
  });
});

export const getLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.shopId });
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

  const account = await resolveAccount(body, req.shopId, req.user._id);

  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];
  // Snapshot the account so renaming it never rewrites history.
  payload.account = account._id;
  payload.lenderName = account.name;
  payload.lenderMobile = account.mobile || '';

  const loan = await Loan.create(payload);
  res.status(201).json({ loan: loan.toJSON() });
});

export const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) loan[key] = req.body[key];
  if (req.body.account !== undefined || req.body.lenderName !== undefined) {
    const account = await resolveAccount({ ...req.body, lenderName: loan.lenderName }, req.shopId, req.user._id);
    loan.account = account._id;
    loan.lenderName = account.name;
    loan.lenderMobile = account.mobile || '';
  }
  loan.updatedBy = req.user._id;
  // Principal may have changed, so re-evaluate open/closed.
  loan.status = loan.settledAmount >= loan.principal ? 'closed' : 'open';
  await loan.save();
  res.json({ loan: loan.toJSON() });
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  await LoanSettlement.deleteMany({ loan: loan._id });
  res.json({ message: `${loan.loanNumber} deleted` });
});

/** Record a repayment against a loan. */
export const addSettlement = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  if (!(Number(req.body.amount) > 0)) {
    return res.status(400).json({ message: 'Settlement amount must be greater than 0' });
  }

  await LoanSettlement.create({
    shopOwner: req.shopId,
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
    shopOwner: req.shopId,
  });
  if (!settlement) return res.status(404).json({ message: 'Settlement not found' });

  const loan = await Loan.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (loan) await refreshLoan(loan);
  res.json({ message: 'Settlement removed' });
});
