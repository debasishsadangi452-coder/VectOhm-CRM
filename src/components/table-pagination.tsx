import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES } from "@/hooks/use-pagination";

interface TablePaginationProps {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  firstRow: number;
  lastRow: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  // "companies" / "contacts" / "deals" -- keeps the readout in the caller's words.
  noun?: string;
}

export function TablePagination({
  total,
  page,
  pageCount,
  pageSize,
  firstRow,
  lastRow,
  onPageChange,
  onPageSizeChange,
  noun = "rows",
}: TablePaginationProps) {
  // A single page of results needs no controls at all.
  if (total <= PAGE_SIZES[0] && pageCount <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-text-dim">
        Showing <span className="font-mono text-foreground">{firstRow}</span>–
        <span className="font-mono text-foreground">{lastRow}</span> of{" "}
        <span className="font-mono text-foreground">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[104px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 font-mono text-xs text-text-dim">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
