'use client';

import { downloadUrl } from '@/lib/api';
import { money } from '@/lib/format';
import { Button, Card, Divider, Figure, Row, SectionTitle, SplitRail } from '@/components/ui';
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
          <Figure label="Cash out" value={money(summary.customerReceived)} size="lg" />
        </div>
        <div className="p-3.5">
          <Figure label="Card in" value={money(summary.cardAmount)} size="lg" />
        </div>
      </div>
      <div className="border-t border-[var(--rule)] p-3.5">
        <SplitRail
          segments={[
            { label: 'Customers', value: summary.customerReceived, tone: 'ink' },
            { label: 'Yours', value: summary.ownerCommission, tone: 'leaf' },
            { label: 'Card co.', value: summary.companyCommission, tone: 'quiet' },
          ]}
        />
      </div>
    </Card>
  );
}

/** Full figure list, matching the spec's daily/monthly report fields. */
export function ReportBreakdown({ summary, title = 'Full breakdown' }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Card className="ruled py-0">
        <Row label="Entries" value={summary.count} isMoney={false} />
        <Row label="Cash given to customers" value={summary.customerReceived} />
        <Row label="Card transactions" value={summary.cardAmount} />
        <Row label="Commission charged" value={summary.commissionAmount} strong />
        <Row label="Your share" value={summary.ownerCommission} tone="leaf" />
        <Row label="Card company's share" value={summary.companyCommission} />
        <Row label="Settlement received" value={summary.receivedAmount} tone="leaf" />
        <Row label="Settlement owed" value={summary.pendingAmount} tone="stamp" />
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
