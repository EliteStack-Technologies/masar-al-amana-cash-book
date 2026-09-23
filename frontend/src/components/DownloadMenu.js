'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadUrl } from '@/lib/api';
import { Button, cx } from '@/components/ui';
import { IconDownload } from '@/components/Icons';

/**
 * The two copies of every swipe report: the full sheet we keep, and the
 * trimmed one handed to the card company (no customer mobiles, no supplier %).
 */
export const REPORT_COPIES = [
  {
    variant: null,
    title: 'Full report',
    detail: 'Everything, for our own records',
  },
  {
    variant: 'company',
    title: 'Card company copy',
    detail: 'To share — no mobile numbers, no supplier %',
  },
];

/**
 * The daily, weekly and monthly reports: the full sheet we keep, and a short
 * six-column swipe list for the card company.
 */
export const PERIOD_COPIES = [
  {
    variant: null,
    title: 'Full report',
    detail: 'For our own records — no settlement, profit or status',
  },
  {
    variant: 'company',
    title: 'Card company copy',
    detail: 'Txn no, date, customer, swipe, card charge, due amount',
  },
];

/** Sheets with nothing to hold back: one copy, no heading over the buttons. */
const PLAIN_COPIES = [{ variant: null, title: null, detail: null }];

const FORMATS = [
  { format: 'excel', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
];

/**
 * Sits in the title bar. Tapping it drops a sheet of downloads — Excel and
 * PDF for each copy on offer.
 */
export function DownloadMenu({ params, copies = PLAIN_COPIES, label = 'Download' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'flex size-9 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)]',
          open && 'bg-[var(--paper-2)]'
        )}
      >
        <IconDownload size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            'card rise absolute right-0 top-11 z-40 p-0 shadow-lg',
            copies.length > 1 ? 'w-[248px]' : 'w-[184px]'
          )}
        >
          {copies.map(({ variant, title, detail }) => (
            <div
              key={title || 'plain'}
              className="border-b border-[var(--rule)] last:border-b-0"
            >
              {title && (
                <div className="px-3.5 pb-1.5 pt-3">
                  <p className="display text-[13.5px] font-bold leading-tight">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug muted-2">{detail}</p>
                </div>
              )}
              <div className={cx('flex gap-2 px-3.5 pb-3', title ? 'pt-1' : 'pt-3')}>
                {FORMATS.map(({ format, label: fmtLabel }) => (
                  <a
                    key={format}
                    role="menuitem"
                    href={downloadUrl(format, variant ? { ...params, variant } : params)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                  >
                    <Button type="button" variant="soft" className="w-full !min-h-9 !px-2 !text-[13px]">
                      <IconDownload size={15} /> {fmtLabel}
                    </Button>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
