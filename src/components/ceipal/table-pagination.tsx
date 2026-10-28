import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  legacyStyle?: boolean; // For Placements legacy sub-theme: "Show [25 ▾]"
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  legacyStyle = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate numbered pages: 1, 2, 3, 4, 5 ... totalPages
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#f8fafc] border-t border-[#e2e6ec] text-xs text-slate-600 select-none gap-2">
      {/* Left: Info text */}
      <div className="font-medium text-slate-600">
        {totalItems === 0 ? (
          <span>Showing 0 to 0 of 0 entries</span>
        ) : (
          <span>
            {startItem} - {endItem} of {totalItems.toLocaleString()}
          </span>
        )}
      </div>

      {/* Center: Pagination Buttons (if items exist) */}
      {totalItems > 0 && totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First */}
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            title="First Page"
            className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          {/* Prev */}
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            title="Previous Page"
            className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Numbered buttons */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1.5 py-0.5 text-slate-400">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(Number(p))}
                className={`min-w-[24px] h-[24px] px-1 rounded text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'font-bold shadow-xs'
                    : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
                style={isCurrent ? { backgroundColor: '#1467d6', color: '#ffffff' } : {}}
              >
                {p}
              </button>
            );
          })}

          {/* Next */}
          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            title="Next Page"
            className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {/* Last */}
          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Last Page"
            className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right: Per Page selector */}
      <div className="flex items-center gap-1.5">
        {legacyStyle ? (
          <div className="flex items-center gap-1">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} ▾
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="text-slate-500">Per Page</span>
          </div>
        )}
      </div>
    </div>
  );
};
