'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { money, moneyCompact } from '@/lib/format';
import { IconEye, IconEyeOff } from '@/components/Icons';

/**
 * Large amounts - one lakh and up - read short across the app (AED 2.5L,
 * AED 8.38Cr) so they fit phone-width columns. One eye, in the title bar or
 * beside any big figure, switches every amount to the exact figure and back;
 * the choice is remembered on this device.
 */
export const LARGE = 100000;
const KEY = 'cb.exactAmounts';

const AmountsContext = createContext({ exact: false, toggle: () => {} });

export function AmountsProvider({ children }) {
  const [exact, setExact] = useState(false);

  useEffect(() => {
    try {
      setExact(localStorage.getItem(KEY) === '1');
    } catch {
      /* private mode or blocked storage: start short */
    }
  }, []);

  const toggle = useCallback(() => {
    setExact((v) => {
      try {
        localStorage.setItem(KEY, v ? '0' : '1');
      } catch {
        /* not remembered, still switches */
      }
      return !v;
    });
  }, []);

  return <AmountsContext.Provider value={{ exact, toggle }}>{children}</AmountsContext.Provider>;
}

export const useAmounts = () => useContext(AmountsContext);

export const isLarge = (n) => Math.abs(Number(n) || 0) >= LARGE;

/** The text for an amount under the current setting. */
export const amountText = (n, exact) => (exact || !isLarge(n) ? money(n) : moneyCompact(n));

/** An amount inline in text. The exact figure is always in the tooltip. */
export function Amt({ value }) {
  const { exact } = useAmounts();
  return <span title={money(value)}>{amountText(value, exact)}</span>;
}

/**
 * The eye. Works inside a link: it only toggles, never navigates.
 * `boxed` gives it the square title-bar button look.
 */
export function EyeToggle({ size = 16, boxed = false, className = '' }) {
  const { exact, toggle } = useAmounts();
  const Eye = exact ? IconEyeOff : IconEye;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-label={exact ? 'Show large amounts in short (K, L, Cr)' : 'Show exact amounts'}
      aria-pressed={exact}
      title={exact ? 'Short amounts' : 'Exact amounts'}
      className={
        boxed
          ? `flex size-9 shrink-0 items-center justify-center border border-[var(--rule-strong)] active:bg-[var(--paper-2)] ${className}`
          : `-m-1.5 shrink-0 p-1.5 muted-2 active:text-[var(--text)] ${className}`
      }
    >
      <Eye size={size} />
    </button>
  );
}
