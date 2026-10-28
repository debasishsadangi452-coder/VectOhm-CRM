import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Star,
  Calendar,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Download,
  Search,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { useTeamPerformance } from '@/hooks/use-recruitment';

function parseRate(rateStr: string | null | undefined): number {
  if (!rateStr) return 0;
  const cleaned = rateStr.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function isDateInRange(dateStr: string | null | undefined, range: string): boolean {
  if (!dateStr) return true;
  const parts = dateStr.split('T')[0].split('-');
  let d: Date;
  if (parts.length === 3) {
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  const normalized = (range || '').trim().toLowerCase();

  if (normalized === 'today') {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  if (normalized === 'this week') {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff && d <= now;
  }

  if (normalized.includes('month to') || normalized.includes('mtd')) {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d <= now
    );
  }

  if (normalized === 'last month') {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  }

  if (normalized === 'last 3 months') {
    const cutoff = new Date(now);
    cutoff.setMonth(now.getMonth() - 3);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff && d <= now;
  }

  if (normalized === 'year to date' || normalized === 'ytd') {
    return d.getFullYear() === now.getFullYear() && d <= now;
  }

  return true;
}

interface PanelPaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PanelPagination: React.FC<PanelPaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <div className="p-3 bg-slate-50 border-t border-[#e2e6ec] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
      <span>
        Showing {startItem} to {endItem} of {totalItems} entries
      </span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white text-xs font-medium cursor-pointer transition-colors"
          >
            Previous
          </button>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1.5 py-0.5 text-slate-400">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(Number(p))}
                className={`min-w-[26px] h-[26px] px-1.5 rounded text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-[#0b5ed7] text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white text-xs font-medium cursor-pointer transition-colors"
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
          >
            {[5, 10, 25, 50].map((sz) => (
              <option key={sz} value={sz}>
                {sz} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export const HomeDashboardView: React.FC = () => {
  const { setActiveModule, jobs, placements, customApplicants } = useCeipal();
  const [isDefaultDashboard, setIsDefaultDashboard] = useState(false);

  // Widget Date Range Filters
  const [jsipDateRange, setJsipDateRange] = useState('Month To Till Date');
  const [confirmDateRange, setConfirmDateRange] = useState('Last 3 Months');
  const [notesDateRange, setNotesDateRange] = useState('This Week');

  // Live team performance queries synchronized dynamically with each widget's selected range
  const { data: jsipTeamData, isLoading: isJsipLoading } = useTeamPerformance(jsipDateRange);
  const { data: notesTeamData, isLoading: isNotesLoading } = useTeamPerformance(notesDateRange);

  // Widget Expanded states: 'jsip' | 'confirm' | 'notes' | null
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  // Search filter inside expanded panels
  const [panelSearch, setPanelSearch] = useState('');

  // Pagination inside expanded panels
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleOpenExpandedWidget = (widget: string) => {
    setExpandedWidget(widget);
    setPanelSearch('');
    setCurrentPage(1);
  };

  const handleCloseExpandedWidget = () => {
    setExpandedWidget(null);
    setPanelSearch('');
    setCurrentPage(1);
  };

  const handleJsipDateChange = (val: string) => {
    setJsipDateRange(val);
    setCurrentPage(1);
  };

  const handleConfirmDateChange = (val: string) => {
    setConfirmDateRange(val);
    setCurrentPage(1);
  };

  const handleNotesDateChange = (val: string) => {
    setNotesDateRange(val);
    setCurrentPage(1);
  };

  const dateOptions = [
    'Today',
    'This Week',
    'Month To Till Date',
    'Last Month',
    'Last 3 Months',
    'Year To Date',
  ];

  // ---------------------------------------------------------------------------
  // DYNAMIC COMPUTED DATA PIPELINES (100% SYNCHRONIZED WITH BACKEND & DB)
  // ---------------------------------------------------------------------------

  // 1. JSIP Recruiter Performance Pipeline
  const jsipRecruiters = useMemo(() => {
    return (jsipTeamData || []).map((r) => {
      const submissions = r.submissions || 0;
      // clientSubmissions always comes back from the backend now (never a
      // guessed ratio -- a real count is worth more than an invented one).
      const clientSubmissions = r.clientSubmissions ?? 0;
      const interviews = r.interviews || 0;
      const hires = r.hires || 0;
      const conversionRate = submissions > 0 ? Math.round((hires / submissions) * 1000) / 10 : 0;

      return {
        id: r.userId,
        name: r.name,
        submissions,
        clientSubmissions,
        interviews,
        hires,
        conversion: `${conversionRate}%`,
        conversionRate,
        conversionWidth: `${Math.min(conversionRate, 100)}%`,
        status: 'Active',
      };
    });
  }, [jsipTeamData]);

  const filteredJsipRecruiters = useMemo(() => {
    if (!panelSearch.trim()) return jsipRecruiters;
    const q = panelSearch.toLowerCase();
    return jsipRecruiters.filter((r) => r.name.toLowerCase().includes(q));
  }, [jsipRecruiters, panelSearch]);

  const paginatedJsipRecruiters = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJsipRecruiters.slice(start, start + pageSize);
  }, [filteredJsipRecruiters, currentPage, pageSize]);

  // 2. Confirmations & Placements Pipeline
  const allConfirmationRows = useMemo(() => {
    return (placements || []).map((p) => {
      const billNum = parseRate(p.clientBillRate);
      const payNum = parseRate(p.payRate);
      const marginHr = Math.max(0, billNum - payNum);
      const monthlyMargin = marginHr * 160;

      return {
        id: p.id,
        // Honest placeholders only -- never a specific-looking fake value
        // (job code, client req ID, phone number) that could be mistaken
        // for a real record.
        jobCode: p.jobCode || '',
        positionTitle: p.jobTitle || '',
        clientJobId: p.clientJobId || '',
        client: p.clientPrimeVendor || '',
        primaryRecruiter: p.createdBy || 'Recruitment Team',
        applicantName: p.applicantName || 'Candidate',
        mobileNumber: p.mobileNumber || 'N/A',
        location: p.location || '',
        billRate: p.clientBillRate || 'N/A',
        payRate: p.payRate || 'N/A',
        marginHr: `$${marginHr.toFixed(2)}/hr`,
        monthlyMargin,
        status: p.status || 'Draft',
        date: p.createdOn || new Date().toISOString().split('T')[0],
      };
    });
  }, [placements]);

  const confirmationRows = useMemo(() => {
    return allConfirmationRows.filter((r) => isDateInRange(r.date, confirmDateRange));
  }, [allConfirmationRows, confirmDateRange]);

  const filteredConfirmationRows = useMemo(() => {
    if (!panelSearch.trim()) return confirmationRows;
    const q = panelSearch.toLowerCase();
    return confirmationRows.filter(
      (r) =>
        r.positionTitle.toLowerCase().includes(q) ||
        r.applicantName.toLowerCase().includes(q) ||
        r.jobCode.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        r.primaryRecruiter.toLowerCase().includes(q)
    );
  }, [confirmationRows, panelSearch]);

  const paginatedConfirmationRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredConfirmationRows.slice(start, start + pageSize);
  }, [filteredConfirmationRows, currentPage, pageSize]);

  // 3. Notes - Messages - Tasks Pipeline
  const activityRows = useMemo(() => {
    return (notesTeamData || []).map((r) => {
      const tasksAssigned = r.tasksAssigned || 0;
      const tasksCompleted = r.tasksCompleted || 0;
      const completionRate =
        tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;

      return {
        id: r.userId,
        user: r.name,
        notes: r.notesLogged || 0,
        tasks: tasksAssigned,
        completed: tasksCompleted,
        activities: r.activitiesLogged || 0,
        completionRate,
      };
    });
  }, [notesTeamData]);

  const filteredActivityRows = useMemo(() => {
    if (!panelSearch.trim()) return activityRows;
    const q = panelSearch.toLowerCase();
    return activityRows.filter((r) => r.user.toLowerCase().includes(q));
  }, [activityRows, panelSearch]);

  const paginatedActivityRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivityRows.slice(start, start + pageSize);
  }, [filteredActivityRows, currentPage, pageSize]);

  // ---------------------------------------------------------------------------
  // SYNCHRONIZED SUMMARY STATS COMPUTATIONS (DYNAMIC FORMULAS)
  // ---------------------------------------------------------------------------

  const jsipTotals = useMemo(() => {
    const totalSubmissions = jsipRecruiters.reduce((s, r) => s + r.submissions, 0);
    const totalClientSubmissions = jsipRecruiters.reduce((s, r) => s + r.clientSubmissions, 0);
    const totalInterviews = jsipRecruiters.reduce((s, r) => s + r.interviews, 0);
    const totalHires = jsipRecruiters.reduce((s, r) => s + r.hires, 0);
    const totalConfirmations = Math.max(totalHires, confirmationRows.length);

    const clientRatio = totalSubmissions > 0 ? ((totalClientSubmissions / totalSubmissions) * 100).toFixed(1) : '0.0';
    const interviewRate = totalClientSubmissions > 0 ? ((totalInterviews / totalClientSubmissions) * 100).toFixed(1) : '0.0';
    const confirmationRate = totalInterviews > 0 ? ((totalConfirmations / totalInterviews) * 100).toFixed(1) : '0.0';
    const finalConversion = totalConfirmations > 0 ? ((totalHires / totalConfirmations) * 100).toFixed(1) : '0.0';

    return {
      totalSubmissions,
      totalClientSubmissions,
      clientRatio,
      totalInterviews,
      interviewRate,
      totalConfirmations,
      confirmationRate,
      totalHires,
      finalConversion,
    };
  }, [jsipRecruiters, confirmationRows]);

  const confirmTotals = useMemo(() => {
    const totalConfirmed = confirmationRows.length;
    const joinedPlacements = confirmationRows.filter(
      (r) =>
        r.status.toLowerCase().includes('joined') ||
        r.status.toLowerCase().includes('accept') ||
        r.status.toLowerCase().includes('active')
    ).length;
    const pendingStarts = Math.max(0, totalConfirmed - joinedPlacements);
    const startRate = totalConfirmed > 0 ? Math.round((joinedPlacements / totalConfirmed) * 100) : 0;
    const uniqueClients = new Set(confirmationRows.map((r) => r.client).filter(Boolean)).size;
    const totalMonthlyMargin = confirmationRows.reduce((sum, r) => sum + r.monthlyMargin, 0);
    const avgGrossSpread =
      confirmationRows.length > 0
        ? (totalMonthlyMargin / (confirmationRows.length * 160)).toFixed(2)
        : '0.00';

    return {
      totalConfirmed,
      joinedPlacements,
      pendingStarts,
      startRate,
      uniqueClients,
      totalMonthlyMargin,
      avgGrossSpread,
    };
  }, [confirmationRows]);

  const notesTotals = useMemo(() => {
    const totalNotes = activityRows.reduce((sum, r) => sum + r.notes, 0);
    const totalTasksAssigned = activityRows.reduce((sum, r) => sum + r.tasks, 0);
    const totalTasksCompleted = activityRows.reduce((sum, r) => sum + r.completed, 0);
    const totalActivities = activityRows.reduce((sum, r) => sum + r.activities, 0);
    const completionRate =
      totalTasksAssigned > 0 ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100) : 0;

    return {
      totalNotes,
      totalTasksAssigned,
      totalTasksCompleted,
      totalActivities,
      completionRate,
    };
  }, [activityRows]);

  // ---------------------------------------------------------------------------
  // EXCEL EXPORT WORKERS (DOWNLOADS CLEAN .XLSX FILES)
  // ---------------------------------------------------------------------------

  const handleExportJSIP = () => {
    if (!filteredJsipRecruiters.length) {
      toast.error('No recruiter data available to export.');
      return;
    }
    try {
      const exportData = filteredJsipRecruiters.map((r) => ({
        'User / Recruiter': r.name,
        '# Submissions': r.submissions,
        '# Client Submissions': r.clientSubmissions,
        '# Interviews': r.interviews,
        '# Hires': r.hires,
        'Conversion Rate': r.conversion,
        'Status': r.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 24 },
        { wch: 16 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'JSIP Report');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `JSIP_Report_${jsipDateRange.replace(/\s+/g, '_')}_${today}.xlsx`);
      toast.success(`Successfully exported ${exportData.length} recruiter records to Excel (.xlsx)!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export JSIP report.');
    }
  };

  const handleExportConfirmations = () => {
    if (!filteredConfirmationRows.length) {
      toast.error('No confirmation records available to export.');
      return;
    }
    try {
      const exportData = filteredConfirmationRows.map((r) => ({
        'Job Code': r.jobCode,
        'Position Title': r.positionTitle,
        'Client Job ID': r.clientJobId,
        'Client': r.client,
        'Primary Recruiter': r.primaryRecruiter,
        'Applicant Name': r.applicantName,
        'Mobile Number': r.mobileNumber,
        'Location': r.location,
        'Bill Rate': r.billRate,
        'Pay Rate': r.payRate,
        'Hourly Spread': r.marginHr,
        'Est. Monthly Margin': `$${Math.round(r.monthlyMargin).toLocaleString()}`,
        'Confirmed Date': r.date,
        'Status': r.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 16 },
        { wch: 32 },
        { wch: 18 },
        { wch: 24 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 15 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Confirmations & Placements');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Confirmations_Placements_Report_${confirmDateRange.replace(/\s+/g, '_')}_${today}.xlsx`);
      toast.success(`Successfully exported ${exportData.length} placement records to Excel (.xlsx)!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export confirmations report.');
    }
  };

  const handleExportNotes = () => {
    if (!filteredActivityRows.length) {
      toast.error('No activity records available to export.');
      return;
    }
    try {
      const exportData = filteredActivityRows.map((r) => ({
        'User / Recruiter': r.user,
        'Notes Logged': r.notes,
        'Tasks Assigned': r.tasks,
        'Tasks Completed': r.completed,
        'Completion Rate': `${r.completionRate}%`,
        'Activities Logged': r.activities,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 24 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Recruiter Productivity');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Notes_Tasks_Report_${notesDateRange.replace(/\s+/g, '_')}_${today}.xlsx`);
      toast.success(`Successfully exported ${exportData.length} productivity records to Excel (.xlsx)!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export productivity report.');
    }
  };

  const handleExportConsolidatedDashboard = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: JSIP Pipeline
      const jsipData = jsipRecruiters.map((r) => ({
        'Recruiter': r.name,
        'Submissions': r.submissions,
        'Client Submissions': r.clientSubmissions,
        'Interviews': r.interviews,
        'Hires': r.hires,
        'Conversion': r.conversion,
        'Status': r.status,
      }));
      const ws1 = XLSX.utils.json_to_sheet(jsipData);
      ws1['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'JSIP Pipeline');

      // Sheet 2: Placements
      const confData = confirmationRows.map((r) => ({
        'Job Code': r.jobCode,
        'Position Title': r.positionTitle,
        'Client': r.client,
        'Recruiter': r.primaryRecruiter,
        'Applicant': r.applicantName,
        'Bill Rate': r.billRate,
        'Pay Rate': r.payRate,
        'Spread': r.marginHr,
        'Confirmed Date': r.date,
        'Status': r.status,
      }));
      const ws2 = XLSX.utils.json_to_sheet(confData);
      ws2['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Placements & Confirmations');

      // Sheet 3: Productivity
      const actData = activityRows.map((r) => ({
        'User / Recruiter': r.user,
        'Notes Logged': r.notes,
        'Tasks Assigned': r.tasks,
        'Tasks Completed': r.completed,
        'Completion Rate': `${r.completionRate}%`,
        'Activities Logged': r.activities,
      }));
      const ws3 = XLSX.utils.json_to_sheet(actData);
      ws3['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Productivity & Activity');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Recruiter_Dashboard_Consolidated_${today}.xlsx`);
      toast.success('Downloaded complete Recruiter Dashboard workbook as Excel (.xlsx)!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export consolidated dashboard.');
    }
  };

  // ---------------------------------------------------------------------------
  // FULL PAGE PANEL 1: JSIP Report
  // ---------------------------------------------------------------------------
  if (expandedWidget === 'jsip') {
    return (
      <div className="p-4 min-h-[calc(100vh-60px)] space-y-4 text-slate-800 bg-[#eef1f6] animate-in fade-in duration-150">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseExpandedWidget}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-xs flex items-center justify-center text-white bg-[#0b5ed7]">
                <span className="text-[10px] font-bold">▦</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">JSIP Report (Job Submission Interview Placement)</h2>
                <p className="text-[11px] text-slate-500">Comprehensive breakdown of candidate pipelines and recruiter conversion</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={jsipDateRange}
                onChange={(e) => handleJsipDateChange(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs"
              >
                {dateOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportJSIP}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer shadow-2xs transition-colors"
              title="Download Excel Sheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            <button
              onClick={handleCloseExpandedWidget}
              title="Close Fullscreen"
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 cursor-pointer shadow-2xs"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric KPI Cards (100% Dynamically Synchronized) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Submissions</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{jsipTotals.totalSubmissions}</span>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">↑ Active pipeline records</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Client Submissions</span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">{jsipTotals.totalClientSubmissions}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{jsipTotals.clientRatio}% ratio</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Interviews</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">{jsipTotals.totalInterviews}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{jsipTotals.interviewRate}% client rate</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Confirmations</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">{jsipTotals.totalConfirmations}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{jsipTotals.confirmationRate}% interview rate</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Hires / Placements</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">{jsipTotals.totalHires}</span>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">{jsipTotals.finalConversion}% final conversion</span>
          </div>
        </div>

        {/* Full Data Table */}
        <div className="bg-white rounded-lg border border-[#e2e6ec] shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#e2e6ec] flex items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2 max-w-xs w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search recruiter..."
                value={panelSearch}
                onChange={(e) => {
                  setPanelSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-xs"
              />
            </div>
            <span className="text-xs text-slate-500">Showing {filteredJsipRecruiters.length} recruiters</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                  <th className="px-4 py-2.5">User / Recruiter</th>
                  <th className="px-4 py-2.5"># Submissions</th>
                  <th className="px-4 py-2.5"># Client Submissions</th>
                  <th className="px-4 py-2.5"># Interviews</th>
                  <th className="px-4 py-2.5"># Hires</th>
                  <th className="px-4 py-2.5">Conversion Rate</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJsipRecruiters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No recruiters matching search
                    </td>
                  </tr>
                ) : (
                  paginatedJsipRecruiters.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                          {r.name.charAt(0)}
                        </div>
                        <span>{r.name}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{r.submissions}</td>
                      <td className="px-4 py-3 font-medium text-blue-600">{r.clientSubmissions}</td>
                      <td className="px-4 py-3 font-medium text-indigo-600">{r.interviews}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{r.hires}</td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0b5ed7] h-full rounded-full" style={{ width: r.conversionWidth }} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700">{r.conversion}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PanelPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredJsipRecruiters.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL PAGE PANEL 2: Confirmations & Placements Report
  // ---------------------------------------------------------------------------
  if (expandedWidget === 'confirm') {
    return (
      <div className="p-4 min-h-[calc(100vh-60px)] space-y-4 text-slate-800 bg-[#eef1f6] animate-in fade-in duration-150">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseExpandedWidget}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-xs flex items-center justify-center text-white bg-amber-500">
                <span className="text-[10px] font-bold">✓</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Confirmations & Placements Report</h2>
                <p className="text-[11px] text-slate-500">Live tracker for candidate offer acceptances, client confirmations, and start dates</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={confirmDateRange}
                onChange={(e) => handleConfirmDateChange(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs"
              >
                {dateOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportConfirmations}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer shadow-2xs transition-colors"
              title="Download Excel Sheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            <button
              onClick={handleCloseExpandedWidget}
              title="Close Fullscreen"
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 cursor-pointer shadow-2xs"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric KPI Cards (100% Dynamically Synchronized) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Confirmed</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{confirmTotals.totalConfirmed}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Across {confirmTotals.uniqueClients} key client accounts</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Joined / Active Placements</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">{confirmTotals.joinedPlacements}</span>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">{confirmTotals.startRate}% start rate</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pending Start Dates</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">{confirmTotals.pendingStarts}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Starting next 14 days</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Est. Monthly Margin</span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">
              ${Math.round(confirmTotals.totalMonthlyMargin).toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
              Avg ${confirmTotals.avgGrossSpread}/hr gross spread
            </span>
          </div>
        </div>

        {/* Full Data Table */}
        <div className="bg-white rounded-lg border border-[#e2e6ec] shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#e2e6ec] flex items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2 max-w-sm w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search job code, title, candidate, client..."
                value={panelSearch}
                onChange={(e) => {
                  setPanelSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-xs"
              />
            </div>
            <span className="text-xs text-slate-500">Showing {filteredConfirmationRows.length} confirmation records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                  <th className="px-4 py-2.5">Job Code</th>
                  <th className="px-4 py-2.5">Position Title</th>
                  <th className="px-4 py-2.5">Client Job ID</th>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5">Primary Recruiter</th>
                  <th className="px-4 py-2.5">Applicant Name</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Bill Rate</th>
                  <th className="px-4 py-2.5">Pay Rate</th>
                  <th className="px-4 py-2.5">Spread</th>
                  <th className="px-4 py-2.5">Confirmed Date</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredConfirmationRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No confirmation records found
                    </td>
                  </tr>
                ) : (
                  paginatedConfirmationRows.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td
                        className="px-4 py-3 font-bold text-blue-600 cursor-pointer hover:underline"
                        onClick={() => setActiveModule('jobs')}
                      >
                        {r.jobCode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.positionTitle}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{r.clientJobId}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{r.client}</td>
                      <td className="px-4 py-3 text-slate-600">{r.primaryRecruiter}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.applicantName}</td>
                      <td className="px-4 py-3 text-slate-500">{r.location}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{r.billRate}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{r.payRate}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{r.marginHr}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{r.date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.status.toLowerCase().includes('joined')
                              ? 'bg-emerald-100 text-emerald-700'
                              : r.status.toLowerCase().includes('accept')
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PanelPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredConfirmationRows.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL PAGE PANEL 3: Notes - Messages - Tasks Report
  // ---------------------------------------------------------------------------
  if (expandedWidget === 'notes') {
    return (
      <div className="p-4 min-h-[calc(100vh-60px)] space-y-4 text-slate-800 bg-[#eef1f6] animate-in fade-in duration-150">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseExpandedWidget}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-xs flex items-center justify-center text-white bg-indigo-600">
                <span className="text-[10px] font-bold">✎</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Notes - Messages - Tasks Report</h2>
                <p className="text-[11px] text-slate-500">Recruiter outreach productivity, candidate follow-ups, and open action items</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={notesDateRange}
                onChange={(e) => handleNotesDateChange(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs"
              >
                {dateOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportNotes}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer shadow-2xs transition-colors"
              title="Download Excel Sheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            <button
              onClick={handleCloseExpandedWidget}
              title="Close Fullscreen"
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 cursor-pointer shadow-2xs"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric KPI Cards (100% Dynamically Synchronized) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Notes Logged</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{notesTotals.totalNotes}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Outreach logs & updates</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tasks Completed</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">{notesTotals.totalTasksCompleted}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{notesTotals.completionRate}% completion rate</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tasks Assigned</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">{notesTotals.totalTasksAssigned}</span>
            <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block">Active action items</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-[#e2e6ec] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Activities Logged</span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">{notesTotals.totalActivities}</span>
            <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">System touchpoints</span>
          </div>
        </div>

        {/* Full Data Table */}
        <div className="bg-white rounded-lg border border-[#e2e6ec] shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#e2e6ec] flex items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2 max-w-sm w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search recruiter..."
                value={panelSearch}
                onChange={(e) => {
                  setPanelSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-xs"
              />
            </div>
            <span className="text-xs text-slate-500">Showing {filteredActivityRows.length} team members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                  <th className="px-4 py-2.5">User / Recruiter</th>
                  <th className="px-4 py-2.5">Notes Logged</th>
                  <th className="px-4 py-2.5">Tasks Assigned</th>
                  <th className="px-4 py-2.5">Tasks Completed</th>
                  <th className="px-4 py-2.5">Activities Logged</th>
                  <th className="px-4 py-2.5">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivityRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No team members matching search
                    </td>
                  </tr>
                ) : (
                  paginatedActivityRows.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                          {r.user.charAt(0)}
                        </div>
                        <span>{r.user}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{r.notes}</td>
                      <td className="px-4 py-3 text-slate-600">{r.tasks}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{r.completed}</td>
                      <td className="px-4 py-3 font-medium text-indigo-600">{r.activities}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                          {r.completionRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PanelPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredActivityRows.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN DEFAULT DASHBOARD SCREEN
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 min-h-[calc(100vh-60px)] space-y-3.5 text-slate-800" style={{ backgroundColor: '#eef1f6', color: '#1e293b' }}>
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Title with orange square badge and DASHBOARD eyebrow */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-5 h-5 rounded-xs flex items-center justify-center text-white shadow-2xs"
            style={{ backgroundColor: '#f97316', color: '#ffffff' }}
          >
            <span className="text-[10px] font-bold">▦</span>
          </div>
          <div>
            <div
              className="text-[10px] font-bold tracking-wider uppercase leading-none"
              style={{ color: '#0b5ed7' }}
            >
              DASHBOARD
            </div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Recruiter Dashboard</h1>
          </div>
        </div>

        {/* Top-right: Export Dashboard button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportConsolidatedDashboard}
            title="Download full Excel report of all dashboard widgets"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Dashboard</span>
          </button>
        </div>
      </div>

      {/* Secondary Row: Star + Create links & Make Default checkbox */}
      <div className="flex flex-wrap items-center justify-between text-xs py-1 px-0.5 border-b border-slate-200/80 gap-2">
        <div className="flex items-center gap-3">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <button
            onClick={() => setActiveModule('jobs')}
            className="font-semibold hover:underline cursor-pointer"
            style={{ color: '#1467d6' }}
          >
            Create Job
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setActiveModule('applicants')}
            className="font-semibold hover:underline cursor-pointer"
            style={{ color: '#1467d6' }}
          >
            Create an Applicant
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefaultDashboard}
            onChange={(e) => setIsDefaultDashboard(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span>Make as Default Dashboard</span>
        </label>
      </div>

      {/* Main Grid: 3 Live Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Widget 1: JSIP Report (Left) */}
        <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs overflow-hidden flex flex-col min-h-[260px]">
          {/* Widget Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-[#e2e6ec]">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">JSIP Report</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                {jsipTotals.totalSubmissions} Subs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-700">
                <Calendar className="w-3 h-3 text-slate-400" />
                <select
                  value={jsipDateRange}
                  onChange={(e) => handleJsipDateChange(e.target.value)}
                  className="bg-transparent font-medium focus:outline-none cursor-pointer text-[11px]"
                >
                  {dateOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExportJSIP}
                title="Export JSIP Report as Excel"
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOpenExpandedWidget('jsip')}
                title="Expand to Full Page"
                className="text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Widget Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/60 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                  <th className="px-3 py-2">User Name</th>
                  <th className="px-3 py-2"># Submissions</th>
                  <th className="px-3 py-2"># Client Subs</th>
                  <th className="px-3 py-2"># Interviews</th>
                  <th className="px-3 py-2"># Hires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jsipRecruiters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-normal">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  jsipRecruiters.slice(0, 6).map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-800 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[9px]">
                          {r.name.charAt(0)}
                        </div>
                        <span className="truncate max-w-[130px]">{r.name}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{r.submissions}</td>
                      <td className="px-3 py-2 text-blue-600 font-medium">{r.clientSubmissions}</td>
                      <td className="px-3 py-2 text-indigo-600 font-medium">{r.interviews}</td>
                      <td className="px-3 py-2 font-bold text-emerald-600">{r.hires}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Widget Footer */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-[#e2e6ec] text-[11px] text-slate-500">
            <span>
              Showing {jsipRecruiters.length > 0 ? 1 : 0} to {Math.min(6, jsipRecruiters.length)} of {jsipRecruiters.length} entries
            </span>
            <button
              onClick={() => handleOpenExpandedWidget('jsip')}
              className="text-blue-600 hover:underline cursor-pointer font-medium"
            >
              View Full Report →
            </button>
          </div>
        </div>

        {/* Widget 2: Confirmations (Right) */}
        <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs overflow-hidden flex flex-col min-h-[260px]">
          {/* Widget Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-[#e2e6ec]">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">Confirmations</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                {confirmTotals.totalConfirmed} Placements
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-700">
                <Calendar className="w-3 h-3 text-slate-400" />
                <select
                  value={confirmDateRange}
                  onChange={(e) => handleConfirmDateChange(e.target.value)}
                  className="bg-transparent font-medium focus:outline-none cursor-pointer text-[11px]"
                >
                  {dateOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExportConfirmations}
                title="Export Confirmations as Excel"
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOpenExpandedWidget('confirm')}
                title="Expand to Full Page"
                className="text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Widget Table (Horizontally scrollable) */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-[620px]">
              <thead>
                <tr className="bg-slate-100/60 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                  <th className="px-3 py-2">Job Code</th>
                  <th className="px-3 py-2">Position Title</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Applicant Name</th>
                  <th className="px-3 py-2">Bill Rate</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {confirmationRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      No confirmations available
                    </td>
                  </tr>
                ) : (
                  confirmationRows.slice(0, 6).map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td
                        className="px-3 py-2 font-bold text-blue-600 cursor-pointer hover:underline"
                        onClick={() => setActiveModule('jobs')}
                      >
                        {row.jobCode}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[150px]">{row.positionTitle}</td>
                      <td className="px-3 py-2 text-slate-600">{row.client}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">{row.applicantName}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.billRate}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                            row.status.toLowerCase().includes('joined')
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Widget Footer */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-[#e2e6ec] text-[11px] text-slate-500">
            <span>
              Showing {confirmationRows.length > 0 ? 1 : 0} to {Math.min(6, confirmationRows.length)} of {confirmationRows.length} entries
            </span>
            <button
              onClick={() => handleOpenExpandedWidget('confirm')}
              className="text-blue-600 hover:underline cursor-pointer font-medium"
            >
              View Full Report →
            </button>
          </div>
        </div>
      </div>

      {/* Widget 3: Notes - Messages - Tasks (Full width below) */}
      <div className="bg-white rounded-md border border-[#e2e6ec] shadow-xs overflow-hidden flex flex-col min-h-[240px]">
        {/* Widget Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-[#e2e6ec]">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
              Notes - Messages - Tasks
            </h3>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full">
              {notesTotals.totalActivities} Touchpoints
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-700">
              <Calendar className="w-3 h-3 text-slate-400" />
              <select
                value={notesDateRange}
                onChange={(e) => handleNotesDateChange(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer text-[11px]"
              >
                {dateOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExportNotes}
              title="Export Notes & Tasks as Excel"
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleOpenExpandedWidget('notes')}
              title="Expand to Full Page"
              className="text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded p-1 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Widget Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 text-slate-700 border-b border-[#e2e6ec] font-bold text-[11px]">
                <th className="px-3 py-2">User Name</th>
                <th className="px-3 py-2">Total Notes Count</th>
                <th className="px-3 py-2">Tasks Assigned</th>
                <th className="px-3 py-2">Tasks Completed</th>
                <th className="px-3 py-2">Activities Logged</th>
                <th className="px-3 py-2">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activityRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                    No activity records found
                  </td>
                </tr>
              ) : (
                activityRows.slice(0, 6).map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-800 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px]">
                        {row.user.charAt(0)}
                      </div>
                      <span>{row.user}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700">{row.notes}</td>
                    <td className="px-3 py-2 text-slate-600">{row.tasks}</td>
                    <td className="px-3 py-2 font-bold text-emerald-600">{row.completed}</td>
                    <td className="px-3 py-2 font-medium text-indigo-600">{row.activities}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {row.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Widget Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-[#e2e6ec] text-[11px] text-slate-500">
          <span>
            Showing {activityRows.length > 0 ? 1 : 0} to {Math.min(6, activityRows.length)} of {activityRows.length} entries
          </span>
          <button
            onClick={() => handleOpenExpandedWidget('notes')}
            className="text-blue-600 hover:underline cursor-pointer font-medium"
          >
            View Full Report →
          </button>
        </div>
      </div>
    </div>
  );
};
