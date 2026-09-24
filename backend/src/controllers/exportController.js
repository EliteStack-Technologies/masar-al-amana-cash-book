import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan from '../models/Loan.js';
import LoanSettlement from '../models/LoanSettlement.js';
import LoanAccount from '../models/LoanAccount.js';
import Customer from '../models/Customer.js';
import CardMachine from '../models/CardMachine.js';
import { asyncHandler } from '../middleware/error.js';
import { buildFilter } from './transactionController.js';
import {
  summarise, moneySum, loanTotals, customerReport, machineReport, periodWindow,
} from './reportController.js';
import { dayRange, weekRange, monthRange, todayStr, TZ } from '../utils/dates.js';

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ(), day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(new Date(d))
    : '';

const fmtDay = (d) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ(), day: '2-digit', month: 'short', year: 'numeric',
      }).format(new Date(d))
    : '';

/* --- Column definitions per dataset. `money: true` marks amount columns. --- */
const TXN_COLUMNS = [
  { header: 'Txn No', key: 'txnNumber', width: 14, pdf: 60 },
  { header: 'Date', key: 'date', width: 20, pdf: 104 },
  { header: 'Customer', key: 'customerName', width: 18, pdf: 60 },
  { header: 'Mobile', key: 'customerMobile', width: 14, pdf: 54 },
  { header: 'Swiped', key: 'swipedAmount', width: 12, pdf: 48, money: true },
  { header: 'Given', key: 'givenAmount', width: 12, pdf: 48, money: true },
  { header: 'Charge', key: 'chargeToCustomer', width: 11, pdf: 46, money: true },
  { header: 'Cust %', key: 'custPercent', width: 8, pdf: 40 },
  { header: 'Comm', key: 'commissionType', width: 10, pdf: 40 },
  { header: 'Supp %', key: 'supplierPercent', width: 8, pdf: 40 },
  { header: 'Supplier Fee', key: 'supplierFee', width: 12, pdf: 56, money: true },
  { header: 'Margin', key: 'margin', width: 11, pdf: 46, money: true },
  { header: 'Supplier A/C', key: 'supplierAccount', width: 13, pdf: 60, money: true },
  { header: 'Settlement', key: 'settlement', width: 13, pdf: 54 },
  { header: 'Profit', key: 'profitShown', width: 11, pdf: 46 },
  { header: 'Status', key: 'settlementStatus', width: 11, pdf: 40 },
];

/**
 * The sheet shared with the card company: same swipe list, minus the
 * customer's mobile number and our supplier percentage.
 */
const TXN_COMPANY_COLUMNS = TXN_COLUMNS.filter(
  (c) => c.key !== 'customerMobile' && c.key !== 'supplierPercent'
);

/**
 * The card company copy of the daily, weekly and monthly reports: just who
 * swiped, how much, the card charge, and what the card company owes for it.
 * The full copy of those reports keeps every column.
 */
const PERIOD_COLUMNS = [
  { header: 'Txn No', key: 'txnNumber', width: 14, pdf: 90 },
  { header: 'Date', key: 'date', width: 20, pdf: 150 },
  { header: 'Customer', key: 'customerName', width: 24, pdf: 200 },
  { header: 'Swipe', key: 'swipedAmount', width: 14, pdf: 110, money: true },
  { header: 'Card Charge', key: 'chargeToCustomer', width: 14, pdf: 100, money: true },
  { header: 'Due Amount (Supplier A/C)', key: 'supplierAccount', width: 24, pdf: 130, money: true },
];

/**
 * The full (own records) copy of the daily, weekly and monthly reports:
 * every swipe column except the settlement side - no settlement, profit or
 * status.
 */
const SETTLEMENT_KEYS = ['settlement', 'profitShown', 'settlementStatus'];
const PERIOD_FULL_COLUMNS = TXN_COLUMNS.filter((c) => !SETTLEMENT_KEYS.includes(c.key));

const periodFullSummaryLines = (s) => [
  ['Total swipes', s.count, false],
  ['Total swiped', s.swipedAmount, true],
  ['Total cash given to customers', s.givenAmount, true],
  ['Total charged to customers', s.chargeToCustomer, true],
  ['Supplier fee', s.supplierFee, true],
  ['Margin', s.margin, true],
  ['Total due (Supplier A/C)', s.supplierAccount, true],
];

const periodSummaryLines = (s) => [
  ['Total swipes', s.count, false],
  ['Total swiped', s.swipedAmount, true],
  ['Total card charge', s.chargeToCustomer, true],
  ['Total due (Supplier A/C)', s.supplierAccount, true],
];

const txnRow = (t) => ({
  ...t,
  date: fmtDate(t.txnDate),
  cardRefNumber: t.cardRefNumber || '-',
  // Blank until the money lands, the way the shop's own sheet reads.
  settlement: t.settlementAmount == null ? '-' : Number(t.settlementAmount).toFixed(2),
  profitShown: t.profit == null ? '-' : Number(t.profit).toFixed(2),
});

const INCOME_COLUMNS = [
  { header: 'No', key: 'incomeNumber', width: 12, pdf: 70 },
  { header: 'Date', key: 'date', width: 16, pdf: 90 },
  { header: 'Category', key: 'category', width: 18, pdf: 100 },
  { header: 'Received From', key: 'receiver', width: 20, pdf: 120 },
  { header: 'Amount', key: 'amount', width: 14, pdf: 80, money: true },
  { header: 'Notes', key: 'notes', width: 28, pdf: 180 },
];

const EXPENSE_COLUMNS = [
  { header: 'No', key: 'expenseNumber', width: 12, pdf: 70 },
  { header: 'Date', key: 'date', width: 16, pdf: 90 },
  { header: 'Category', key: 'category', width: 18, pdf: 100 },
  { header: 'Paid To', key: 'payee', width: 20, pdf: 120 },
  { header: 'Amount', key: 'amount', width: 14, pdf: 80, money: true },
  { header: 'Notes', key: 'notes', width: 28, pdf: 180 },
];

const LOAN_COLUMNS = [
  { header: 'No', key: 'loanNumber', width: 12, pdf: 66 },
  { header: 'Account', key: 'lenderName', width: 20, pdf: 110 },
  { header: 'Mobile', key: 'lenderMobile', width: 14, pdf: 80 },
  { header: 'Date', key: 'date', width: 16, pdf: 84 },
  { header: 'Loan Taken', key: 'principal', width: 13, pdf: 74, money: true },
  { header: 'Repaid', key: 'settledAmount', width: 13, pdf: 74, money: true },
  { header: 'Outstanding', key: 'outstanding', width: 13, pdf: 74, money: true },
  { header: 'Status', key: 'status', width: 10, pdf: 54 },
];

const ACCOUNT_LOAN_COLUMNS = [
  { header: 'Loan No', key: 'loanNumber', width: 14, pdf: 80 },
  { header: 'Date', key: 'date', width: 16, pdf: 90 },
  { header: 'Loan Taken', key: 'principal', width: 14, pdf: 84, money: true },
  { header: 'Repaid', key: 'settledAmount', width: 14, pdf: 84, money: true },
  { header: 'Outstanding', key: 'outstanding', width: 14, pdf: 84, money: true },
  { header: 'Repayments', key: 'repayments', width: 12, pdf: 70 },
  { header: 'Status', key: 'status', width: 10, pdf: 60 },
  { header: 'Notes', key: 'notes', width: 26, pdf: 150 },
];

const CUSTOMER_COLUMNS = [
  { header: 'No', key: 'custNumber', width: 12, pdf: 70 },
  { header: 'Name', key: 'name', width: 20, pdf: 120 },
  { header: 'Mobile', key: 'mobile', width: 14, pdf: 90 },
  { header: 'Cust %', key: 'commissionPercent', width: 12, pdf: 80 },
  { header: 'Machine', key: 'machineName', width: 18, pdf: 120 },
  { header: 'Status', key: 'status', width: 10, pdf: 70 },
];

const MACHINE_COLUMNS = [
  { header: 'No', key: 'machineNumber', width: 12, pdf: 80 },
  { header: 'Name', key: 'name', width: 20, pdf: 140 },
  { header: 'Card Company', key: 'cardCompany', width: 18, pdf: 140 },
  { header: 'Supplier %', key: 'supplierPercent', width: 12, pdf: 90 },
  { header: 'Device ID', key: 'deviceId', width: 16, pdf: 120 },
  { header: 'Status', key: 'status', width: 10, pdf: 80 },
];

const CUST_REPORT_COLUMNS = [
  { header: 'Customer', key: 'customerName', width: 20, pdf: 140 },
  { header: 'Mobile', key: 'customerMobile', width: 14, pdf: 100 },
  { header: 'Txns', key: 'count', width: 8, pdf: 50 },
  { header: 'Swiped', key: 'swipedAmount', width: 14, pdf: 84, money: true },
  { header: 'Given', key: 'givenAmount', width: 14, pdf: 84, money: true },
  { header: 'Charge', key: 'chargeToCustomer', width: 14, pdf: 76, money: true },
  { header: 'Margin', key: 'margin', width: 14, pdf: 76, money: true },
  { header: 'Profit', key: 'profit', width: 14, pdf: 76, money: true },
];

const CUST_REPORT_COMPANY_COLUMNS = CUST_REPORT_COLUMNS.filter(
  (c) => c.key !== 'customerMobile'
);

const MACHINE_REPORT_COLUMNS = [
  { header: 'Machine', key: 'machineName', width: 20, pdf: 140 },
  { header: 'Card Company', key: 'cardCompany', width: 18, pdf: 120 },
  { header: 'Txns', key: 'count', width: 8, pdf: 50 },
  { header: 'Swiped', key: 'swipedAmount', width: 14, pdf: 84, money: true },
  { header: 'Given', key: 'givenAmount', width: 14, pdf: 84, money: true },
  { header: 'Charge', key: 'chargeToCustomer', width: 14, pdf: 76, money: true },
  { header: 'Margin', key: 'margin', width: 14, pdf: 76, money: true },
  { header: 'Profit', key: 'profit', width: 14, pdf: 76, money: true },
];

const txnSummaryLines = (s) => [
  ['Total swipes', s.count, false],
  ['Total swiped', s.swipedAmount, true],
  ['Total cash given to customers', s.givenAmount, true],
  ['Total charged to customers', s.chargeToCustomer, true],
  ['Supplier fee', s.supplierFee, true],
  ['Margin (expected profit)', s.margin, true],
  ['Profit (settled entries)', s.profit, true],
  ['Settlement received', s.receivedAmount, true],
  ['Still with the card company', s.pendingAmount, true],
];

/**
 * Resolves ?type= into a uniform report descriptor:
 * { title, fileBase, columns, rows, summaryLines }.
 * `rows` are already display-shaped; money columns hold raw Numbers.
 */
async function gatherReport(query, ownerId) {
  const type = query.type || 'transactions';
  // ?variant=company is the copy handed to the card company: no customer
  // mobile numbers, no supplier percentage.
  const company = query.variant === 'company';
  const txnColumns = company ? TXN_COMPANY_COLUMNS : TXN_COLUMNS;
  // Daily, weekly and monthly: the full copy is every column bar the
  // settlement side, the card company copy is the short six-column list.
  const periodColumns = company ? PERIOD_COLUMNS : PERIOD_FULL_COLUMNS;
  const periodSummary = company ? periodSummaryLines : periodFullSummaryLines;
  const mark = company ? ' (Card Company Copy)' : '';
  const tag = company ? '-card-company' : '';

  if (type === 'daily') {
    const date = query.date || todayStr();
    const r = dayRange(date);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: 'Daily Report - ' + date + mark, fileBase: 'daily-' + date + tag,
      columns: periodColumns, rows: rows.map(txnRow),
      summaryLines: periodSummary(await summarise(ownerId, r)),
    };
  }

  if (type === 'weekly') {
    const date = query.date || todayStr();
    const r = weekRange(date);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: `Weekly Report - ${r.start} to ${r.end}` + mark, fileBase: 'weekly-' + r.start + tag,
      columns: periodColumns, rows: rows.map(txnRow),
      summaryLines: periodSummary(await summarise(ownerId, r)),
    };
  }

  if (type === 'monthly' || type === 'commission') {
    const month = query.month || todayStr().slice(0, 7);
    const r = monthRange(month);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: (type === 'commission' ? 'Commission' : 'Monthly') + ' Report - ' + month + mark,
      fileBase: type + '-' + month + tag,
      // The commission report keeps the full sheet; the monthly one is the
      // short swipe list, like daily and weekly.
      columns: type === 'monthly' ? periodColumns : txnColumns,
      rows: rows.map(txnRow),
      summaryLines: (type === 'monthly' ? periodSummary : txnSummaryLines)(
        await summarise(ownerId, r)
      ),
    };
  }

  if (type === 'settlement') {
    const rows = await Transaction.find({ shopOwner: ownerId, settlementStatus: 'pending' })
      .sort({ txnDate: 1 }).lean();
    return {
      title: 'Pending Settlements' + mark, fileBase: 'pending-settlements-' + todayStr() + tag,
      columns: txnColumns, rows: rows.map(txnRow),
      summaryLines: txnSummaryLines(await summarise(ownerId, null)),
    };
  }

  if (type === 'income') {
    const rows = await Income.find(incomeExpenseFilter(query, ownerId)).sort({ entryDate: -1 }).lean();
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return {
      title: 'Income', fileBase: 'income-' + todayStr(),
      columns: INCOME_COLUMNS, rows: rows.map((r) => ({ ...r, date: fmtDay(r.entryDate) })),
      summaryLines: [['Entries', rows.length, false], ['Total income', total, true]],
    };
  }

  if (type === 'expenses') {
    const rows = await Expense.find(incomeExpenseFilter(query, ownerId)).sort({ entryDate: -1 }).lean();
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return {
      title: 'Expenses', fileBase: 'expenses-' + todayStr(),
      columns: EXPENSE_COLUMNS, rows: rows.map((r) => ({ ...r, date: fmtDay(r.entryDate) })),
      summaryLines: [['Entries', rows.length, false], ['Total expenses', total, true]],
    };
  }

  if (type === 'loans') {
    const rows = await Loan.find({ shopOwner: ownerId }).sort({ entryDate: -1 }).lean();
    const t = await loanTotals(ownerId);
    return {
      title: 'Loans', fileBase: 'loans-' + todayStr(),
      columns: LOAN_COLUMNS,
      rows: rows.map((r) => ({
        ...r,
        date: fmtDay(r.entryDate),
        outstanding: Math.max(0, Math.round((r.principal - r.settledAmount) * 100) / 100),
      })),
      summaryLines: [
        ['Loans', t.count, false],
        ['Total loan taken', t.taken, true],
        ['Total repaid', t.repaid, true],
        ['Total outstanding', t.outstanding, true],
      ],
    };
  }

  // One account's whole loan history, as opened from the loans screen.
  if (type === 'account-loans') {
    const account = await LoanAccount.findOne({ _id: query.accountId, shopOwner: ownerId }).lean();
    if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });

    const loans = await Loan.find({ shopOwner: ownerId, account: account._id })
      .sort({ entryDate: -1, createdAt: -1 }).lean();

    const counts = await LoanSettlement.aggregate([
      { $match: { loan: { $in: loans.map((l) => l._id) } } },
      { $group: { _id: '$loan', n: { $sum: 1 } } },
    ]);
    const byLoan = new Map(counts.map((c) => [String(c._id), c.n]));

    const taken = loans.reduce((a, l) => a + l.principal, 0);
    const repaid = loans.reduce((a, l) => a + l.settledAmount, 0);

    return {
      title: 'Loans - ' + account.name,
      fileBase: 'loans-' + account.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + todayStr(),
      columns: ACCOUNT_LOAN_COLUMNS,
      rows: loans.map((l) => ({
        ...l,
        date: fmtDay(l.entryDate),
        outstanding: Math.max(0, Math.round((l.principal - l.settledAmount) * 100) / 100),
        repayments: byLoan.get(String(l._id)) || 0,
      })),
      summaryLines: [
        ['Account', account.name, false],
        ['Account no', account.accountNumber, false],
        ['Mobile', account.mobile || '-', false],
        ['Loans', loans.length, false],
        ['Open loans', loans.filter((l) => l.status === 'open').length, false],
        ['Closed loans', loans.filter((l) => l.status === 'closed').length, false],
        ['Total put in', taken, true],
        ['Total repaid', repaid, true],
        ['Still owed', Math.max(0, taken - repaid), true],
      ],
    };
  }

  if (type === 'customers') {
    const rows = await Customer.find({ shopOwner: ownerId }).populate('machine', 'name').sort({ name: 1 }).lean();
    return {
      title: 'Customers', fileBase: 'customers-' + todayStr(),
      columns: CUSTOMER_COLUMNS,
      rows: rows.map((r) => ({ ...r, machineName: r.machine?.name || '-' })),
      summaryLines: [['Customers', rows.length, false]],
    };
  }

  if (type === 'machines') {
    const rows = await CardMachine.find({ shopOwner: ownerId }).sort({ name: 1 }).lean();
    return {
      title: 'Card Machines', fileBase: 'machines-' + todayStr(),
      columns: MACHINE_COLUMNS, rows,
      summaryLines: [['Machines', rows.length, false]],
    };
  }

  if (type === 'customer-report') {
    const data = await runReport(customerReport, ownerId, query);
    return {
      title: 'Customer Report' + (query.month ? ' - ' + query.month : '') + mark,
      fileBase: 'customer-report-' + (query.month || todayStr()) + tag,
      columns: company ? CUST_REPORT_COMPANY_COLUMNS : CUST_REPORT_COLUMNS,
      rows: data.customers,
      summaryLines: txnSummaryLines(data.summary),
    };
  }

  if (type === 'machine-report') {
    const data = await runReport(machineReport, ownerId, query);
    return {
      title: 'Machine Report' + (query.month ? ' - ' + query.month : '') + mark,
      fileBase: 'machine-report-' + (query.month || todayStr()) + tag,
      columns: MACHINE_REPORT_COLUMNS, rows: data.machines,
      summaryLines: txnSummaryLines(data.summary),
    };
  }

  // One machine's daily, weekly or monthly report, with the same two copies
  // as the shop-wide period reports.
  if (type === 'machine-period') {
    const machine = await CardMachine.findOne({ _id: query.machine, shopOwner: ownerId }).lean();
    if (!machine) throw Object.assign(new Error('Card machine not found'), { status: 404 });

    const period = ['weekly', 'monthly'].includes(query.period) ? query.period : 'daily';
    const r = periodWindow(period, query.date || todayStr());
    const only = { machine: machine._id };
    const rows = await Transaction.find({ shopOwner: ownerId, ...only, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    const periodName = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[period];
    const slug = machine.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      title: `${machine.name} - ${periodName} Report - ${r.label}` + mark,
      fileBase: `${slug}-${period}-${r.label.replace(/ /g, '-')}` + tag,
      columns: periodColumns, rows: rows.map(txnRow),
      summaryLines: periodSummary(await summarise(ownerId, r, only)),
    };
  }

  // Default: whatever the Transactions screen is currently filtered to.
  const rows = await Transaction.find(buildFilter(query, ownerId)).sort({ txnDate: -1 }).lean();
  return {
    title: 'Transactions' + mark, fileBase: 'transactions-' + todayStr() + tag,
    columns: txnColumns, rows: rows.map(txnRow),
    summaryLines: txnSummaryLines(await summarise(ownerId, null)),
  };
}

function incomeExpenseFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };
  if (query.category) filter.category = query.category;
  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }
  return filter;
}

/** The report controllers are Express handlers; capture their JSON here. */
function runReport(handler, ownerId, query) {
  return new Promise((resolve, reject) => {
    const req = { user: { _id: ownerId }, shopId: ownerId, query };
    const res = { json: resolve };
    Promise.resolve(handler(req, res, reject)).catch(reject);
  });
}

/* --- PDF summary ---------------------------------------------------------- */

const pdfMoney = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Colour for a summary figure, read from its label: what the shop earns in
 * green, what goes to the card company or is still out in red, what is owed
 * to the shop in indigo, everything else in ink.
 */
function summaryTone(label) {
  if (/margin|profit|received/i.test(label)) return '#047857';
  if (/fee|still with|short|repaid|withdrawn|expense/i.test(label)) return '#be123c';
  if (/due|owed|outstanding/i.test(label)) return '#4f46e5';
  return '#0f172a';
}

/**
 * The summary as a grid of tiles - a small grey label over a bold figure -
 * four to a row, so the totals read at a glance instead of as a list.
 * Leaves doc.y just below the grid.
 */
function drawSummaryTiles(doc, lines, x0, width) {
  if (!lines.length) return;

  const perRow = Math.min(4, lines.length);
  const gap = 10;
  const tileW = (width - gap * (perRow - 1)) / perRow;
  const tileH = 46;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b')
    .text('SUMMARY', x0, doc.y, { characterSpacing: 1 });
  doc.moveDown(0.5);
  const top = doc.y;

  lines.forEach(([label, value, isMoney], i) => {
    const x = x0 + (i % perRow) * (tileW + gap);
    const y = top + Math.floor(i / perRow) * (tileH + gap);
    const tone = summaryTone(label);

    doc.roundedRect(x, y, tileW, tileH, 5).lineWidth(0.75).fillAndStroke('#f8fafc', '#e2e8f0');
    // A coloured edge ties each tile to the meaning of its figure.
    doc.rect(x, y + 5, 2.5, tileH - 10).fill(tone);

    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
      .text(label.toUpperCase(), x + 11, y + 8, { width: tileW - 18, lineBreak: false, ellipsis: true });

    const shown = isMoney ? pdfMoney.format(Number(value) || 0) : String(value);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(tone)
      .text(shown, x + 11, y + 22, { width: tileW - 18, lineBreak: false, continued: isMoney });
    if (isMoney) doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('  AED', { lineBreak: false });
  });

  const rowsUsed = Math.ceil(lines.length / perRow);
  doc.font('Helvetica');
  doc.x = x0;
  doc.y = top + rowsUsed * tileH + (rowsUsed - 1) * gap + 18;
}

export const exportExcel = asyncHandler(async (req, res) => {
  const { title, fileBase, columns, rows, summaryLines } = await gatherReport(req.query, req.shopId);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cash Book';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  rows.forEach((r) => sheet.addRow(r));

  columns.filter((c) => c.money).forEach((c) => {
    sheet.getColumn(c.key).numFmt = '"AED" #,##0.00';
  });
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: columns.length } };

  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Value', key: 'value', width: 18 },
  ];
  sum.getRow(1).font = { bold: true };
  sum.addRow({ metric: 'Report', value: title });
  summaryLines.forEach(([metric, value]) => sum.addRow({ metric, value }));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fileBase + '.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

export const exportPdf = asyncHandler(async (req, res) => {
  const { title, fileBase, columns, rows, summaryLines } = await gatherReport(req.query, req.shopId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fileBase + '.pdf"');

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  doc.pipe(res);

  const startX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // --- heading ---
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(title, startX, doc.y);
  doc.font('Helvetica').fontSize(9).fillColor('#64748b')
    .text('Generated ' + fmtDate(new Date()) + '   ·   All amounts in AED');
  doc.moveDown(0.6);
  doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).lineWidth(0.75).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.9);

  drawSummaryTiles(doc, summaryLines, startX, pageWidth);

  // The table always spans the page: the columns' pdf widths are relative,
  // stretched (or squeezed) to the printable width.
  const scale = pageWidth / columns.reduce((a, c) => a + (c.pdf || 60), 0);
  const colWidth = (c) => (c.pdf || 60) * scale;
  const tableWidth = pageWidth;

  // PDFKit wraps at spaces whenever it is given a width, even with lineBreak
  // off, which spills a long cell into the row below. Trim to fit instead.
  const fit = (text, width) => {
    let str = String(text);
    if (doc.widthOfString(str) <= width) return str;
    while (str.length > 1 && doc.widthOfString(str + '…') > width) str = str.slice(0, -1);
    return str.trimEnd() + '…';
  };
  const cell = (text, x, y, c) => {
    const w = colWidth(c) - 6;
    doc.text(fit(text, w), x + 3, y, { lineBreak: false });
  };

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(startX, y - 2, tableWidth, 16).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8);
    let x = startX;
    columns.forEach((c) => {
      cell(c.header, x, y + 2, c);
      x += colWidth(c);
    });
    doc.y = y + 18;
    doc.fillColor('#334155');
  };

  drawHeader();
  doc.fontSize(8);

  rows.forEach((r, i) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      drawHeader();
      doc.fontSize(8);
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(startX, y - 2, tableWidth, 14).fill('#f1f5f9');
    doc.fillColor('#334155');
    let x = startX;
    columns.forEach((c) => {
      let v = r[c.key];
      if (c.money) v = Number(v || 0).toFixed(2);
      else if (v === undefined || v === null || v === '') v = '-';
      cell(v, x, y, c);
      x += colWidth(c);
    });
    doc.y = y + 14;
  });

  if (!rows.length) {
    doc.moveDown().fillColor('#94a3b8').text('No records for this report.');
  }

  doc.end();
});
