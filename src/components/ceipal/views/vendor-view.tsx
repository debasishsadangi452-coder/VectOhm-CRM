import React, { useState, useMemo } from 'react';
import { ThumbsUp, Plus, X } from 'lucide-react';
import { useCeipal } from '../ceipal-context';
import { ViewTabsBar } from '../view-tabs-bar';
import { TableSearchBar } from '../table-search-bar';
import { TablePagination } from '../table-pagination';
import { ColumnFilterPopover } from '../column-filter-popover';
import { VendorItem } from '../types';
import { CreateVendorPanel } from './create-vendor-panel';

export const VendorView: React.FC = () => {
  const {
    vendors,
    addVendor,
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
  const [isCreatingVendorView, setIsCreatingVendorView] = useState(false);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        let match = false;
        if (selectedSearchField === 'name') {
          match = (v.name || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'website') {
          match = (v.website || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'contactNumber') {
          match = (v.contactNumber || '').toLowerCase().includes(q);
        } else {
          match =
            (v.name || '').toLowerCase().includes(q) ||
            (v.website || '').toLowerCase().includes(q) ||
            (v.contactNumber || '').toLowerCase().includes(q) ||
            (v.id || '').toLowerCase().includes(q) ||
            (v.email || '').toLowerCase().includes(q);
        }
        if (!match) return false;
      }
      return true;
    });
  }, [vendors, searchQuery, selectedSearchField]);

  // If creating vendor, render full-page panel
  if (isCreatingVendorView) {
    return (
      <CreateVendorPanel
        onBack={() => setIsCreatingVendorView(false)}
        onCreated={() => setIsCreatingVendorView(false)}
      />
    );
  }

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800">
      {/* Tab Row directly under header: [Vendors ▾] + + Add View */}
      <ViewTabsBar
        defaultTitle="Vendors"
        rightActions={
          <>
            {/* Thumbs-up icon button */}
            <button
              title="Preferred Vendors"
              className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
            </button>

            {/* + New Vendor button */}
            <button
              onClick={() => setIsCreatingVendorView(true)}
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
              { label: 'Vendor Name', value: 'name' },
              { label: 'Website', value: 'website' },
              { label: 'Contact Number', value: 'contactNumber' },
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
                      checked={filteredVendors.length > 0 && selectedIds.size === filteredVendors.length}
                      onChange={() => {
                        if (selectedIds.size === filteredVendors.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filteredVendors.map((v) => v.id)));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-2">Vendor Name</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Contact Number</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Created By</th>
                  <th className="px-3 py-2">Created On</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Ownership</th>
                  <th className="px-3 py-2">Business Unit</th>
                  <th className="px-3 py-2">Modified On</th>
                  <th className="px-3 py-2">Modified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-slate-400 font-normal">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-blue-50/40">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(v.id)}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const n = new Set(prev);
                              if (n.has(v.id)) n.delete(v.id);
                              else n.add(v.id);
                              return n;
                            });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#1467d6]">{v.name}</td>
                      <td className="px-3 py-2 text-slate-600">{v.website}</td>
                      <td className="px-3 py-2 text-slate-600">{v.contactNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{v.state}</td>
                      <td className="px-3 py-2 text-slate-600">{v.createdBy}</td>
                      <td className="px-3 py-2 text-slate-600">{v.createdOn}</td>
                      <td className="px-3 py-2 text-slate-600">{v.country}</td>
                      <td className="px-3 py-2 text-slate-600">{v.ownership}</td>
                      <td className="px-3 py-2 text-slate-600">{v.businessUnit}</td>
                      <td className="px-3 py-2 text-slate-600">{v.modifiedOn}</td>
                      <td className="px-3 py-2 text-slate-600">{v.modifiedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer: Showing 0 to 0 of 0 entries */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredVendors.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
};
