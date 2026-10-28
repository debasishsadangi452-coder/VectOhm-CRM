import React, { useState } from 'react';
import { Filter, X, Check } from 'lucide-react';
import { ColumnFilter } from './types';

interface ColumnFilterPopoverProps {
  field: string;
  currentFilter?: ColumnFilter;
  onApply: (filter: ColumnFilter | null) => void;
}

export const ColumnFilterPopover: React.FC<ColumnFilterPopoverProps> = ({
  field,
  currentFilter,
  onApply,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [operator, setOperator] = useState<ColumnFilter['operator']>(
    currentFilter?.operator || 'contains'
  );
  const [value, setValue] = useState(currentFilter?.value || '');

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (operator === 'isEmpty') {
      onApply({ field, operator, value: 'true' });
    } else if (value.trim()) {
      onApply({ field, operator, value: value.trim() });
    } else {
      onApply(null);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setValue('');
    onApply(null);
    setIsOpen(false);
  };

  const hasActiveFilter = !!currentFilter;

  return (
    <div className="relative inline-block ml-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title={`Filter ${field}`}
        className={`p-0.5 rounded transition-colors ${
          hasActiveFilter
            ? 'text-blue-600 bg-blue-100 ring-1 ring-blue-400'
            : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
        }`}
      >
        <Filter className="w-3 h-3 fill-current" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 mt-1 w-52 bg-white rounded-md shadow-xl border border-slate-200 p-2.5 z-50 text-xs font-normal text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 font-semibold text-slate-800">
            <span>Filter Column</span>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-slate-400 font-medium mb-1">Operator</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as any)}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="startsWith">Starts With</option>
                <option value="isEmpty">Is Empty</option>
              </select>
            </div>

            {operator !== 'isEmpty' && (
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Value</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter keyword..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-500 hover:text-rose-600 font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleApply()}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
