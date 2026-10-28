import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface TableSearchBarSecondaryDropdown {
  showForFields?: string[];
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface TableSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchFields?: { label: string; value: string }[];
  selectedField?: string;
  onSelectedFieldChange?: (field: string) => void;
  secondaryDropdown?: TableSearchBarSecondaryDropdown;
  onToggleAdvancedFilter?: () => void;
  isAdvancedFilterOpen?: boolean;
  activeFilterCount?: number;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const TableSearchBar: React.FC<TableSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  searchFields = [{ label: 'Search Any', value: 'all' }],
  selectedField: propSelectedField,
  onSelectedFieldChange,
  secondaryDropdown,
  inputRef,
}) => {
  const [internalSelectedField, setInternalSelectedField] = useState(searchFields[0]?.value || 'all');
  const activeSelectedField = propSelectedField !== undefined ? propSelectedField : internalSelectedField;

  const handleFieldChange = (newVal: string) => {
    setInternalSelectedField(newVal);
    onSelectedFieldChange?.(newVal);
  };

  const [localText, setLocalText] = useState(searchQuery);

  useEffect(() => {
    setLocalText(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localText);
  };

  const handleClear = () => {
    setLocalText('');
    onSearchChange('');
  };

  const showSecondaryDropdown =
    Boolean(secondaryDropdown) &&
    (!secondaryDropdown?.showForFields || secondaryDropdown.showForFields.includes(activeSelectedField));

  const activeFieldObj = searchFields.find((f) => f.value === activeSelectedField);
  const dynamicPlaceholder =
    showSecondaryDropdown && secondaryDropdown?.value
      ? `Filter within ${secondaryDropdown.value}...`
      : activeSelectedField && activeSelectedField !== 'all' && activeFieldObj
      ? `Search ${activeFieldObj.label}...`
      : 'Search keywords...';

  return (
    <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-white border-b border-[#e2e6ec] gap-2">
      {/* Left: Search Any ▾ + (Optional secondary dropdown ▾) + input + search button */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 flex-1 max-w-xl">
        <div className="relative shrink-0">
          <select
            value={activeSelectedField}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="appearance-none pl-2.5 pr-6 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500 hover:bg-slate-200/70 transition-colors"
          >
            {searchFields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Secondary dropdown (e.g. Job Titles when Job Title is chosen) */}
        {showSecondaryDropdown && secondaryDropdown && (
          <div className="relative shrink-0 flex items-center animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="relative">
              <select
                value={secondaryDropdown.value}
                onChange={(e) => secondaryDropdown.onChange(e.target.value)}
                className="appearance-none pl-2.5 pr-6 py-1 bg-blue-50/90 border border-blue-300 hover:border-blue-400 text-blue-900 font-semibold rounded text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-w-[210px] truncate shadow-2xs transition-colors"
                title={secondaryDropdown.value ? `Selected: ${secondaryDropdown.value}` : 'Select an option'}
              >
                <option value="">{secondaryDropdown.placeholder || 'Select an option'}</option>
                {secondaryDropdown.options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-normal">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-600 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {secondaryDropdown.value && (
              <button
                type="button"
                onClick={() => secondaryDropdown.onChange('')}
                title="Clear selection"
                className="ml-1 p-0.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="relative flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            placeholder={dynamicPlaceholder}
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              onSearchChange(e.target.value);
            }}
            className="w-full pl-2.5 pr-6 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs transition-all"
          />
          {localText && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="submit"
          title="Search"
          className="px-2.5 py-1 bg-[#1467d6] hover:bg-blue-700 text-white rounded text-xs flex items-center justify-center shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
