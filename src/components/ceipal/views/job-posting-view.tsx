import React, { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Mail,
  Plus,
  FileText,
  X,
  ExternalLink,
  Linkedin,
  Check,
  Building,
  SlidersHorizontal,
  Sparkles,
  Copy,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useCeipal } from '../ceipal-context';
import { ViewTabsBar } from '../view-tabs-bar';
import { TableSearchBar } from '../table-search-bar';
import { TablePagination } from '../table-pagination';
import { ColumnFilterPopover } from '../column-filter-popover';
import { JobPostingItem } from '../types';
import { JobDetailPanel } from './job-detail-panel';
import { CreateJobPostingPanel } from './create-job-posting-panel';

class PanelErrorBoundary extends React.Component<
  { onBack: () => void; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { onBack: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in JobDetailPanel:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] p-8 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm max-w-lg w-full text-center">
            <h3 className="text-base font-bold text-slate-800 mb-2">Unable to display Job Details</h3>
            <p className="text-xs text-slate-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading this job posting.'}
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                onClick={this.props.onBack}
                className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-200"
              >
                Back to Job List
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const JobPostingView: React.FC = () => {
  const navigate = useNavigate();
  const {
    jobs,
    addJob,
    deleteJob,
    columnFilters,
    setColumnFilter,
    clearColumnFilters,
    searchQuery,
    setSearchQuery,
    isCreatingJob,
    setIsCreatingJob,
    selectedJobDetail,
    setSelectedJobDetail,
  } = useCeipal();

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.name === 'ADMIN';

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPostingItem | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleBulkDeleteConfirm = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting ${selectedIds.size} job posting(s)...`);
    try {
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        await deleteJob(id);
      }
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      toast.success(
        `Successfully deleted ${idsToDelete.length} job posting(s). They have been removed from the CRM and the VenusGlobalTech public website.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete job postings', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSingleDeleteConfirm = async () => {
    if (!isAdmin || !jobToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting "${jobToDelete.jobTitle}"...`);
    try {
      await deleteJob(jobToDelete.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobToDelete.id);
        return next;
      });
      setJobToDelete(null);
      toast.success(
        `Job requisition "${jobToDelete.jobTitle}" (${jobToDelete.jobCode}) was permanently deleted from the CRM and the VenusGlobalTech website.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete job posting', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search field selection
  const [selectedSearchField, setSelectedSearchField] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<keyof JobPostingItem>('jobCode');
  const [sortAsc, setSortAsc] = useState(true);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Panels
  const [showSendReqModal, setShowSendReqModal] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showCopilotModal, setShowCopilotModal] = useState(false);
  const [copiedExtensionPath, setCopiedExtensionPath] = useState(false);

  const distinctClients = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.client).filter(Boolean))).sort() as string[];
  }, [jobs]);

  const distinctBusinessUnits = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.businessUnit).filter(Boolean))).sort() as string[];
  }, [jobs]);

  const distinctJobTitles = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.jobTitle).filter(Boolean))).sort() as string[];
  }, [jobs]);

  const secondaryDropdownConfig = useMemo(() => {
    if (selectedSearchField === 'jobTitle') {
      return {
        options: distinctJobTitles.map((t) => ({ label: t, value: t })),
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Job Titles',
      };
    }
    if (selectedSearchField === 'client') {
      return {
        options: distinctClients.map((c) => ({ label: c, value: c })),
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Clients',
      };
    }
    if (selectedSearchField === 'businessUnit') {
      return {
        options: distinctBusinessUnits.map((b) => ({ label: b, value: b })),
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Business Units',
      };
    }
    if (selectedSearchField === 'jobStatus') {
      return {
        options: [
          { label: 'Active', value: 'Active' },
          { label: 'Hold', value: 'Hold' },
          { label: 'Draft', value: 'Draft' },
          { label: 'Closed', value: 'Closed' },
        ],
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Statuses',
      };
    }
    if (selectedSearchField === 'jobType') {
      return {
        options: [
          { label: 'Full Time', value: 'Full Time' },
          { label: 'Contract', value: 'Contract' },
          { label: 'Direct Hire', value: 'Direct Hire' },
          { label: 'Contract to Hire', value: 'Contract to Hire' },
          { label: 'Part Time', value: 'Part Time' },
        ],
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Job Types',
      };
    }
    if (selectedSearchField === 'taxTerms') {
      return {
        options: [
          { label: 'W2', value: 'W2' },
          { label: 'C2C', value: 'C2C' },
          { label: '1099', value: '1099' },
          { label: 'Full-time', value: 'Full-time' },
        ],
        value: searchQuery,
        onChange: (v: string) => {
          setSearchQuery(v);
          setCurrentPage(1);
        },
        placeholder: 'All Tax Terms',
      };
    }
    return undefined;
  }, [selectedSearchField, distinctJobTitles, distinctClients, distinctBusinessUnits, searchQuery]);

  // Filter & Search Logic
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search matching according to selected field
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        let match = false;

        if (selectedSearchField === 'jobCode') {
          match = (job.jobCode || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'jobTitle') {
          match = (job.jobTitle || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'client') {
          match = (job.client || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'clientJobId') {
          match = (job.clientJobId || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'businessUnit') {
          match = (job.businessUnit || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'location') {
          match =
            (job.location || '').toLowerCase().includes(q) ||
            (job.states || '').toLowerCase().includes(q) ||
            (job.country || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'jobStatus') {
          match = (job.jobStatus || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'jobType') {
          match = (job.jobType || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'clientBillRate') {
          match = (job.clientBillRate || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'payRate') {
          match = (job.payRate || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'taxTerms') {
          match = (job.taxTerms || '').toLowerCase().includes(q);
        } else if (selectedSearchField === 'experience') {
          match =
            (job.experience || '').toLowerCase().includes(q) ||
            String((job as any).minExperience || '').includes(q) ||
            String((job as any).maxExperience || '').includes(q);
        } else {
          // 'all'
          match =
            (job.jobCode || '').toLowerCase().includes(q) ||
            (job.jobTitle || '').toLowerCase().includes(q) ||
            (job.client || '').toLowerCase().includes(q) ||
            (job.clientJobId || '').toLowerCase().includes(q) ||
            (job.businessUnit || '').toLowerCase().includes(q) ||
            (job.location || '').toLowerCase().includes(q) ||
            (job.states || '').toLowerCase().includes(q) ||
            (job.country || '').toLowerCase().includes(q) ||
            (job.jobStatus || '').toLowerCase().includes(q) ||
            (job.jobType || '').toLowerCase().includes(q) ||
            (job.clientBillRate || '').toLowerCase().includes(q) ||
            (job.payRate || '').toLowerCase().includes(q) ||
            (job.taxTerms || '').toLowerCase().includes(q) ||
            (job.experience || '').toLowerCase().includes(q) ||
            (job.assignedTo || '').toLowerCase().includes(q);
        }

        if (!match) return false;
      }

      // Column filters
      for (const [field, filter] of Object.entries(columnFilters)) {
        const val = String((job as any)[field] || '').toLowerCase();
        const fVal = filter.value.toLowerCase();
        if (filter.operator === 'contains' && !val.includes(fVal)) return false;
        if (filter.operator === 'equals' && val !== fVal) return false;
        if (filter.operator === 'startsWith' && !val.startsWith(fVal)) return false;
        if (filter.operator === 'isEmpty' && val.trim() !== '') return false;
      }

      return true;
    });
  }, [jobs, searchQuery, selectedSearchField, columnFilters]);

  // Sort
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const aVal = String((a as any)[sortField] || '');
      const bVal = String((b as any)[sortField] || '');
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredJobs, sortField, sortAsc]);

  // Paginated slice
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedJobs.slice(start, start + pageSize);
  }, [sortedJobs, currentPage, pageSize]);

  const handleSort = (field: keyof JobPostingItem) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedJobs.map((j) => j.id)));
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

  // If creating job, show full-page panel
  if (isCreatingJob) {
    return (
      <CreateJobPostingPanel
        onBack={() => {
          setIsCreatingJob(false);
          try {
            navigate({ to: "/recruitment", search: { tab: "jobs" } });
          } catch {
            // fallback
          }
        }}
        onCreated={(newJob) => {
          setIsCreatingJob(false);
          try {
            navigate({ to: "/recruitment", search: { tab: "jobs" } });
          } catch {
            // fallback
          }
          if (newJob) setSelectedJobDetail(newJob);
        }}
      />
    );
  }

  // If a job is clicked, show the complete page panel just like the 2nd image
  if (selectedJobDetail) {
    const activeJobDetail =
      jobs.find((j) => j.id === selectedJobDetail.id) ||
      jobs.find((j) => selectedJobDetail.jobCode && j.jobCode === selectedJobDetail.jobCode) ||
      jobs.find((j) => selectedJobDetail.jobTitle && j.jobTitle.toLowerCase() === selectedJobDetail.jobTitle.toLowerCase()) ||
      selectedJobDetail;
    return (
      <PanelErrorBoundary onBack={() => setSelectedJobDetail(null)}>
        <JobDetailPanel
          job={activeJobDetail}
          onBack={() => setSelectedJobDetail(null)}
          onSelectJob={setSelectedJobDetail}
        />
      </PanelErrorBoundary>
    );
  }

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800">
      {/* Tab Row directly under header: [All Jobs ▾] + + Add View */}
      <ViewTabsBar
        defaultTitle="All Jobs"
        rightActions={
          <>
            {/* 🌐 Public Careers Portal */}
            <a
              href="/careers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50/70 text-indigo-700 rounded text-xs font-semibold shadow-2xs transition-colors"
              title="Open the live public careers portal in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
              <span>Public Careers</span>
            </a>

            {/* ✨ Recruiter Copilot Chrome Extension */}
            <button
              onClick={() => setShowCopilotModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Install & connect Venus Recruiter Copilot Chrome Extension"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Job Board Copilot</span>
            </button>

            {/* ✉ Send Requirement (outline button) */}
            <button
              onClick={() => setShowSendReqModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold shadow-2xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Send Requirement</span>
            </button>

            {/* + New (solid blue button) */}
            <button
              onClick={() => {
                setIsCreatingJob(true);
                try {
                  navigate({ to: '/recruitment', search: { tab: 'jobs', action: 'create-job' } });
                } catch {
                  // fallback
                }
              }}
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
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            selectedField={selectedSearchField}
            onSelectedFieldChange={(val) => {
              setSelectedSearchField(val);
              setCurrentPage(1);
            }}
            secondaryDropdown={secondaryDropdownConfig}
            searchFields={[
              { label: 'Search Any', value: 'all' },
              { label: 'Job Code', value: 'jobCode' },
              { label: 'Job Title', value: 'jobTitle' },
              { label: 'Client', value: 'client' },
              { label: 'Client Job ID', value: 'clientJobId' },
              { label: 'Business Unit', value: 'businessUnit' },
              { label: 'Location', value: 'location' },
              { label: 'Job Status', value: 'jobStatus' },
              { label: 'Job Type', value: 'jobType' },
              { label: 'Client Bill Rate', value: 'clientBillRate' },
              { label: 'Pay Rate', value: 'payRate' },
              { label: 'Tax Terms', value: 'taxTerms' },
              { label: 'Experience', value: 'experience' },
            ]}
            isAdvancedFilterOpen={showAdvancedFilter}
            onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          />

          {/* Advanced Filter Collapsible Panel */}
          {showAdvancedFilter && (
            <div className="bg-[#f8fafc] border-b border-[#e2e6ec] p-3 text-xs text-slate-700 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Advanced Requisition Filters</span>
                  {Object.keys(columnFilters).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                      {Object.keys(columnFilters).length} active
                    </span>
                  )}
                </div>
                {Object.keys(columnFilters).length > 0 && (
                  <button
                    onClick={clearColumnFilters}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Clear All Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Job Status Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Job Status</label>
                  <select
                    value={columnFilters.jobStatus?.value || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setColumnFilter('jobStatus', { field: 'jobStatus', operator: 'equals', value: e.target.value });
                      } else {
                        setColumnFilter('jobStatus', null);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Hold">Hold</option>
                    <option value="Draft">Draft</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Job Type Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Job Type / Terms</label>
                  <select
                    value={columnFilters.jobType?.value || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setColumnFilter('jobType', { field: 'jobType', operator: 'contains', value: e.target.value });
                      } else {
                        setColumnFilter('jobType', null);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Part Time">Part Time</option>
                  </select>
                </div>

                {/* Client Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Client</label>
                  <select
                    value={columnFilters.client?.value || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setColumnFilter('client', { field: 'client', operator: 'contains', value: e.target.value });
                      } else {
                        setColumnFilter('client', null);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Clients</option>
                    {distinctClients.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Business Unit Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Business Unit</label>
                  <select
                    value={columnFilters.businessUnit?.value || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setColumnFilter('businessUnit', { field: 'businessUnit', operator: 'contains', value: e.target.value });
                      } else {
                        setColumnFilter('businessUnit', null);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Business Units</option>
                    {distinctBusinessUnits.map((bu) => (
                      <option key={bu} value={bu}>
                        {bu}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Location / State</label>
                  <input
                    type="text"
                    placeholder="Search city, state..."
                    value={columnFilters.location?.value || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setColumnFilter('location', { field: 'location', operator: 'contains', value: e.target.value });
                      } else {
                        setColumnFilter('location', null);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Active filter badges */}
              {Object.keys(columnFilters).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">Active Filters:</span>
                  {Object.entries(columnFilters).map(([field, filter]) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-medium"
                    >
                      <span className="capitalize">{field}</span>: {filter.value}
                      <button
                        onClick={() => setColumnFilter(field, null)}
                        className="hover:text-blue-950 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bulk actions banner if rows selected */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 px-3 py-1.5 border-b border-blue-200 flex items-center justify-between text-xs text-blue-900">
              <span className="font-semibold">{selectedIds.size} job(s) selected</span>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    title="Permanently delete selected job postings (Admin only)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete ({selectedIds.size})</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSendReqModal(true)}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 cursor-pointer"
                >
                  Send to Vendors
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-blue-700 hover:underline text-xs cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Table Container (Horizontal and vertical scrolling) */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-[#f1f5f9] text-slate-800 border-b border-[#cbd5e1] font-bold z-10 select-none shadow-2xs">
                <tr>
                  <th className="w-9 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedJobs.length > 0 && selectedIds.size === paginatedJobs.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => handleSort('jobCode')}
                      >
                        Job Code {sortField === 'jobCode' ? (sortAsc ? '▲' : '▼') : ''}
                      </span>
                      <ColumnFilterPopover
                        field="jobCode"
                        currentFilter={columnFilters.jobCode}
                        onApply={(f) => setColumnFilter('jobCode', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => handleSort('jobTitle')}
                      >
                        Job Title {sortField === 'jobTitle' ? (sortAsc ? '▲' : '▼') : ''}
                      </span>
                      <ColumnFilterPopover
                        field="jobTitle"
                        currentFilter={columnFilters.jobTitle}
                        onApply={(f) => setColumnFilter('jobTitle', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => handleSort('businessUnit')}
                      >
                        Business Unit {sortField === 'businessUnit' ? (sortAsc ? '▲' : '▼') : ''}
                      </span>
                      <ColumnFilterPopover
                        field="businessUnit"
                        currentFilter={columnFilters.businessUnit}
                        onApply={(f) => setColumnFilter('businessUnit', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => handleSort('client')}
                      >
                        Client {sortField === 'client' ? (sortAsc ? '▲' : '▼') : ''}
                      </span>
                      <ColumnFilterPopover
                        field="client"
                        currentFilter={columnFilters.client}
                        onApply={(f) => setColumnFilter('client', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Client Job ID</span>
                      <ColumnFilterPopover
                        field="clientJobId"
                        currentFilter={columnFilters.clientJobId}
                        onApply={(f) => setColumnFilter('clientJobId', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Location</span>
                      <ColumnFilterPopover
                        field="location"
                        currentFilter={columnFilters.location}
                        onApply={(f) => setColumnFilter('location', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>States</span>
                      <ColumnFilterPopover
                        field="states"
                        currentFilter={columnFilters.states}
                        onApply={(f) => setColumnFilter('states', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Job Status</span>
                      <ColumnFilterPopover
                        field="jobStatus"
                        currentFilter={columnFilters.jobStatus}
                        onApply={(f) => setColumnFilter('jobStatus', f)}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <div className="flex items-center">
                      <span>Client Bill Rate</span>
                      <ColumnFilterPopover
                        field="clientBillRate"
                        currentFilter={columnFilters.clientBillRate}
                        onApply={(f) => setColumnFilter('clientBillRate', f)}
                      />
                    </div>
                  </th>
                  {isAdmin && (
                    <th className="w-14 px-3 py-2 text-center text-slate-600 font-bold">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6ec] bg-white">
                {paginatedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="py-16 text-center text-slate-400 font-normal">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((job) => {
                    const isSelected = selectedIds.has(job.id);
                    return (
                      <tr
                        key={job.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(job.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                        </td>

                        {/* Job Code: Blue link + pink badge + source glyphs */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedJobDetail(job)}
                              className="text-[#1467d6] font-semibold hover:underline"
                            >
                              {job.jobCode}
                            </button>

                            {/* Pink / Magenta numeric badge */}
                            {job.applicantsCount > 0 && (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-[#f43f5e] text-white text-[10px] font-bold rounded-full min-w-[20px] shadow-2xs">
                                +{job.applicantsCount}
                              </span>
                            )}

                            {/* Source Glyphs */}
                            <div className="flex items-center gap-0.5 ml-0.5">
                              {job.sources.includes('linkedin') && (
                                <span
                                  className="w-3 h-3 bg-[#0a66c2] text-white flex items-center justify-center text-[8px] font-bold rounded-2xs"
                                  title="LinkedIn"
                                >
                                  in
                                </span>
                              )}
                              {job.sources.includes('resume') && (
                                <span title="Resume Attached" className="inline-flex">
                                  <FileText className="w-3 h-3 text-amber-500" />
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Job Title */}
                        <td className="px-3 py-2 font-medium text-slate-800 max-w-[260px] truncate" title={job.jobTitle}>
                          <button
                            onClick={() => setSelectedJobDetail(job)}
                            className="text-left font-medium text-slate-800 hover:text-[#1467d6] hover:underline truncate max-w-full block"
                          >
                            {job.jobTitle}
                          </button>
                        </td>

                        {/* Business Unit */}
                        <td className="px-3 py-2 text-slate-600">{job.businessUnit}</td>

                        {/* Client */}
                        <td className="px-3 py-2 text-slate-700 font-medium">{job.client}</td>

                        {/* Client Job ID */}
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{job.clientJobId}</td>

                        {/* Location */}
                        <td className="px-3 py-2 text-slate-600">{job.location}</td>

                        {/* States */}
                        <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate" title={job.states}>
                          {job.states}
                        </td>

                        {/* Job Status */}
                        <td className="px-3 py-2">
                          <span
                            className={`font-semibold ${
                              job.jobStatus === 'Closed'
                                ? 'text-rose-700'
                                : job.jobStatus === 'Hold'
                                ? 'text-amber-700'
                                : job.jobStatus === 'Draft'
                                ? 'text-slate-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {job.jobStatus}
                          </span>
                        </td>

                        {/* Client Bill Rate */}
                        <td className="px-3 py-2 text-slate-700 font-medium">{job.clientBillRate}</td>

                        {/* Admin-only Row Action */}
                        {isAdmin && (
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setJobToDelete(job)}
                              title="Delete job posting (Admin only)"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredJobs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>


      {/* Send Requirement Modal */}
      {showSendReqModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#1467d6] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Broadcast Job Requirement
              </h4>
              <button onClick={() => setShowSendReqModal(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Select delivery channel to broadcast requirements to prime vendors and partners:
              </p>
              <div className="space-y-2 border border-slate-200 rounded p-2.5 bg-slate-50">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                  <span>Send to Approved Vendor Distribution List</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                  <span>Post to Ceipal Talent Network</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input type="checkbox" className="rounded text-blue-600" />
                  <span>Broadcast on LinkedIn Recruiter Pipeline</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSendReqModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSendReqModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded font-medium shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Broadcast Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Venus Recruiter Copilot Extension Modal */}
      {showCopilotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-indigo-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/15 rounded-lg">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Venus Recruiter Copilot — Chrome Extension</h3>
                  <p className="text-[11px] text-indigo-200">Auto-post to LinkedIn, Indeed & Naukri • 1-Click Candidate Sourcing</p>
                </div>
              </div>
              <button
                onClick={() => setShowCopilotModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg">
                  <div className="font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                    <span>⚡</span> 1-Click Auto-Fill
                  </div>
                  <p className="text-[11px] text-indigo-800/80 leading-relaxed">
                    Fills requisitions onto LinkedIn, Indeed, and Naukri with zero copy-pasting.
                  </p>
                </div>
                <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-lg">
                  <div className="font-bold text-violet-950 mb-1 flex items-center gap-1.5">
                    <span>📢</span> Viral Social Blast
                  </div>
                  <p className="text-[11px] text-violet-800/80 leading-relaxed">
                    Drafts formatted hiring announcements with hashtags and direct apply link.
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
                  <div className="font-bold text-emerald-950 mb-1 flex items-center gap-1.5">
                    <span>📥</span> Reverse Sourcing
                  </div>
                  <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                    Extracts candidate profiles from LinkedIn/Resdex directly into CRM as SOURCED.
                  </p>
                </div>
              </div>

              {/* 3-Step Setup Instructions */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>🛠️</span> 3-Step Extension Installation
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 pl-0.5">
                  <li>
                    Open <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-indigo-700">chrome://extensions</code> in Chrome, Brave, or Edge.
                  </li>
                  <li>Toggle <strong>Developer mode</strong> in the top-right corner to ON.</li>
                  <li>Click <strong>Load unpacked</strong> and select the extension folder below:</li>
                </ol>

                <div className="flex items-center gap-2 mt-2 bg-white border border-slate-300 rounded-lg p-2 font-mono text-[11px] text-slate-800 select-all">
                  <span className="flex-1 truncate">chrome-extension</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("chrome-extension");
                      setCopiedExtensionPath(true);
                      setTimeout(() => setCopiedExtensionPath(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-sans font-semibold rounded text-[11px] transition-colors cursor-pointer"
                  >
                    {copiedExtensionPath ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedExtensionPath ? 'Copied!' : 'Copy Name'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Launch Buttons */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Launch Supported Job Boards
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://www.linkedin.com/jobs/post"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0077b5] text-white rounded-md text-xs font-semibold hover:opacity-90 shadow-2xs transition-opacity"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn Jobs ↗</span>
                  </a>
                  <a
                    href="https://employers.indeed.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2164f3] text-white rounded-md text-xs font-semibold hover:opacity-90 shadow-2xs transition-opacity"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Indeed Employer ↗</span>
                  </a>
                  <a
                    href="https://employer.naukri.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff7555] text-white rounded-md text-xs font-semibold hover:opacity-90 shadow-2xs transition-opacity"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Naukri Recruiter ↗</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowCopilotModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Admin Delete Confirmation Modal (Single Job) */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Job Posting (Admin Only)
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-slate-900">"{jobToDelete.jobTitle}"</strong> ({jobToDelete.jobCode})?
                </p>
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    This action is permanent and immediate:
                  </p>
                  <ul className="list-disc list-inside text-rose-700 pl-1 space-y-0.5">
                    <li>Removed from CRM Job Postings table</li>
                    <li>Removed from VenusGlobalTech public website & careers portal</li>
                    <li>All candidate submissions and requisition data will be deleted</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setJobToDelete(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleSingleDeleteConfirm}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Admin Delete Confirmation Modal (Bulk Selected Jobs) */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete {selectedIds.size} Job Postings (Admin Only)
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete all{' '}
                  <strong className="text-slate-900">{selectedIds.size} selected job requisitions</strong>?
                </p>
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    This action is permanent and immediate:
                  </p>
                  <ul className="list-disc list-inside text-rose-700 pl-1 space-y-0.5">
                    <li>Removed from CRM Job Postings table</li>
                    <li>Removed from VenusGlobalTech public website & careers portal</li>
                    <li>All candidate submissions and requisition data will be deleted</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleBulkDeleteConfirm}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Jobs`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
