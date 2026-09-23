import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Loan from '../models/Loan.js';
import Customer from '../models/Customer.js';
import CardMachine from '../models/CardMachine.js';
import { asyncHandler } from '../middleware/error.js';
import { buildFilter } from './transactionController.js';
import {
  summarise, moneySum, loanTotals, customerReport, machineReport,
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
  { header: 'Date', key: 'date', width: 18, pdf: 80 },
  { header: 'Customer', key: 'customerName', width: 18, pdf: 74 },
  { header: 'Mobile', key: 'customerMobile', width: 14, pdf: 62 },
  { header: 'Swiped', key: 'swipedAmount', width: 12, pdf: 52, money: true },
  { header: 'Given', key: 'givenAmount', width: 12, pdf: 52, money: true },
  { header: 'Charge', key: 'chargeToCustomer', width: 11, pdf: 46, money: true },
  { header: 'Cust %', key: 'custPercent', width: 8, pdf: 36 },
  { header: 'Comm', key: 'commissionType', width: 10, pdf: 42 },
  { header: 'Supp %', key: 'supplierPercent', width: 8, pdf: 36 },
  { header: 'Supplier Fee', key: 'supplierFee', width: 12, pdf: 50, money: true },
  { header: 'Margin', key: 'margin', width: 11, pdf: 46, money: true },
  { header: 'Supplier A/C', key: 'supplierAccount', width: 13, pdf: 54, money: true },
  { header: 'Settlement', key: 'settlement', width: 13, pdf: 54 },
  { header: 'Profit', key: 'profitShown', width: 11, pdf: 46 },
  { header: 'Status', key: 'settlementStatus', width: 11, pdf: 46 },
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
  { header: 'Lender', key: 'lenderName', width: 20, pdf: 110 },
  { header: 'Mobile', key: 'lenderMobile', width: 14, pdf: 80 },
  { header: 'Date', key: 'date', width: 16, pdf: 84 },
  { header: 'Loan Taken', key: 'principal', width: 13, pdf: 74, money: true },
  { header: 'Repaid', key: 'settledAmount', width: 13, pdf: 74, money: true },
  { header: 'Outstanding', key: 'outstanding', width: 13, pdf: 74, money: true },
  { header: 'Status', key: 'status', width: 10, pdf: 54 },
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

  if (type === 'daily') {
    const date = query.date || todayStr();
    const r = dayRange(date);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: 'Daily Report - ' + date, fileBase: 'daily-' + date,
      columns: TXN_COLUMNS, rows: rows.map(txnRow),
      summaryLines: txnSummaryLines(await summarise(ownerId, r)),
    };
  }

  if (type === 'weekly') {
    const date = query.date || todayStr();
    const r = weekRange(date);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: `Weekly Report - ${r.start} to ${r.end}`, fileBase: 'weekly-' + r.start,
      columns: TXN_COLUMNS, rows: rows.map(txnRow),
      summaryLines: txnSummaryLines(await summarise(ownerId, r)),
    };
  }

  if (type === 'monthly' || type === 'commission') {
    const month = query.month || todayStr().slice(0, 7);
    const r = monthRange(month);
    const rows = await Transaction.find({ shopOwner: ownerId, txnDate: { $gte: r.from, $lt: r.to } })
      .sort({ txnDate: 1 }).lean();
    return {
      title: (type === 'commission' ? 'Commission' : 'Monthly') + ' Report - ' + month,
      fileBase: type + '-' + month,
      columns: TXN_COLUMNS, rows: rows.map(txnRow),
      summaryLines: txnSummaryLines(await summarise(ownerId, r)),
    };
  }

  if (type === 'settlement') {
    const rows = await Transaction.find({ shopOwner: ownerId, settlementStatus: 'pending' })
      .sort({ txnDate: 1 }).lean();
    return {
      title: 'Pending Settlements', fileBase: 'pending-settlements-' + todayStr(),
      columns: TXN_COLUMNS, rows: rows.map(txnRow),
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
      title: 'Customer Report' + (query.month ? ' - ' + query.month : ''),
      fileBase: 'customer-report-' + (query.month || todayStr()),
      columns: CUST_REPORT_COLUMNS, rows: data.customers,
      summaryLines: txnSummaryLines(data.summary),
    };
  }

  if (type === 'machine-report') {
    const data = await runReport(machineReport, ownerId, query);
    return {
      title: 'Machine Report' + (query.month ? ' - ' + query.month : ''),
      fileBase: 'machine-report-' + (query.month || todayStr()),
      columns: MACHINE_REPORT_COLUMNS, rows: data.machines,
      summaryLines: txnSummaryLines(data.summary),
    };
  }

  // Default: whatever the Transactions screen is currently filtered to.
  const rows = await Transaction.find(buildFilter(query, ownerId)).sort({ txnDate: -1 }).lean();
  return {
    title: 'Transactions', fileBase: 'transactions-' + todayStr(),
    columns: TXN_COLUMNS, rows: rows.map(txnRow),
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
    const req = { user: { _id: ownerId }, query };
    const res = { json: resolve };
    Promise.resolve(handler(req, res, reject)).catch(reject);
  });
}

export const exportExcel = asyncHandler(async (req, res) => {
  const { title, fileBase, columns, rows, summaryLines } = await gatherReport(req.query, req.user._id);

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
  const { title, fileBase, columns, rows, summaryLines } = await gatherReport(req.query, req.user._id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fileBase + '.pdf"');

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  doc.pipe(res);

  doc.fontSize(16).fillColor('#0f172a').text(title);
  doc.fontSize(9).fillColor('#64748b').text('Generated ' + fmtDate(new Date()));
  doc.moveDown(0.8);

  doc.fontSize(9).fillColor('#64748b').text('All amounts in AED');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#0f172a').text('Summary');
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#334155');
  summaryLines.forEach(([label, value, isMoney]) => {
    const shown = isMoney ? 'AED ' + Number(value).toFixed(2) : value;
    doc.text(label + ': ' + shown);
  });
  doc.moveDown(0.9);

  const startX = doc.page.margins.left;
  const tableWidth = columns.reduce((a, c) => a + (c.pdf || 60), 0);

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(startX, y - 2, tableWidth, 16).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8);
    let x = startX;
    columns.forEach((c) => {
      doc.text(c.header, x + 3, y + 2, { width: (c.pdf || 60) - 6, ellipsis: true, lineBreak: false });
      x += c.pdf || 60;
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
      doc.text(String(v), x + 3, y, { width: (c.pdf || 60) - 6, ellipsis: true, lineBreak: false });
      x += c.pdf || 60;
    });
    doc.y = y + 14;
  });

  if (!rows.length) {
    doc.moveDown().fillColor('#94a3b8').text('No records for this report.');
  }

  doc.end();
});
