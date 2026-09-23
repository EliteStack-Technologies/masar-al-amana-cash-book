'use client';

import { downloadUrl } from '@/lib/api';
import { money } from '@/lib/format';
import { Button, Card, Figure, Row, SectionTitle, SplitRail } from '@/components/ui';
import { IconDownload } from '@/components/Icons';

/** Excel + PDF buttons wired to the same report params. */
export function ExportButtons({ params }) {
  return (
    <div className="flex gap-2.5">
      {['excel', 'pdf'].map((format) => (
        <a
          key={format}
          href={downloadUrl(format, params)}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button type="button" variant="soft" className="w-full">
            <IconDownload size={17} /> {format === 'excel' ? 'Excel' : 'PDF'}
          </Button>
        </a>
      ))}
    </div>
  );
}

/** The headline figures every report shares, set as a ruled block. */
export function ReportHeadline({ summary }) {
  return (
    <Card className="p-0">
      <div className="grid grid-cols-2">
        <div className="border-r border-[var(--rule)] p-3.5">
          <Figure label="Cash out" value={money(summary.givenAmount)} size="lg" />
        </div>
        <div className="p-3.5">
          <Figure label="Swiped" value={money(summary.swipedAmount)} size="lg" />
        </div>
      </div>
      <div className="border-t border-[var(--rule)] p-3.5">
        <SplitRail
          segments={[
            { label: 'Customers', value: summary.givenAmount, tone: 'ink' },
            { label: 'Margin', value: summary.margin, tone: 'leaf' },
            { label: 'Supplier', value: summary.supplierFee, tone: 'quiet' },
          ]}
        />
      </div>
    </Card>
  );
}

/** Full figure list, in the same order as the shop's own sheet. */
export function ReportBreakdown({ summary, title = 'Full breakdown' }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Card className="ruled py-0">
        <Row label="Swipes" value={summary.count} isMoney={false} />
        <Row label="Swiped on cards" value={summary.swipedAmount} />
        <Row label="Cash given to customers" value={summary.givenAmount} />
        <Row label="Charged to customers" value={summary.chargeToCustomer} strong />
        <Row label="Supplier fee" value={summary.supplierFee} tone="stamp" />
        <Row label="Margin" sub="Charge less the supplier fee" value={summary.margin} tone="leaf" />
        <Row label="Profit" sub="On settled swipes only" value={summary.profit} tone="leaf" strong />
        <Row label="Settlement received" value={summary.receivedAmount} tone="leaf" />
        <Row label="Still with the card company" value={summary.pendingAmount} tone="stamp" />
      </Card>
    </section>
  );
}

/** Period picker, set on a rule at the top of each report. */
export function PeriodPicker({ type, value, onChange, label }) {
  return (
    <label className="card flex items-center gap-3 p-3">
      <span className="colhead shrink-0">{label}</span>
      <input
        className="field ref flex-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
