import React, { useState, useMemo } from 'react';
import {
  Search,
  ThumbsUp,
  ChevronDown,
  Plus,
  ExternalLink,
  X,
  Building,
} from 'lucide-react';
import { useCeipal } from '../ceipal-context';
import { ViewTabsBar } from '../view-tabs-bar';
import { TableSearchBar } from '../table-search-bar';
import { TablePagination } from '../table-pagination';
import { ColumnFilterPopover } from '../column-filter-popover';
import { ClientItem } from '../types';
import { CreateClientPanel } from './create-client-panel';

export const ClientView: React.FC = () => {
  const {
    clients,
    addClient,
    columnFilters,
    setColumnFilter,
    clearColumnFilters,
    searchQuery,
    setSearchQuery,
  } = useCeipal();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedSearchField, setSelectedSearchField] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingClientView, setIsCreatingClientView] = useState(false);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        let match = false;
        if (selectedSearchField === 'name') {
          match = (c.name || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'website') {
          match = (c.website || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'industry') {
          match = (c.industry || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'primaryOwner') {
          match = (c.primaryOwner || '').toLowerCase().includes(q);
        } else {
          match =
            (c.name || '').toLowerCase().includes(q) ||
            (c.website || '').toLowerCase().includes(q) ||
            (c.industry || '').toLowerCase().includes(q) ||
            (c.primaryOwner || '').toLowerCase().includes(q) ||
            (c.id || '').toLowerCase().includes(q) ||
            (c.contactNumber || '').toLowerCase().includes(q);
        }
        if (!match) return false;
      }

      for (const [field, filter] of Object.entries(columnFilters)) {
        const val = String((c as any)[field] || '').toLowerCase();
        const fVal = filter.value.toLowerCase();
        if (filter.operator === 'contains' && !val.includes(fVal)) return false;
        if (filter.operator === 'equals' && val !== fVal) return false;
        if (filter.operator === 'startsWith' && !val.startsWith(fVal)) return false;
        if (filter.operator === 'isEmpty' && val.trim() !== '') return false;
      }

      return true;
    });
  }, [clients, searchQuery, selectedSearchField, columnFilters]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // If creating client, render full-page panel
  if (isCreatingClientView) {
    return (
      <CreateClientPanel
        onBack={() => setIsCreatingClientView(false)}
        onCreated={() => setIsCreatingClientView(false)}
      />
    );
  }

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800">
      {/* Tab Row directly under header: [Client ▾] + + Add View */}
      <ViewTabsBar
        defaultTitle="Client"
        rightActions={
          <>
            {/* Magnifying-glass icon button */}
            <button
              title="Search Clients"
              className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Thumbs-up icon button */}
            <button
              title="Approved Clients"
              className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
            </button>

            {/* + New Client button */}
            <button
              onClick={() => setIsCreatingClientView(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </>
        }
      />

      {/* Main Table Card */}
      <div className="p-3 flex-1 flex flex-col min-w-0">
        <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs flex-1 flex flex-col overflow-hidden">
          {/* Search/Filter row */}
          <TableSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedField={selectedSearchField}
            onSelectedFieldChange={(val) => {
              setSelectedSearchField(val);
              setCurrentPage(1);
            }}
            searchFields={[
              { label: 'Search Any', value: 'all' },
              { label: 'Client Name', value: 'name' },
              { label: 'Website', value: 'website' },
              { label: 'Industry', value: 'industry' },
              { label: 'Primary Owner', value: 'primaryOwner' },
            ]}
            activeFilterCount={Object.keys(columnFilters).length}
            onToggleAdvancedFilter={() => {
              if (Object.keys(columnFilters).length > 0) clearColumnFilters();
            }}
          />

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-[#f1f5f9] text-slate-800 border-b border-[#cbd5e1] font-bold z-10 select-none shadow-2xs">
                <tr>
                  <th className="w-9 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredClients.length > 0 && selectedIds.size === filteredClients.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Client Id</span>
                      <ColumnFilterPopover
                        field="id"
                        currentFilter={columnFilters.id}
                        onApply={(f) => setColumnFilter('id', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Client Name</span>
                      <ColumnFilterPopover
                        field="name"
                        currentFilter={columnFilters.name}
                        onApply={(f) => setColumnFilter('name', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Contact Number</span>
                      <ColumnFilterPopover
                        field="contactNumber"
                        currentFilter={columnFilters.contactNumber}
                        onApply={(f) => setColumnFilter('contactNumber', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Website</span>
                      <ColumnFilterPopover
                        field="website"
                        currentFilter={columnFilters.website}
                        onApply={(f) => setColumnFilter('website', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Industry</span>
                      <ColumnFilterPopover
                        field="industry"
                        currentFilter={columnFilters.industry}
                        onApply={(f) => setColumnFilter('industry', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Status</span>
                      <ColumnFilterPopover
                        field="status"
                        currentFilter={columnFilters.status}
                        onApply={(f) => setColumnFilter('status', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Category</span>
                      <ColumnFilterPopover
                        field="category"
                        currentFilter={columnFilters.category}
                        onApply={(f) => setColumnFilter('category', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Primary Owner</span>
                      <ColumnFilterPopover
                        field="primaryOwner"
                        currentFilter={columnFilters.primaryOwner}
                        onApply={(f) => setColumnFilter('primaryOwner', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Business Unit</span>
                      <ColumnFilterPopover
                        field="businessUnit"
                        currentFilter={columnFilters.businessUnit}
                        onApply={(f) => setColumnFilter('businessUnit', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Display on Job Posting</span>
                      <ColumnFilterPopover
                        field="displayOnJob"
                        currentFilter={columnFilters.displayOnJob}
                        onApply={(f) => setColumnFilter('displayOnJob', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Created by</span>
                      <ColumnFilterPopover
                        field="createdBy"
                        currentFilter={columnFilters.createdBy}
                        onApply={(f) => setColumnFilter('createdBy', f)}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 font-normal">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const isSelected = selectedIds.has(client.id);

                    return (
                      <tr
                        key={client.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {/* Checkbox with optional pink +1 badge */}
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(client.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            {client.hasBadge && (
                              <span className="inline-flex items-center justify-center px-1 py-0.2 bg-[#f43f5e] text-white text-[9px] font-bold rounded-full min-w-[16px] shadow-2xs">
                                +1
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Client Id */}
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                          {client.id}
                        </td>

                        {/* Client Name: Blue hyperlink */}
                        <td className="px-3 py-2 font-semibold">
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="text-[#1467d6] hover:underline"
                          >
                            {client.name}
                          </a>
                        </td>

                        {/* Contact Number */}
                        <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                          {client.contactNumber}
                        </td>

                        {/* Website: Blue hyperlink */}
                        <td className="px-3 py-2">
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#1467d6] hover:underline flex items-center gap-1"
                          >
                            <span>{client.website.replace('https://', '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        </td>

                        {/* Industry */}
                        <td className="px-3 py-2 text-slate-600">{client.industry}</td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          <span className="text-emerald-700 font-semibold">{client.status}</span>
                        </td>

                        {/* Category */}
                        <td className="px-3 py-2 text-slate-700 font-medium">
                          {client.category ? (
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10.5px] font-semibold">
                              {client.category}
                            </span>
                          ) : (
                            ''
                          )}
                        </td>

                        {/* Primary Owner */}
                        <td className="px-3 py-2 text-slate-700">{client.primaryOwner}</td>

                        {/* Business Unit */}
                        <td className="px-3 py-2 text-slate-600">{client.businessUnit}</td>

                        {/* Display on Job Posting */}
                        <td className="px-3 py-2 text-slate-700 font-medium">
                          {client.displayOnJob}
                        </td>

                        {/* Created by */}
                        <td className="px-3 py-2 text-slate-600">{client.createdBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer: 1 - 11 of 11 */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredClients.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
};
