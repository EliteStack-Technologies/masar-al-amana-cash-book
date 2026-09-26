'use client';

import { money } from '@/lib/format';
import { Amt, EyeToggle, amountText, isLarge, useAmounts } from '@/components/Amount';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('card p-4', className)} {...rest}>
      {children}
    </div>
  );
}

/** A column head printed on a rule, the way a ledger page labels its columns. */
export function SectionTitle({ children, action }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 border-b border-[var(--rule)] pb-1.5">
      <h2 className="colhead">{children}</h2>
      {action}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-500 text-white active:bg-brand-600 shadow-sm',
  stamp: 'bg-brand-500 text-white active:bg-brand-600 shadow-sm',
  soft: 'border border-[var(--rule-strong)] bg-[var(--paper-3)] active:bg-[var(--paper-2)]',
  ghost: 'active:bg-[var(--paper-2)]',
  danger: 'bg-stamp-500 text-white active:bg-stamp-600 shadow-sm',
};

export function Button({ variant = 'primary', className, loading, children, ...rest }) {
  return (
    <button
      className={cx(
        // min-h-11 keeps every control at a comfortable thumb target.
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Spinner size={15} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    // min-w-0: in a two-column grid a field may shrink to its column instead
    // of being held open by its input (iOS date inputs especially).
    <label className={cx('block min-w-0', className)}>
      <span className="colhead mb-1.5 block">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] muted-2">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-stamp-500">{error}</span>}
    </label>
  );
}

/** Settlement status, set as a stamped mark rather than a pill. */
export function StatusPill({ status, className }) {
  const received = status === 'received';
  return (
    <span
      className={cx(
        'stamp-mark',
        received ? 'text-leaf-500 dark:text-leaf-400' : 'text-stamp-500 dark:text-stamp-400',
        className
      )}
    >
      {received ? 'Received' : 'Owed'}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   SplitRail — the signature.

   One sum dividing into its parts. For a transaction the whole is the card
   amount and the parts are the customer's cash, the owner's commission and the
   card company's commission — exact in both commission modes. The same grammar
   carries received-vs-owed and the commission report.
   --------------------------------------------------------------------------- */
const RAIL_TONES = {
  ink: 'bg-ink-900 dark:bg-ink-200',
  leaf: 'bg-leaf-500 dark:bg-leaf-400',
  stamp: 'bg-stamp-500 dark:bg-stamp-400',
  quiet: 'bg-ink-400',
};

const RAIL_TEXT = {
  ink: '',
  leaf: 'text-leaf-500 dark:text-leaf-400',
  stamp: 'text-stamp-500 dark:text-stamp-400',
  quiet: 'muted-2',
};

export function SplitRail({ total, segments, caption, size = 'md', animate = true }) {
  const parts = segments.filter((s) => s.value > 0);
  const sum = parts.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <div>
      <div
        className={cx(
          'flex w-full overflow-hidden',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
          animate && 'rail-in'
        )}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${money(s.value)}`).join(', ')}
      >
        {parts.map((s, i) => (
          <div
            key={s.label}
            className={cx(
              RAIL_TONES[s.tone],
              // A hard hairline at each division, like a ruled column edge.
              i > 0 && 'border-l border-[var(--paper-3)]'
            )}
            style={{ width: `${(s.value / sum) * 100}%` }}
          />
        ))}
      </div>

      {size !== 'sm' && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={cx('size-2 shrink-0', RAIL_TONES[s.tone])} />
              <span className="colhead">{s.label}</span>
              <span className={cx('sum text-[13px]', RAIL_TEXT[s.tone])}><Amt value={s.value} /></span>
            </div>
          ))}
        </div>
      )}

      {caption && <p className="mt-2 text-[11.5px] leading-snug muted-2">{caption}</p>}
    </div>
  );
}

/**
 * A labelled amount inside a ruled block. Replaces the tile grid — figures sit
 * in columns like a ledger, not in floating cards.
 *
 * Pass `amount` (a number) rather than a formatted `value` and the figure
 * looks after itself: large amounts read short (K / L / Cr) with the eye
 * beside the label, and the text steps down to fit `fit` px of width, so it
 * never runs out of its column. `value` is still used as is for counts.
 */
export function Figure({ label, value, amount, sub, tone, size = 'md', fit = 120, className }) {
  const { exact } = useAmounts();
  const isAmount = amount !== undefined && amount !== null;
  const text = isAmount ? amountText(amount, exact) : value;
  const max = size === 'lg' ? 26 : 18;
  // About 0.6em a character in the figure face.
  const fitted = isAmount ? Math.max(11, Math.min(max, Math.floor(fit / (0.6 * String(text).length)))) : null;

  return (
    <div className={cx('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="colhead min-w-0">{label}</p>
        {isAmount && isLarge(amount) ? <EyeToggle size={15} /> : null}
      </div>
      <p
        className={cx(
          'sum mt-1',
          isAmount ? 'break-all leading-tight' : 'leading-none',
          !isAmount && (size === 'lg' ? 'text-[26px]' : 'text-[18px]'),
          tone ? RAIL_TEXT[tone] : ''
        )}
        style={fitted ? { fontSize: fitted } : undefined}
        title={isAmount ? money(amount) : undefined}
      >
        {text}
      </p>
      {sub && <p className="mt-1 text-[11px] leading-snug muted-2">{sub}</p>}
    </div>
  );
}

/**
 * An entry in a ledger block: label on the left, figure on the right.
 * Ruled separation comes from the parent's `ruled` utility.
 */
export function Row({ label, value, sub, strong, tone, isMoney = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className={cx('text-[13.5px]', strong ? 'font-semibold' : 'muted')}>{label}</span>
        {sub && <span className="ref mt-0.5 block text-[10.5px] muted-2">{sub}</span>}
      </span>
      <span
        className={cx(
          'sum shrink-0',
          strong ? 'text-[16px]' : 'text-[14.5px] font-semibold',
          tone ? RAIL_TEXT[tone] : ''
        )}
      >
        {isMoney ? <Amt value={value} /> : value}
      </span>
    </div>
  );
}

export function Divider({ className }) {
  return <div className={cx('h-px bg-[var(--rule)]', className)} />;
}

export function Empty({ icon: Icon, title, hint, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 border border-[var(--rule)] p-2.5 muted-2">
          <Icon size={22} />
        </div>
      )}
      <p className="display text-[15px] font-bold">{title}</p>
      {hint && <p className="mt-1 max-w-[17rem] text-[13px] leading-snug muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }) {
  if (!children) return null;
  return (
    <p
      className={cx(
        'border-l-2 border-stamp-500 bg-[var(--paper-2)] px-3 py-2.5 text-[13px] text-stamp-500 dark:text-stamp-400',
        className
      )}
      role="alert"
    >
      {children}
    </p>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse bg-[var(--paper-2)]', className)} />;
}

/** Tabs set on a rule, the active one marked by a solid ink bar. */
export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cx('flex gap-5 border-b border-[var(--rule)]', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cx(
            'colhead -mb-px shrink-0 border-b-2 pb-2 pt-1 transition-colors',
            value === opt.value
              ? 'border-stamp-500 !text-[var(--text)]'
              : 'border-transparent'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
