'use client';

import { useState } from 'react';
import { Button, cx } from '@/components/ui';
import { IconBack, IconChevron } from '@/components/Icons';

/**
 * A page number that belongs to one set of filters: change the search or a
 * filter and it is back on page 1, with no extra render or fetch of the old
 * page in between. `filterKey` is anything that identifies the filters.
 */
export function usePageFor(filterKey) {
  const key = JSON.stringify(filterKey ?? '');
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  const setPage = (p) => setState({ key, page: p });
  return [page, setPage];
}

/**
 * Pages over a list that is already in memory (the cash book, a report's
 * swipes). Back on page 1 whenever `filterKey` changes.
 */
export function usePaged(items, size = 20, filterKey) {
  const [page, setPage] = usePageFor(filterKey);
  const list = items || [];
  const pages = Math.max(1, Math.ceil(list.length / size));
  // A list that shrank (after a delete, say) never leaves us past the end.
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    total: list.length,
    setPage,
    pageItems: list.slice((current - 1) * size, current * size),
  };
}

/**
 * Previous / next with where you are. Hidden when everything fits on one
 * page. Moving jumps back to the top so the new page is read from its start.
 */
export function Pager({ page, pages, total, noun = 'entries', onChange, className }) {
  if (!pages || pages <= 1) return null;

  const go = (p) => {
    onChange(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav aria-label="Pages" className={cx('flex items-center justify-between gap-3', className)}>
      <Button
        type="button"
        variant="soft"
        className="!min-h-10 !px-3"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        aria-label="Previous page"
      >
        <IconBack size={16} /> Prev
      </Button>
      <div className="text-center">
        <p className="sum text-[13.5px]">Page {page} of {pages}</p>
        {total !== undefined && <p className="text-[11px] muted-2">{total} {noun}</p>}
      </div>
      <Button
        type="button"
        variant="soft"
        className="!min-h-10 !px-3"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        aria-label="Next page"
      >
        Next <IconChevron size={16} />
      </Button>
    </nav>
  );
}
