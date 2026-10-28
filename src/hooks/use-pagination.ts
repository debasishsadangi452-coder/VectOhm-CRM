import { useMemo, useState } from "react";

export const PAGE_SIZES = [25, 50, 100] as const;

// Slices a client-side list into pages. The page is *clamped* rather than
// reset by an effect: when a filter shrinks the list under the current page,
// the render immediately falls back to the last valid page instead of
// flashing an empty table for one frame first.
export function usePagination<T>(items: T[] | undefined, initialSize: number = PAGE_SIZES[0]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialSize);

  const total = items?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  const pageItems = useMemo(
    () => (items ?? []).slice(start, start + pageSize),
    [items, start, pageSize],
  );

  return {
    pageItems,
    total,
    page: safePage,
    pageCount,
    pageSize,
    // Row numbers as a human counts them: 1-based, and 0 of 0 when empty.
    firstRow: total === 0 ? 0 : start + 1,
    lastRow: Math.min(start + pageSize, total),
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}
