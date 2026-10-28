import React, { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Clipboard,
  Plus,
  ChevronDown,
  Star,
  FileText,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { useCeipal } from '../ceipal-context';
import { ViewTabsBar } from '../view-tabs-bar';
import { TableSearchBar } from '../table-search-bar';
import { TablePagination } from '../table-pagination';
import { ColumnFilterPopover } from '../column-filter-popover';
import { ApplicantItem } from '../types';
import { ApplicantDetailPanel } from './applicant-detail-panel';
import { CreateApplicantPanel } from './create-applicant-panel';

export const ApplicantsView: React.FC = () => {
  const navigate = useNavigate();
  const {
    customApplicants,
    addApplicant,
    autoScreenApplicant,
    totalApplicantsCount,
    toggleApplicantStar,
    columnFilters,
    setColumnFilter,
    clearColumnFilters,
    searchQuery,
    setSearchQuery,
    jobs,
    isCreatingApplicant,
    setIsCreatingApplicant,
    selectedApplicantDetail,
    setSelectedApplicantDetail,
  } = useCeipal();

  // Search field and specific job title selection
  const [selectedSearchField, setSelectedSearchField] = useState('all');
  const [selectedJobTitle, setSelectedJobTitle] = useState('');

  // Collect all distinct job titles from active job postings and applicants
  const availableJobTitles = useMemo(() => {
    const titleSet = new Set<string>();
    jobs?.forEach((j) => {
      if (j.jobTitle?.trim()) titleSet.add(j.jobTitle.trim());
    });
    customApplicants?.forEach((a) => {
      if (a.jobTitle?.trim()) titleSet.add(a.jobTitle.trim());
    });
    return Array.from(titleSet).sort((a, b) => a.localeCompare(b));
  }, [jobs, customApplicants]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortField, setSortField] = useState<keyof ApplicantItem>('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Panels
  const [showClipboardDropdown, setShowClipboardDropdown] = useState(false);

  // Generate the current page of applicants purely from real database candidates
  const { paginatedApplicants, effectiveTotal } = useMemo(() => {
    let pool: ApplicantItem[] = [...customApplicants];

    // Filter by specific selected job title when Job Title is active
    if (selectedSearchField === 'jobTitle' && selectedJobTitle && selectedJobTitle !== 'all') {
      const target = selectedJobTitle.toLowerCase().trim();
      pool = pool.filter((app) => (app.jobTitle || '').toLowerCase().trim() === target);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      pool = pool.filter((app) => {
        if (selectedSearchField === 'name') {
          return (app.name || '').toLowerCase().includes(q);
        }
        if (selectedSearchField === 'email') {
          return (app.email || '').toLowerCase().includes(q);
        }
        if (selectedSearchField === 'mobile') {
          return (app.mobile || '').toLowerCase().includes(q);
        }
        if (selectedSearchField === 'city') {
          return (app.city || '').toLowerCase().includes(q);
        }
        if (selectedSearchField === 'jobTitle') {
          return (app.jobTitle || '').toLowerCase().includes(q);
        }
        return (
          app.name.toLowerCase().includes(q) ||
          app.email.toLowerCase().includes(q) ||
          app.mobile.toLowerCase().includes(q) ||
          app.city.toLowerCase().includes(q) ||
          app.jobTitle.toLowerCase().includes(q) ||
          app.id.toLowerCase().includes(q) ||
          (app.displayId && app.displayId.includes(q))
        );
      });
    }

    for (const [field, filter] of Object.entries(columnFilters)) {
      pool = pool.filter((app) => {
        const val = String((app as any)[field] || '').toLowerCase();
        const fVal = filter.value.toLowerCase();
        if (filter.operator === 'contains' && !val.includes(fVal)) return false;
        if (filter.operator === 'equals' && val !== fVal) return false;
        if (filter.operator === 'startsWith' && !val.startsWith(fVal)) return false;
        if (filter.operator === 'isEmpty' && val.trim() !== '') return false;
        return true;
      });
    }

    if (sortField) {
      pool.sort((a, b) => {
        const valA = (a as any)[sortField] ?? '';
        const valB = (b as any)[sortField] ?? '';
        if (typeof valA === 'string') {
          const comp = valA.localeCompare(String(valB));
          return sortAsc ? comp : -comp;
        }
        return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    const start = (currentPage - 1) * pageSize;
    return {
      paginatedApplicants: pool.slice(start, start + pageSize),
      effectiveTotal: pool.length,
    };
  }, [
    currentPage,
    pageSize,
    searchQuery,
    selectedSearchField,
    selectedJobTitle,
    columnFilters,
    customApplicants,
    sortField,
    sortAsc,
  ]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedApplicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedApplicants.map((a) => a.id)));
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

  const toggleStar = async (id: string) => {
    try {
      await toggleApplicantStar(id);
    } catch {
      // Non-blocking
    }
  };

  // If creating an applicant, render the full page panel with all profile info fields
  if (isCreatingApplicant) {
    return (
      <CreateApplicantPanel
        onBack={() => {
          setIsCreatingApplicant(false);
          try {
            navigate({ to: "/recruitment", search: { tab: "applicants" } });
          } catch {
            // fallback
          }
        }}
        onCreated={(newApp) => {
          setIsCreatingApplicant(false);
          try {
            navigate({ to: "/recruitment", search: { tab: "applicants" } });
          } catch {
            // fallback
          }
          if (newApp) {
            setSelectedApplicantDetail(newApp);
          }
        }}
      />
    );
  }

  // If an applicant is selected, render the complete page panel with full profile info and demo resume
  if (selectedApplicantDetail) {
    const activeDetail =
      customApplicants.find((a) => a.id === selectedApplicantDetail.id) || selectedApplicantDetail;
    return (
      <ApplicantDetailPanel
        applicant={activeDetail}
        allApplicants={paginatedApplicants.length > 0 ? paginatedApplicants : customApplicants}
        onBack={() => setSelectedApplicantDetail(null)}
        onSelectApplicant={setSelectedApplicantDetail}
      />
    );
  }

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800">
      {/* Tab Row directly under header: [All Profiles ▾] + + Add View */}
      <ViewTabsBar
        defaultTitle="All Profiles"
        rightActions={
          <>
            {/* Clipboard ▾ dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowClipboardDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold shadow-2xs transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5 text-blue-600" />
                <span>Clipboard</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              {showClipboardDropdown && (
                <div
                  className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-xl border border-slate-200 py-1 z-30 text-xs"
                  onMouseLeave={() => setShowClipboardDropdown(false)}
                >
                  <button
                    onClick={() => setShowClipboardDropdown(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-700"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowClipboardDropdown(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-700"
                  >
                    Export Selected CSV
                  </button>
                  <button
                    onClick={() => setShowClipboardDropdown(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-700"
                  >
                    Bulk Status Update
                  </button>
                </div>
              )}
            </div>

            {/* + Applicant page button */}
            <button
              onClick={() => {
                setIsCreatingApplicant(true);
                try {
                  navigate({ to: '/recruitment', search: { tab: 'applicants', action: 'create-applicant' } });
                } catch {
                  // fallback
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
              title="Create New Applicant Profile"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Applicant</span>
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
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            searchFields={[
              { label: 'Search Any', value: 'all' },
              { label: 'Applicant Name', value: 'name' },
              { label: 'Email Address', value: 'email' },
              { label: 'Mobile Number', value: 'mobile' },
              { label: 'City', value: 'city' },
              { label: 'Job Title', value: 'jobTitle' },
            ]}
            selectedField={selectedSearchField}
            onSelectedFieldChange={(field) => {
              setSelectedSearchField(field);
              if (field !== 'jobTitle') {
                setSelectedJobTitle('');
              }
              setCurrentPage(1);
            }}
            secondaryDropdown={{
              showForFields: ['jobTitle'],
              placeholder: 'All Job Titles',
              value: selectedJobTitle,
              onChange: (title) => {
                setSelectedJobTitle(title);
                setCurrentPage(1);
              },
              options: availableJobTitles.map((t) => ({ label: t, value: t })),
            }}
            activeFilterCount={
              Object.keys(columnFilters).length +
              (selectedSearchField === 'jobTitle' && selectedJobTitle ? 1 : 0)
            }
            onToggleAdvancedFilter={() => {
              if (Object.keys(columnFilters).length > 0) clearColumnFilters();
              setSelectedJobTitle('');
            }}
          />

          {/* Bulk actions banner if rows selected */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 px-3 py-1.5 border-b border-blue-200 flex items-center justify-between text-xs text-blue-900">
              <span className="font-semibold">{selectedIds.size} applicant(s) selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert(`Initiating batch outreach for ${selectedIds.size} applicants`)}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                >
                  Bulk Email
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-blue-700 hover:underline text-xs"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Table Container with red left-border accent strip per row */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-[#f1f5f9] text-slate-800 border-b border-[#cbd5e1] font-bold z-10 select-none shadow-2xs">
                <tr>
                  <th className="w-9 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedApplicants.length > 0 &&
                        selectedIds.size === paginatedApplicants.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Applicant ID</span>
                      <ColumnFilterPopover
                        field="id"
                        currentFilter={columnFilters.id}
                        onApply={(f) => setColumnFilter('id', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Applicant Name</span>
                      <ColumnFilterPopover
                        field="name"
                        currentFilter={columnFilters.name}
                        onApply={(f) => setColumnFilter('name', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Email Address</span>
                      <ColumnFilterPopover
                        field="email"
                        currentFilter={columnFilters.email}
                        onApply={(f) => setColumnFilter('email', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Mobile Number</span>
                      <ColumnFilterPopover
                        field="mobile"
                        currentFilter={columnFilters.mobile}
                        onApply={(f) => setColumnFilter('mobile', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>City</span>
                      <ColumnFilterPopover
                        field="city"
                        currentFilter={columnFilters.city}
                        onApply={(f) => setColumnFilter('city', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Source</span>
                      <ColumnFilterPopover
                        field="source"
                        currentFilter={columnFilters.source}
                        onApply={(f) => setColumnFilter('source', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>State</span>
                      <ColumnFilterPopover
                        field="state"
                        currentFilter={columnFilters.state}
                        onApply={(f) => setColumnFilter('state', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Applicant Status</span>
                      <ColumnFilterPopover
                        field="status"
                        currentFilter={columnFilters.status}
                        onApply={(f) => setColumnFilter('status', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Job Title</span>
                      <ColumnFilterPopover
                        field="jobTitle"
                        currentFilter={columnFilters.jobTitle}
                        onApply={(f) => setColumnFilter('jobTitle', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span>AI Fit Match</span>
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Owner</span>
                      <ColumnFilterPopover
                        field="owner"
                        currentFilter={columnFilters.owner}
                        onApply={(f) => setColumnFilter('owner', f)}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {paginatedApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 font-normal">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  paginatedApplicants.map((app) => {
                    const isSelected = selectedIds.has(app.id);
                    const isStarred = Boolean(app.isStarred);

                    return (
                      <tr
                        key={app.id}
                        /* Colored left border accent strip on the row (red strip) */
                        className={`border-l-4 border-l-[#e11d48] hover:bg-blue-50/40 transition-colors ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(app.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                        </td>

                        {/* Applicant ID + Star icon + Pink numeric badge */}
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleStar(app.id)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  isStarred
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-300 hover:text-amber-400'
                                }`}
                              />
                            </button>
                            <span>{app.displayId || app.id}</span>
                            {/* Pink numeric badge e.g. +1 */}
                            <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-[#f43f5e] text-white text-[9.5px] font-bold rounded-full min-w-[17px] shadow-2xs">
                              +{app.badgeCount || 1}
                            </span>
                          </div>
                        </td>

                        {/* Applicant Name: Blue hyperlink */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setSelectedApplicantDetail(app)}
                            className="text-[#1467d6] font-semibold hover:underline cursor-pointer text-left"
                            title="Open applicant profile & resume panel"
                          >
                            {app.name}
                          </button>
                        </td>

                        {/* Email Address */}
                        <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={app.email}>
                          {app.email}
                        </td>

                        {/* Mobile Number */}
                        <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{app.mobile}</td>

                        {/* City */}
                        <td className="px-3 py-2 text-slate-600">{app.city}</td>

                        {/* Source: ZipRecruiter or Resume Inbox with orange doc glyph */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setSelectedApplicantDetail(app)}
                            title="View Applicant Profile & Resume"
                            className="flex items-center gap-1 hover:text-blue-600 cursor-pointer text-left"
                          >
                            {app.source === 'Resume Inbox' ? (
                              <>
                                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-slate-700 hover:underline">Resume Inbox</span>
                              </>
                            ) : (
                              <span className="text-slate-700 hover:underline">ZipRecruiter</span>
                            )}
                          </button>
                        </td>

                        {/* State */}
                        <td className="px-3 py-2 text-slate-600">{app.state}</td>

                        {/* Applicant Status: New lead */}
                        <td className="px-3 py-2 text-slate-700 font-medium">{app.status}</td>

                        {/* Job Title */}
                        <td className="px-3 py-2 text-slate-800 font-medium max-w-[220px] truncate" title={app.jobTitle}>
                          {app.jobTitle}
                        </td>

                        {/* AI Match Score & Fit Badge */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {app.aiMatchScore ? (
                            <div className="flex items-center gap-1.5" title={app.aiSummary || `${app.aiMatchScore}% match`}>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                                  app.fitBadge === 'PLATINUM_FIT' || app.aiMatchScore >= 85
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : app.fitBadge === 'GOLD_FIT' || app.aiMatchScore >= 70
                                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                      : app.fitBadge === 'SILVER_FIT' || app.aiMatchScore >= 55
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                                }`}
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>{Math.round(app.aiMatchScore)}%</span>
                                <span className="font-semibold opacity-90">
                                  {app.fitBadge === 'PLATINUM_FIT'
                                    ? 'Platinum'
                                    : app.fitBadge === 'GOLD_FIT'
                                      ? 'Gold'
                                      : app.fitBadge === 'SILVER_FIT'
                                        ? 'Silver'
                                        : 'Review'}
                                </span>
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                autoScreenApplicant(app.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors cursor-pointer"
                              title="Run AI resume screening"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Auto-Screen</span>
                            </button>
                          )}
                        </td>

                        {/* Owner: Truncated e.g. Govi..., Raje... */}
                        <td className="px-3 py-2 text-slate-600" title={app.owner}>
                          {app.owner}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination: e.g. 1 - 25 of 11,918, page buttons 1-5 then 477 */}
          <TablePagination
            currentPage={currentPage}
            totalItems={effectiveTotal}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
};
