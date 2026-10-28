import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  ChevronDown,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  UserCheck,
  Ban,
  X,
  FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../../ceipal-context';
import { EboardingStatus, EboardingItem } from '../../types';

export const EboardingDashboardView: React.FC = () => {
  const {
    eboardingList,
    eboardingStatusFilter,
    setEboardingStatusFilter,
    updateEboardingStatus,
    setEboardingSubModule,
  } = useCeipal();

  const [filterSearch, setFilterSearch] = useState('');
  const [onboardingTypeFilter, setOnboardingTypeFilter] = useState('All');
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, status: EboardingStatus) => {
    setActionMenuOpenId(null);
    try {
      await updateEboardingStatus(id, status);
    } catch {
      toast.error('Could not update onboarding status. Please try again.');
    }
  };

  // Compute live counts per pipeline stage
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: eboardingList.length,
      Draft: 0,
      Initiated: 0,
      Responded: 0,
      Verified: 0,
      Negotiate: 0,
      Joined: 0,
      Rejected: 0,
      Disqualified: 0,
      Cancelled: 0,
    };
    for (const item of eboardingList) {
      if (map[item.status] !== undefined) {
        map[item.status]++;
      }
    }
    return map;
  }, [eboardingList]);

  const sidebarStages: { key: EboardingStatus | 'All'; label: string; icon: string }[] = [
    { key: 'All', label: 'All', icon: '☰' },
    { key: 'Draft', label: 'Draft', icon: '📄' },
    { key: 'Initiated', label: 'Initiated', icon: '👤' },
    { key: 'Responded', label: 'Responded', icon: '✏' },
    { key: 'Verified', label: 'Verified', icon: '✓' },
    { key: 'Negotiate', label: 'Negotiate', icon: '💬' },
    { key: 'Joined', label: 'Joined', icon: '👍' },
    { key: 'Rejected', label: 'Rejected', icon: '👎' },
    { key: 'Disqualified', label: 'Disqualified', icon: '🚫' },
    { key: 'Cancelled', label: 'Cancelled', icon: '⊗' },
  ];

  // Filtered rows for main panel
  const displayedItems = useMemo(() => {
    return eboardingList.filter((item) => {
      // Stage filter
      if (eboardingStatusFilter !== 'All' && item.status !== eboardingStatusFilter) {
        return false;
      }
      // Text search
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.jobTitle.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [eboardingList, eboardingStatusFilter, filterSearch]);

  const handleExportExcel = () => {
    if (!displayedItems || displayedItems.length === 0) {
      toast.error('No eBoarding records found to export.');
      return;
    }

    try {
      // Map displayed items into clear tabular format matching table columns
      const exportRows = displayedItems.map((item) => ({
        'Name': item.name || '',
        'Email': item.email || '',
        'Job Title': item.jobTitle || '',
        'Phone': item.phone || '',
        'Initiated On': item.initiatedOn || '',
        'Joining Date': item.joiningDate || '',
        'Tax Terms': item.taxTerms || '',
        'Vendor Name': item.vendorName || 'N/A',
        'Vendor Email': item.vendorEmail || 'N/A',
        'ATS BU': item.atsBu || '',
        'Status': item.status || '',
        'Employment Type': item.employmentType || '',
        'Client': item.client || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      // Set optimal column widths for Excel readability
      worksheet['!cols'] = [
        { wch: 22 }, // Name
        { wch: 28 }, // Email
        { wch: 30 }, // Job Title
        { wch: 16 }, // Phone
        { wch: 15 }, // Initiated On
        { wch: 15 }, // Joining Date
        { wch: 14 }, // Tax Terms
        { wch: 22 }, // Vendor Name
        { wch: 28 }, // Vendor Email
        { wch: 16 }, // ATS BU
        { wch: 15 }, // Status
        { wch: 18 }, // Employment Type
        { wch: 22 }, // Client
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'eBoarding Records');

      // Generate filename with pipeline stage and date
      const stageName = eboardingStatusFilter !== 'All' ? eboardingStatusFilter : 'All_Pipeline';
      const today = new Date().toISOString().split('T')[0];
      const filename = `eBoarding_Records_${stageName}_${today}.xlsx`;

      // Trigger instant browser download
      XLSX.writeFile(workbook, filename);
      toast.success(`Downloaded ${displayedItems.length} eBoarding record(s) as Excel!`);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
      toast.error('Failed to generate Excel file. Please try again.');
    }
  };

  const currentHeadingText = `${eboardingStatusFilter} (${counts[eboardingStatusFilter] ?? 0})`;

  const statusColors: Record<EboardingStatus, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Initiated: 'bg-blue-100 text-blue-800',
    Responded: 'bg-amber-100 text-amber-800',
    Verified: 'bg-emerald-100 text-emerald-800',
    Negotiate: 'bg-purple-100 text-purple-800',
    Joined: 'bg-teal-100 text-teal-800 font-bold',
    Rejected: 'bg-rose-100 text-rose-800',
    Disqualified: 'bg-orange-100 text-orange-800',
    Cancelled: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="flex flex-1 min-h-[calc(100vh-60px)] bg-[#eef1f6] text-slate-800 text-xs">
      {/* Persistent Left Sidebar with Live Stage Counts */}
      <aside className="w-56 bg-white border-r border-[#e2e6ec] p-2 flex flex-col gap-0.5 select-none shrink-0 shadow-2xs">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Onboarding Pipeline
        </div>
        {sidebarStages.map((stage) => {
          const isSelected = eboardingStatusFilter === stage.key;
          const count = counts[stage.key] ?? 0;

          return (
            <button
              key={stage.key}
              onClick={() => setEboardingStatusFilter(stage.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-colors text-left ${
                isSelected
                  ? 'shadow-xs font-bold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              style={
                isSelected
                  ? { backgroundColor: '#0b5ed7', color: '#ffffff' }
                  : { color: '#334155' }
              }
            >
              <div className="flex items-center gap-2">
                <span className="w-4 text-center">{stage.icon}</span>
                <span>{stage.label}</span>
              </div>
              <span className={`text-[11px] ${isSelected ? 'text-white font-bold' : 'text-slate-400'}`}>
                ({count})
              </span>
            </button>
          );
        })}

        <div className="mt-auto p-2 pt-4 border-t border-slate-100">
          <button
            onClick={() => setEboardingSubModule('initiate')}
            className="w-full py-2 rounded font-semibold text-xs shadow-xs text-center hover:opacity-90"
            style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
          >
            + Initiate Onboarding
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 p-3.5 space-y-3">
        {/* Main Panel Header Row */}
        <div className="bg-white px-4 py-2.5 rounded-md border border-[#e2e6ec] shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Current Filter Title + Count */}
          <h2 className="text-sm font-bold text-slate-900">{currentHeadingText}</h2>

          {/* Top-Right Controls: Onboardings ▾, Filter input, Funnel, Export */}
          <div className="flex items-center gap-2">
            {/* Onboardings ▾ dropdown */}
            <div className="relative">
              <select
                value={onboardingTypeFilter}
                onChange={(e) => setOnboardingTypeFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="All">Onboardings ▾</option>
                <option value="Employee">Employee</option>
                <option value="Contractor">Contractor (Corp-to-Corp)</option>
                <option value="W2">W2 Hourly</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filter Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-2.5 pr-6 py-1 bg-white border border-slate-300 rounded text-xs w-44 focus:outline-none focus:border-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
            </div>


            {/* Download/export icon button */}
            <button
              title="Download Excel Sheet"
              onClick={handleExportExcel}
              className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-[#f1f5f9] text-slate-800 border-b border-[#cbd5e1] font-bold z-10 select-none shadow-2xs">
                <tr>
                  <th className="px-3 py-2">NAME</th>
                  <th className="px-3 py-2">EMAIL</th>
                  <th className="px-3 py-2">JOB TITLE</th>
                  <th className="px-3 py-2">PHONE</th>
                  <th className="px-3 py-2">INITIATED ON</th>
                  <th className="px-3 py-2">JOINING DATE</th>
                  <th className="px-3 py-2">TAX TERMS</th>
                  <th className="px-3 py-2">VENDOR NAME</th>
                  <th className="px-3 py-2">VENDOR EMAIL</th>
                  <th className="px-3 py-2">ATS BU</th>
                  <th className="px-3 py-2">STATUS</th>
                  <th className="px-3 py-2 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-24 text-center text-slate-400 font-normal">
                      No Records
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/40">
                      <td className="px-3 py-2 font-semibold text-[#1467d6]">{item.name}</td>
                      <td className="px-3 py-2 text-slate-600">{item.email}</td>
                      <td className="px-3 py-2 text-slate-800 font-medium">{item.jobTitle}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{item.phone}</td>
                      <td className="px-3 py-2 text-slate-600">{item.initiatedOn}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{item.joiningDate}</td>
                      <td className="px-3 py-2 text-slate-600">{item.taxTerms}</td>
                      <td className="px-3 py-2 text-slate-600">{item.vendorName || 'N/A'}</td>
                      <td className="px-3 py-2 text-slate-600">{item.vendorEmail || 'N/A'}</td>
                      <td className="px-3 py-2 text-slate-600">{item.atsBu}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${statusColors[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center relative">
                        <button
                          onClick={() => setActionMenuOpenId(actionMenuOpenId === item.id ? null : item.id)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Interactive Status Transition Menu */}
                        {actionMenuOpenId === item.id && (
                          <div
                            className="absolute right-2 top-8 w-44 bg-white rounded-md shadow-xl border border-slate-200 py-1 z-30 text-xs text-left"
                            onMouseLeave={() => setActionMenuOpenId(null)}
                          >
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">
                              Advance Pipeline
                            </div>
                            {item.status === 'Draft' && (
                              <button
                                onClick={() => handleStatusChange(item.id, 'Initiated')}
                                className="w-full px-3 py-1.5 hover:bg-blue-50 text-blue-700 flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-3 h-3" /> Initiate Packet
                              </button>
                            )}
                            {item.status === 'Initiated' && (
                              <button
                                onClick={() => handleStatusChange(item.id, 'Responded')}
                                className="w-full px-3 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-3 h-3" /> Candidate Responded
                              </button>
                            )}
                            {item.status === 'Responded' && (
                              <button
                                onClick={() => handleStatusChange(item.id, 'Verified')}
                                className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Verify Documents
                              </button>
                            )}
                            {item.status === 'Verified' && (
                              <button
                                onClick={() => handleStatusChange(item.id, 'Negotiate')}
                                className="w-full px-3 py-1.5 hover:bg-purple-50 text-purple-700 flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-3 h-3" /> Negotiate Terms
                              </button>
                            )}
                            {item.status === 'Negotiate' && (
                              <button
                                onClick={() => handleStatusChange(item.id, 'Joined')}
                                className="w-full px-3 py-1.5 hover:bg-teal-50 text-teal-700 flex items-center gap-1.5"
                              >
                                <UserCheck className="w-3 h-3" /> Mark Joined
                              </button>
                            )}
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => handleStatusChange(item.id, 'Rejected')}
                              className="w-full px-3 py-1 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                            <button
                              onClick={() => handleStatusChange(item.id, 'Disqualified')}
                              className="w-full px-3 py-1 hover:bg-orange-50 text-orange-600 flex items-center gap-1.5"
                            >
                              <Ban className="w-3 h-3" /> Disqualify
                            </button>
                            <button
                              onClick={() => handleStatusChange(item.id, 'Cancelled')}
                              className="w-full px-3 py-1 hover:bg-slate-100 text-slate-500 flex items-center gap-1.5"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2 bg-slate-50 border-t border-[#e2e6ec] text-[11px] text-slate-500 flex justify-between items-center">
            <span>Showing {displayedItems.length} records</span>
          </div>
        </div>
      </main>
    </div>
  );
};
