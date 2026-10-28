import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, UserCheck, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../../ceipal-context';
import { EboardingItem } from '../../types';

export const ReadyForOnboardingView: React.FC = () => {
  const { eboardingList, updateEboardingStatus } = useCeipal();
  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedBUs, setCollapsedBUs] = useState<Set<string>>(new Set());

  const handleMarkJoined = async (id: string) => {
    try {
      await updateEboardingStatus(id, 'Joined');
    } catch {
      toast.error('Could not mark this record as joined. Please try again.');
    }
  };

  // Records that reach the "Verified" stage in the main Onboarding pipeline surface here
  const verifiedRecords = useMemo(() => {
    return eboardingList.filter((item) => {
      // Must be Verified (or later stages like Negotiate / Joined)
      const isReady = item.status === 'Verified' || item.status === 'Negotiate';
      if (!isReady) return false;

      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.jobTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [eboardingList, filterQuery]);

  // Group verified records by Business Unit
  const businessUnits = ['Venus Consultancy', 'Venus IT Services'];

  const toggleBUCollapse = (bu: string) => {
    setCollapsedBUs((prev) => {
      const next = new Set(prev);
      if (next.has(bu)) next.delete(bu);
      else next.add(bu);
      return next;
    });
  };

  return (
    <div className="p-4 bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800 text-xs space-y-4">
      {/* Top Header Row */}
      <div className="bg-white px-4 py-3 rounded-md border border-[#e2e6ec] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-bold text-slate-900">Ready for Onboarding</h1>

        {/* Top right: Filter search input with magnifying-glass icon */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filter..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-3 pr-7 py-1.5 bg-white border border-slate-300 rounded text-xs w-48 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Content grouped into collapsible sections by Business Unit */}
      <div className="space-y-4">
        {businessUnits.map((bu) => {
          const buRecords = verifiedRecords.filter((r) => r.atsBu === bu);
          const isCollapsed = collapsedBUs.has(bu);

          return (
            <div
              key={bu}
              className="bg-white rounded-md border border-[#e2e6ec] shadow-xs overflow-hidden"
            >
              {/* Collapsible Section Header Bar */}
              <div
                onClick={() => toggleBUCollapse(bu)}
                className="px-4 py-2.5 bg-slate-100/90 border-b border-[#cbd5e1] flex items-center justify-between cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{bu}</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ({buRecords.length} records verified)
                  </span>
                </div>
              </div>

              {/* Collapsible Section Table */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead className="bg-[#f8fafc] text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                      <tr>
                        <th className="px-3 py-2">NAME</th>
                        <th className="px-3 py-2">MOBILE</th>
                        <th className="px-3 py-2">EMAIL</th>
                        <th className="px-3 py-2">BUSINESS UNIT</th>
                        <th className="px-3 py-2">CLIENT</th>
                        <th className="px-3 py-2">JOB TITLE</th>
                        <th className="px-3 py-2">TAX TERM</th>
                        <th className="px-3 py-2">CREATED BY</th>
                        <th className="px-3 py-2">CREATED</th>
                        <th className="px-3 py-2 text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e6ec] bg-white">
                      {buRecords.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400 font-normal">
                            No Record found
                          </td>
                        </tr>
                      ) : (
                        buRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-blue-50/40">
                            <td className="px-3 py-2 font-semibold text-[#1467d6]">{rec.name}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{rec.phone}</td>
                            <td className="px-3 py-2 text-slate-600">{rec.email}</td>
                            <td className="px-3 py-2 text-slate-600">{rec.atsBu}</td>
                            <td className="px-3 py-2 text-slate-700 font-medium">{rec.client || 'Niagara Health'}</td>
                            <td className="px-3 py-2 text-slate-800 font-medium">{rec.jobTitle}</td>
                            <td className="px-3 py-2 text-slate-600">{rec.taxTerms}</td>
                            <td className="px-3 py-2 text-slate-600">{rec.createdBy || 'Megan Davis'}</td>
                            <td className="px-3 py-2 text-slate-600">{rec.initiatedOn}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleMarkJoined(rec.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold shadow-xs"
                              >
                                Mark Joined
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
