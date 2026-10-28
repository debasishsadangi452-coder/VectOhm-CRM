import React, { useState } from 'react';
import { Search, Mail, ThumbsUp, ChevronDown, Filter, Plus, X } from 'lucide-react';
import { useCeipal } from '../ceipal-context';
import { TablePagination } from '../table-pagination';
import { PlacementItem } from '../types';
import { RecordPlacementPanel } from './record-placement-panel';

export const PlacementsView: React.FC = () => {
  const { placements, addPlacement } = useCeipal();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState('Any');
  const [isCreatingPlacementView, setIsCreatingPlacementView] = useState(false);

  const filteredPlacements = React.useMemo(() => {
    return placements.filter((p) => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase().trim();
      if (searchField === 'Applicant') {
        return (p.applicantName || '').toLowerCase().includes(q);
      }
      if (searchField === 'Client') {
        return (p.clientPrimeVendor || '').toLowerCase().includes(q);
      }
      if (searchField === 'JobCode') {
        return (p.jobCode || '').toLowerCase().includes(q);
      }
      return (
        (p.applicantName || '').toLowerCase().includes(q) ||
        (p.placementCode || '').toLowerCase().includes(q) ||
        (p.jobCode || '').toLowerCase().includes(q) ||
        (p.jobTitle || '').toLowerCase().includes(q) ||
        (p.clientPrimeVendor || '').toLowerCase().includes(q) ||
        (p.businessUnit || '').toLowerCase().includes(q)
      );
    });
  }, [placements, searchText, searchField]);

  const columns = [
    'APPLICANT NAME',
    'PLACEMENT CODE',
    'JOB CODE',
    'JOB TITLE',
    'PLACEMENT TYPE',
    'CLIENT/PRIME VENDOR',
    'BUSINESS UNIT',
    'CLIENT BILL RATE',
    'PAY RATE',
    'PER DIEM /HR',
    'OVERHEAD',
    'MARGIN',
    'CREATED ON',
    'CREATED BY',
  ];

  // If creating placement, render full-page panel
  if (isCreatingPlacementView) {
    return (
      <RecordPlacementPanel
        onBack={() => setIsCreatingPlacementView(false)}
        onCreated={() => setIsCreatingPlacementView(false)}
      />
    );
  }

  return (
    <div className="bg-[#e9edf3] min-h-[calc(100vh-60px)] flex flex-col justify-between text-slate-800 font-sans text-xs">
      <div>
        {/* Legacy Header Row: All Placements ▾ title (not a pill tab) + small gear icon */}
        <div className="px-4 py-2.5 bg-[#dbe2ec] border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>All Placements</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600 cursor-pointer" />
            </h2>
          </div>

          {/* Top Right: Search [text box] [Any ▾] combo, envelope icon, thumbs-up icon */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-300 rounded-sm shadow-2xs overflow-hidden">
              <span className="px-2 text-[11px] font-semibold text-slate-500 bg-slate-100 border-r border-slate-300">
                Search
              </span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Keywords..."
                className="px-2 py-1 text-xs outline-none w-36"
              />
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="px-2 py-1 text-xs bg-slate-50 border-l border-slate-300 outline-none font-medium cursor-pointer text-slate-700"
              >
                <option value="Any">Any ▾</option>
                <option value="Applicant">Applicant</option>
                <option value="Client">Client</option>
                <option value="JobCode">Job Code</option>
              </select>
              <button className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              title="Mail"
              className="p-1.5 bg-white border border-slate-300 rounded-sm text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
            </button>

            <button
              title="Approved"
              className="p-1.5 bg-white border border-slate-300 rounded-sm text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
            </button>

            <button
              onClick={() => setIsCreatingPlacementView(true)}
              className="px-2.5 py-1 rounded-sm font-semibold text-xs flex items-center gap-1 shadow-2xs hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Placement</span>
            </button>
          </div>
        </div>

        {/* Sub-bar: NEW tag badge next to 'Switch to modern view' blue link on the right */}
        <div className="px-4 py-1.5 flex justify-end items-center gap-1.5 text-xs bg-[#e2e8f0] border-b border-[#cbd5e1]">
          <span className="px-1.5 py-0.2 bg-[#dc2626] text-white text-[9.5px] font-black rounded-xs tracking-wider uppercase shadow-2xs">
            NEW
          </span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Currently in standard Ceipal Placements view');
            }}
            className="text-[#1467d6] font-semibold hover:underline"
          >
            Switch to modern view
          </a>
        </div>

        {/* Table Container */}
        <div className="p-3">
          <div className="bg-white border border-[#b8c4d4] shadow-xs overflow-hidden rounded-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-[#cbd5e1] text-slate-900 border-b border-[#94a3b8] font-bold text-[11px] tracking-wider">
                    <th className="w-8 px-2.5 py-2 text-center border-r border-[#b8c4d4]">
                      <input type="checkbox" className="rounded-xs" />
                    </th>
                    {columns.map((col, idx) => (
                      <th
                        key={col}
                        className="px-2.5 py-2 border-r border-[#b8c4d4] last:border-r-0"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>{col}</span>
                          {idx !== 4 && idx !== 6 && (
                            <Filter className="w-2.5 h-2.5 text-slate-500 hover:text-blue-700 cursor-pointer" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] bg-white">
                  {filteredPlacements.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="py-20 text-center text-slate-500 font-normal">
                        No Records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPlacements.map((p) => (
                      <tr key={p.id} className="hover:bg-blue-50/40">
                        <td className="px-2.5 py-2 text-center border-r border-slate-200">
                          <input type="checkbox" />
                        </td>
                        <td className="px-2.5 py-2 border-r border-slate-200 font-semibold text-[#1467d6]">
                          {p.applicantName}
                        </td>
                        <td className="px-2.5 py-2 border-r border-slate-200 font-mono">{p.placementCode}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200 text-[#1467d6] font-semibold">{p.jobCode}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.jobTitle}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.placementType}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.clientPrimeVendor}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.businessUnit}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200 font-medium">{p.clientBillRate}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200 font-medium">{p.payRate}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.perDiemHr}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.overhead}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200 font-semibold text-emerald-700">{p.margin}</td>
                        <td className="px-2.5 py-2 border-r border-slate-200">{p.createdOn}</td>
                        <td className="px-2.5 py-2">{p.createdBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Legacy Footer: Showing 0 to 0 of 0 entries (left), Show [25 ▾] (right) */}
            <TablePagination
              currentPage={currentPage}
              totalItems={placements.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              legacyStyle={true}
            />
          </div>
        </div>
      </div>

      {/* Full-width dark blue footer bar at the very bottom of the page */}
      <footer className="w-full bg-[#1a2b4a] text-white/80 px-4 py-2 text-[11px] flex flex-wrap items-center justify-between border-t border-[#0b1c36] select-none">
        <div>Ceipal - Cloud Enterprise Information Portal - TH Ver 26.50</div>
        <div>© 2026 Ceipal Corp. All Rights Reserved</div>
      </footer>

    </div>
  );
};
