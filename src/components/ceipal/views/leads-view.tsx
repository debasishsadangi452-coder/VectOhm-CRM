import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { ViewTabsBar } from '../view-tabs-bar';
import { TableSearchBar } from '../table-search-bar';
import { TablePagination } from '../table-pagination';
import { LeadItem } from '../types';
import { CreateLeadPanel } from './create-lead-panel';

export const LeadsView: React.FC = () => {
  const { leads, addLead, searchQuery, setSearchQuery } = useCeipal();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedSearchField, setSelectedSearchField] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingLeadView, setIsCreatingLeadView] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (selectedSearchField === 'name') {
          return l.name.toLowerCase().includes(q);
        }
        if (selectedSearchField === 'website') {
          return l.website.toLowerCase().includes(q);
        }
        return (
          l.name.toLowerCase().includes(q) ||
          l.website.toLowerCase().includes(q) ||
          l.contactNumber.toLowerCase().includes(q) ||
          (l.company && l.company.toLowerCase().includes(q)) ||
          l.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, searchQuery, selectedSearchField]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Focus search input when Search button is clicked
  const handleSearchButtonClick = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  };

  // If creating lead, render full-page panel
  if (isCreatingLeadView) {
    return (
      <CreateLeadPanel
        onBack={() => setIsCreatingLeadView(false)}
        onCreated={() => setIsCreatingLeadView(false)}
      />
    );
  }

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800">
      {/* Tab Row directly under header: [Leads ▾] + + Add View */}
      <ViewTabsBar
        defaultTitle="Leads"
        rightActions={
          <>
            {/* Magnifying-glass icon button */}
            <button
              type="button"
              title="Search Leads"
              onClick={handleSearchButtonClick}
              className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 shadow-2xs cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* + New Lead */}
            <button
              type="button"
              onClick={() => setIsCreatingLeadView(true)}
              title="Add New Lead"
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </>
        }
      />

      {/* Main Content Area */}
      <div className="p-3 flex-1 flex flex-col min-w-0">
        <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs flex-1 flex flex-col overflow-hidden">
          {/* Search/Filter row */}
          <TableSearchBar
            inputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedField={selectedSearchField}
            onSelectedFieldChange={setSelectedSearchField}
            searchFields={[
              { label: 'Search Any', value: 'all' },
              { label: 'Lead Name', value: 'name' },
              { label: 'Website', value: 'website' },
            ]}
          />

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-[#f1f5f9] text-slate-800 border-b border-[#cbd5e1] font-bold z-10 select-none shadow-2xs">
                <tr>
                  <th className="w-9 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                      onChange={() => {
                        if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-2">Lead Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Contact Number</th>
                  <th className="px-3 py-2">Created On</th>
                  <th className="px-3 py-2">Created By</th>
                  <th className="px-3 py-2">Business Unit</th>
                  <th className="px-3 py-2">Lead Age</th>
                  <th className="px-3 py-2">Modified On</th>
                  <th className="px-3 py-2">Last Activity</th>
                  <th className="px-3 py-2">Zip Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-20 text-center text-slate-400 font-normal">
                      {searchQuery ? 'No leads matching your search' : 'No data available in table'}
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-blue-50/40">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const n = new Set(prev);
                              if (n.has(lead.id)) n.delete(lead.id);
                              else n.add(lead.id);
                              return n;
                            });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#1467d6]">
                        {lead.name}
                        {lead.company ? (
                          <span className="block text-[11px] font-normal text-slate-500">{lead.company}</span>
                        ) : null}
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="block text-[11px] font-normal text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            {lead.email}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{lead.source || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {lead.website ? (
                          <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {lead.website}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{lead.contactNumber || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.createdOn || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.createdBy || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.businessUnit || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.leadAge || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.modifiedOn || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.lastActivity || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.zipCode || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredLeads.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
};
