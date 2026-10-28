import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  RotateCcw,
  Plus,
  Search,
  Briefcase,
  UserPlus,
  UserCheck,
  Building,
  Truck,
  TrendingUp,
  DollarSign,
  X,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Calendar,
  Sparkles,
  Info,
  Clock,
  Layers,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';
import { useJobActivities } from '@/hooks/use-recruitment';
import { useCeipal } from './ceipal-context';
import { CeipalModule } from './types';

interface HeaderProps {
  onOpenQuickCreate?: (type: 'job' | 'applicant' | 'client' | 'vendor' | 'lead') => void;
}

interface CeipalNotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  module: CeipalModule;
  link?: string;
  isBackend: boolean;
  createdAt: string;
  type?: string;
}

export const CeipalHeader: React.FC<HeaderProps> = ({ onOpenQuickCreate }) => {
  const navigate = useNavigate();
  const {
    activeModule,
    setActiveModule,
    setIsCreatingJob,
    setIsCreatingApplicant,
    setSelectedApplicantDetail,
    setSelectedJobDetail,
    isRightDrawerOpen,
    toggleRightDrawer,
    jobs,
    customApplicants,
    clients,
    vendors,
    leads,
    addJob,
    addApplicant,
    addClient,
    addVendor,
    addLead,
    setSearchQuery,
  } = useCeipal();

  const queryClient = useQueryClient();

  // 1. Notifications State & Backend Integration
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const [clearedMockIds, setClearedMockIds] = useState<Set<string>>(new Set());
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

  const { data: rawNotifications = [] } = useNotifications();
  const { data: unreadCountData } = useUnreadNotificationsCount();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const { data: jobActivitiesRaw = [] } = useJobActivities();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Unified Notifications List
  const notificationsList: CeipalNotificationItem[] = useMemo(() => {
    const list: CeipalNotificationItem[] = [];

    // A. Backend Notifications
    for (const n of rawNotifications) {
      let mod: CeipalModule = 'jobs';
      if (n.link?.includes('applicant') || n.type?.includes('CANDIDATE')) mod = 'applicants';
      else if (n.link?.includes('job') || n.type?.includes('JOB')) mod = 'jobs';
      else if (n.link?.includes('eboarding')) mod = 'eboarding';
      else if (n.link?.includes('lead')) mod = 'leads';
      else if (n.link?.includes('placement') || n.link?.includes('offer')) mod = 'placements';
      else if (n.link?.includes('client')) mod = 'clients';
      else if (n.link?.includes('vendor')) mod = 'vendors';
      else if (n.link?.includes('settings')) mod = 'settings';

      list.push({
        id: n.id,
        title: n.title,
        description: n.message,
        time: n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : 'Just now',
        unread: !n.isRead,
        module: mod,
        link: n.link || undefined,
        isBackend: true,
        createdAt: n.createdAt || new Date().toISOString(),
        type: n.type,
      });
    }

    // B. Real-time recruitment activities
    for (const a of jobActivitiesRaw.slice(0, 10)) {
      const actId = `act-${a.id}`;
      const isUnread = !clearedMockIds.has(actId);
      list.push({
        id: actId,
        title:
          a.type === 'SUBMISSION'
            ? 'Candidate Submission'
            : a.type === 'STATUS_CHANGE'
              ? 'Requisition Status Updated'
              : a.type === 'TASK'
                ? 'Job Task Assigned'
                : 'Recruitment Activity',
        description: a.description,
        time: a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : 'Recently',
        unread: isUnread,
        module: 'jobs',
        link: '/recruitment?tab=jobs',
        isBackend: false,
        createdAt: a.createdAt || new Date().toISOString(),
        type: a.type,
      });
    }

    // C. Graceful fallback defaults if inbox is brand new
    if (list.length === 0) {
      const fallbackDefaults: CeipalNotificationItem[] = [
        {
          id: 'fb-1',
          title: 'New Candidate Submission',
          description: 'Alexander Wright submitted for JPC - 480 (Mechanical Engineering Design Technologist)',
          time: '5 mins ago',
          unread: !clearedMockIds.has('fb-1'),
          module: 'applicants',
          link: '/recruitment?tab=applicants',
          isBackend: false,
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: 'SUBMISSION',
        },
        {
          id: 'fb-2',
          title: 'Interview Scheduled',
          description: 'Niagara Health confirmed technical interview for Sarah Chen',
          time: '1 hour ago',
          unread: !clearedMockIds.has('fb-2'),
          module: 'applicants',
          link: '/recruitment?tab=applicants',
          isBackend: false,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          type: 'INTERVIEW',
        },
        {
          id: 'fb-3',
          title: 'eBoarding Packet Dispatched',
          description: 'New onboarding documents sent to David Miller',
          time: '3 hours ago',
          unread: !clearedMockIds.has('fb-3'),
          module: 'eboarding',
          link: '/recruitment?tab=eboarding',
          isBackend: false,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          type: 'EBOARDING',
        },
        {
          id: 'fb-4',
          title: 'Lead Follow-up Due',
          description: 'Apex Solutions requested updated staffing rate card and agreement',
          time: 'Yesterday',
          unread: !clearedMockIds.has('fb-4'),
          module: 'leads',
          link: '/recruitment?tab=leads',
          isBackend: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          type: 'LEAD',
        },
      ];
      list.push(...fallbackDefaults);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawNotifications, jobActivitiesRaw, clearedMockIds]);

  const effectiveUnreadCount = useMemo(() => {
    return notificationsList.filter((n) => n.unread).length;
  }, [notificationsList]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllNotificationsRead.mutateAsync();
    } catch {
      // ignore
    }
    setClearedMockIds(new Set(notificationsList.map((n) => n.id)));
    toast.success('All notifications marked as read');
  };

  const handleMarkSingleRead = async (e: React.MouseEvent, item: CeipalNotificationItem) => {
    e.stopPropagation();
    if (item.isBackend) {
      try {
        await markNotificationRead.mutateAsync(item.id);
      } catch {
        // ignore
      }
    } else {
      setClearedMockIds((prev) => new Set([...prev, item.id]));
    }
    toast.success('Marked as read');
  };

  const handleNotificationClick = async (item: CeipalNotificationItem) => {
    if (item.isBackend) {
      try {
        await markNotificationRead.mutateAsync(item.id);
      } catch {
        // ignore
      }
    } else {
      setClearedMockIds((prev) => new Set([...prev, item.id]));
    }
    setShowNotifications(false);

    // Deep resolution for applicant items
    if (item.module === 'applicants' || item.type === 'SUBMISSION' || item.type === 'INTERVIEW') {
      const matchName = item.description.includes('Alexander Wright')
        ? 'Alexander Wright'
        : item.description.includes('Sarah Chen')
          ? 'Sarah Chen'
          : item.title;

      let foundApplicant = customApplicants.find((a) =>
        a.name.toLowerCase().includes(matchName.toLowerCase()) || matchName.toLowerCase().includes(a.name.toLowerCase())
      );

      if (!foundApplicant) {
        // Generate or use first applicant
        foundApplicant = customApplicants[0] || {
          id: `app-${Date.now()}`,
          displayId: '10048',
          name: matchName,
          email: `${matchName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          mobile: '+1 (555) 234-5678',
          city: 'Toronto',
          state: 'ON',
          source: 'Direct Application',
          status: item.type === 'INTERVIEW' ? 'Interview' : 'Applied',
          jobTitle: 'Mechanical Engineering Design Technologist',
          owner: 'Megan Davis',
          badgeCount: 1,
          isStarred: false,
          createdAt: new Date().toISOString(),
        };
      }

      setSelectedApplicantDetail(foundApplicant);
      setSelectedJobDetail(null);
      setActiveModule('applicants');
      setIsCreatingApplicant(false);
      setIsCreatingJob(false);
      navigate({ to: '/recruitment', search: { tab: 'applicants' } });
      toast.info(`Opened profile for ${foundApplicant.name}`);
      return;
    }

    // Deep resolution for job requisition items
    if (item.module === 'jobs' || item.type === 'JOB') {
      const targetJob = jobs[0] || null;
      if (targetJob) {
        setSelectedJobDetail(targetJob);
        setSelectedApplicantDetail(null);
      }
      setActiveModule('jobs');
      setIsCreatingApplicant(false);
      setIsCreatingJob(false);
      navigate({ to: '/recruitment', search: { tab: 'jobs' } });
      toast.info(`Opened ${item.title}`);
      return;
    }

    if (item.link) {
      if (item.link.startsWith('/recruitment')) {
        const url = new URL(item.link, window.location.origin);
        const tab = url.searchParams.get('tab') as CeipalModule;
        if (tab) {
          setActiveModule(tab);
          setIsCreatingApplicant(false);
          setIsCreatingJob(false);
        }
        navigate({ to: '/recruitment', search: { tab: tab || item.module } });
      } else {
        navigate({ to: item.link as any });
      }
    } else {
      setActiveModule(item.module);
      setIsCreatingApplicant(false);
      setIsCreatingJob(false);
      navigate({ to: '/recruitment', search: { tab: item.module } });
    }
    toast.info(`Opened: ${item.title}`);
  };

  // 2. Refresh State
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['job-postings'] }),
        queryClient.invalidateQueries({ queryKey: ['candidates'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['offers'] }),
        queryClient.invalidateQueries({ queryKey: ['eboardings'] }),
      ]);
      toast.success('Recruitment records synchronized with server');
    } catch {
      toast.error('Failed to synchronize some records');
    } finally {
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  // 3. Quick Create State & Modal
  const [showQuickCreateMenu, setShowQuickCreateMenu] = useState(false);
  const [quickCreateModal, setQuickCreateModal] = useState<
    'job' | 'applicant' | 'client' | 'vendor' | 'lead' | null
  >(null);
  const [isSubmittingQuickCreate, setIsSubmittingQuickCreate] = useState(false);

  // Quick Create Form States
  const [jobForm, setJobForm] = useState({
    title: '',
    client: 'Venus Consultancy',
    location: 'Toronto, ON',
    billRate: '$85.00/hr',
    description: '',
  });

  const [applicantForm, setApplicantForm] = useState({
    name: '',
    email: '',
    phone: '',
    jobTitle: 'Software Engineer',
  });

  const [clientForm, setClientForm] = useState({
    name: '',
    industry: 'Technology',
    contactNumber: '',
    website: '',
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    category: 'Staffing Agency',
  });

  const [leadForm, setLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
  });

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingQuickCreate(true);
    try {
      if (quickCreateModal === 'job') {
        const nextNum = 500 + jobs.length + 1;
        await addJob({
          jobCode: `JPC-${nextNum}`,
          jobTitle: jobForm.title || 'Untitled Role',
          client: jobForm.client,
          businessUnit: 'Venus Consultancy',
          clientJobId: `REQ-${9000 + nextNum}`,
          location: jobForm.location,
          states: 'Ontario',
          jobStatus: 'Active',
          clientBillRate: jobForm.billRate,
          applicantsCount: 0,
          sources: ['user'],
          description: jobForm.description,
        });
        toast.success(`Job Posting "${jobForm.title}" created successfully!`);
        setActiveModule('jobs');
        setJobForm({ title: '', client: 'Venus Consultancy', location: 'Toronto, ON', billRate: '$85.00/hr', description: '' });
      } else if (quickCreateModal === 'applicant') {
        await addApplicant({
          name: applicantForm.name,
          email: applicantForm.email,
          mobile: applicantForm.phone,
          city: 'Toronto',
          state: 'ON',
          source: 'Direct Application',
          status: 'Applied',
          jobTitle: applicantForm.jobTitle,
          owner: 'Megan Davis',
          badgeCount: 0,
          isStarred: false,
          createdAt: new Date().toISOString(),
        });
        toast.success(`Applicant "${applicantForm.name}" created successfully!`);
        setActiveModule('applicants');
        setApplicantForm({ name: '', email: '', phone: '', jobTitle: 'Software Engineer' });
      } else if (quickCreateModal === 'client') {
        await addClient({
          name: clientForm.name,
          industry: clientForm.industry,
          contactNumber: clientForm.contactNumber,
          website: clientForm.website,
          status: 'Active',
          category: 'Direct Client',
          primaryOwner: 'Megan Davis',
          businessUnit: 'Venus Consultancy',
          displayOnJob: 'Yes',
          createdBy: 'Megan Davis',
          hasBadge: true,
        });
        toast.success(`Client "${clientForm.name}" created successfully!`);
        setActiveModule('clients');
        setClientForm({ name: '', industry: 'Technology', contactNumber: '', website: '' });
      } else if (quickCreateModal === 'vendor') {
        await addVendor({
          name: vendorForm.name,
          contactPerson: vendorForm.contactPerson,
          email: vendorForm.email,
          category: vendorForm.category,
          website: '',
          contactNumber: '',
          state: '',
          country: '',
          ownership: '',
          businessUnit: 'Venus Consultancy',
          createdBy: '',
          createdOn: '',
          modifiedOn: '',
          modifiedBy: '',
        });
        toast.success(`Vendor "${vendorForm.name}" created successfully!`);
        setActiveModule('vendors');
        setVendorForm({ name: '', contactPerson: '', email: '', category: 'Staffing Agency' });
      } else if (quickCreateModal === 'lead') {
        await addLead({
          name: leadForm.name,
          company: leadForm.company,
          contactNumber: leadForm.phone,
          status: 'New',
          source: 'Quick Create',
          createdBy: '',
          businessUnit: 'Venus Consultancy',
          leadAge: 'Today',
          modifiedOn: new Date().toLocaleDateString(),
          lastActivity: 'Lead Created',
          zipCode: '',
          website: '',
          createdOn: '',
        });
        toast.success(`Lead "${leadForm.name}" created successfully!`);
        setActiveModule('leads');
        setLeadForm({ name: '', company: '', email: '', phone: '' });
      }
      setQuickCreateModal(null);
    } catch {
      toast.error('Failed to create record. Please try again.');
    } finally {
      setIsSubmittingQuickCreate(false);
    }
  };

  // 4. Global Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedJobs = jobs
      .filter(
        (j) =>
          j.jobTitle.toLowerCase().includes(q) ||
          j.jobCode.toLowerCase().includes(q) ||
          j.client.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedApplicants = customApplicants
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.jobTitle.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedClients = clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q)
      )
      .slice(0, 3);

    const matchedVendors = vendors
      .filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q)
      )
      .slice(0, 3);

    const matchedLeads = leads
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company || '').toLowerCase().includes(q)
      )
      .slice(0, 3);

    const totalCount =
      matchedJobs.length +
      matchedApplicants.length +
      matchedClients.length +
      matchedVendors.length +
      matchedLeads.length;

    return {
      jobs: matchedJobs,
      applicants: matchedApplicants,
      clients: matchedClients,
      vendors: matchedVendors,
      leads: matchedLeads,
      totalCount,
    };
  }, [headerSearchQuery, jobs, customApplicants, clients, vendors, leads]);

  const navTabs: { id: CeipalModule; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'jobs', label: 'Job Posting' },
    { id: 'applicants', label: 'Applicants' },
    { id: 'clients', label: 'Client' },
    { id: 'vendors', label: 'Vendor' },
    { id: 'eboarding', label: 'eBoarding' },
    { id: 'placements', label: 'Placements' },
    { id: 'leads', label: 'Leads' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      {/* Top thin darker navy strip */}
      <div className="h-[5px] w-full" style={{ backgroundColor: '#1a2b4a' }} />

      {/* Main deep blue gradient bar with explicit background and text color */}
      <header
        className="ceipal-header-gradient relative w-full shadow-md z-40 select-none"
        style={{
          background: 'linear-gradient(90deg, #0b5ed7 0%, #1467d6 100%)',
          color: '#ffffff',
        }}
      >
        <div className="flex items-center justify-between px-4 py-2 min-h-[50px] gap-2">
          {/* Left: Red script/serif VENUS CONSULTANCY logo matching exact design */}
          <div
            className="flex items-center cursor-pointer mr-3 shrink-0"
            onClick={() => {
              setActiveModule('home');
              setIsCreatingApplicant(false);
              setIsCreatingJob(false);
              try {
                navigate({ to: '/recruitment', search: { tab: 'home' } });
              } catch {
                // fallback
              }
            }}
          >
            <div className="flex flex-col leading-tight select-none">
              <span
                className="text-[13px] font-black tracking-wider uppercase drop-shadow-xs"
                style={{ color: '#be123c' }}
              >
                VENUS
              </span>
              <span
                className="text-[9px] font-bold tracking-widest uppercase -mt-0.5"
                style={{ color: '#9f1239' }}
              >
                CONSULTANCY
              </span>
            </div>
          </div>

          {/* Center-left: Horizontal nav tabs without ugly scrollbars */}
          <nav
            className="flex items-center gap-1.5 overflow-x-auto py-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {navTabs.map((tab) => {
              const isActive = activeModule === tab.id;
              return (
                <div key={tab.id} className="relative flex flex-col items-center">
                  <button
                    onClick={() => {
                      setActiveModule(tab.id);
                      setIsCreatingApplicant(false);
                      setIsCreatingJob(false);
                      try {
                        navigate({ to: '/recruitment', search: { tab: tab.id } });
                      } catch {
                        // fallback
                      }
                    }}
                    className={`px-3.5 py-1.5 text-[13px] font-semibold tracking-wide transition-all whitespace-nowrap rounded cursor-pointer ${
                      isActive ? 'shadow-sm font-bold' : 'hover:bg-white/15'
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: '#ffffff', color: '#0b5ed7' }
                        : { backgroundColor: 'transparent', color: '#ffffff' }
                    }
                  >
                    {tab.label}
                  </button>
                  {/* Downward-pointing indicator triangle when active */}
                  {isActive && (
                    <div
                      className="absolute -bottom-[10px] w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-white z-50"
                      style={{ borderTopColor: '#ffffff' }}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right: Functional Notification, Refresh, Plus, Search */}
          <div className="flex items-center gap-2 ml-auto pl-2 shrink-0">
            {/* 1. Bell (Notifications) */}
            <div className="relative" ref={notificationDropdownRef}>
              <button
                onClick={() => {
                  setShowNotifications((prev) => !prev);
                  setShowQuickCreateMenu(false);
                }}
                title="Notifications"
                className="relative p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
                style={{ color: '#ffffff' }}
              >
                <Bell className="w-4 h-4" />
                {effectiveUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1 py-0.2 text-[9px] font-bold rounded-full ring-1 ring-white bg-[#f43f5e] text-white flex items-center justify-center leading-none animate-in zoom-in duration-150">
                    {effectiveUnreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-[400px] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-0 z-50 text-xs animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Notifications</span>
                      {effectiveUnreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                          {effectiveUnreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {effectiveUnreadCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 bg-white">
                    <button
                      onClick={() => setNotificationFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        notificationFilter === 'all'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All ({notificationsList.length})
                    </button>
                    <button
                      onClick={() => setNotificationFilter('unread')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        notificationFilter === 'unread'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Unread ({effectiveUnreadCount})
                    </button>
                  </div>

                  {/* List Container */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const displayedList =
                        notificationFilter === 'unread'
                          ? notificationsList.filter((n) => n.unread)
                          : notificationsList;

                      if (displayedList.length === 0) {
                        return (
                          <div className="px-4 py-8 text-center flex flex-col items-center gap-2 text-slate-400">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60" />
                            <p className="text-xs font-medium text-slate-600">
                              {notificationFilter === 'unread'
                                ? 'No unread notifications!'
                                : 'No notifications found.'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              You're all caught up with your recruitment updates.
                            </p>
                          </div>
                        );
                      }

                      return displayedList.map((n) => {
                        const isApp = n.type === 'SUBMISSION' || n.module === 'applicants';
                        const isInt = n.type === 'INTERVIEW';
                        const isEb = n.type === 'EBOARDING' || n.module === 'eboarding';
                        const isLead = n.module === 'leads';

                        const IconComponent = isApp
                          ? UserPlus
                          : isInt
                            ? Calendar
                            : isEb
                              ? Sparkles
                              : isLead
                                ? TrendingUp
                                : Briefcase;

                        const iconBg = isApp
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : isInt
                            ? 'bg-purple-50 text-purple-600 border-purple-200'
                            : isEb
                              ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : isLead
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200';

                        return (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 hover:bg-blue-50/60 transition-colors cursor-pointer flex gap-3 items-start group ${
                              n.unread ? 'bg-blue-50/20' : 'bg-white'
                            }`}
                          >
                            <div
                              className={`p-2 rounded-lg border ${iconBg} shrink-0 mt-0.5`}
                            >
                              <IconComponent className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1.5 mb-0.5">
                                <p className="font-bold text-slate-900 text-xs truncate leading-snug">
                                  {n.title}
                                </p>
                                {n.unread && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                                {n.description}
                              </p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {n.time}
                                </span>
                                {n.unread && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkSingleRead(e, n)}
                                    title="Mark as read"
                                    className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 font-semibold transition-opacity flex items-center gap-0.5"
                                  >
                                    <Check className="w-3 h-3" />
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-slate-200/80 text-center bg-slate-50 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        navigate({ to: '/recruitment-stream' });
                      }}
                      className="text-xs text-[#0b5ed7] font-semibold hover:underline cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <span>View All Recruitment Activities</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Refresh (RotateCcw) */}
            <button
              onClick={handleRefresh}
              title="Refresh and sync data"
              disabled={isRefreshing}
              className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
              style={{ color: '#ffffff' }}
            >
              <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* 3. Magnifying glass (Global Search) */}
            <button
              onClick={() => {
                setShowSearchModal(true);
                setShowNotifications(false);
                setShowQuickCreateMenu(false);
              }}
              title="Global Search"
              className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
              style={{ color: '#ffffff' }}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* 4. Quick Create (+) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowQuickCreateMenu((prev) => !prev);
                  setShowNotifications(false);
                  setShowSearchModal(false);
                }}
                title="Quick Create (+)"
                className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer flex items-center justify-center bg-white/10"
                style={{ color: '#ffffff' }}
              >
                <Plus className="w-4 h-4" />
              </button>

              {showQuickCreateMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                    Quick Create
                  </div>
                  <button
                    onClick={() => {
                      setQuickCreateModal('job');
                      setShowQuickCreateMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Job Posting</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateModal('applicant');
                      setShowQuickCreateMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Applicant</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateModal('client');
                      setShowQuickCreateMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Client</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateModal('lead');
                      setShowQuickCreateMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lead</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Quick Create Dialog */}
      {quickCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Quick Create{' '}
                {quickCreateModal === 'job'
                  ? 'Job Posting'
                  : quickCreateModal === 'applicant'
                  ? 'Applicant'
                  : quickCreateModal === 'client'
                  ? 'Client'
                  : quickCreateModal === 'vendor'
                  ? 'Vendor'
                  : 'Lead'}
              </h4>
              <button
                onClick={() => setQuickCreateModal(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="p-4 space-y-3 text-xs">
              {quickCreateModal === 'job' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Job Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Full Stack Engineer"
                      value={jobForm.title}
                      onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Client *</label>
                      <input
                        type="text"
                        required
                        value={jobForm.client}
                        onChange={(e) => setJobForm({ ...jobForm, client: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Bill Rate</label>
                      <input
                        type="text"
                        value={jobForm.billRate}
                        onChange={(e) => setJobForm({ ...jobForm, billRate: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Location</label>
                    <input
                      type="text"
                      value={jobForm.location}
                      onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Brief role responsibilities..."
                      value={jobForm.description}
                      onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {quickCreateModal === 'applicant' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={applicantForm.name}
                      onChange={(e) => setApplicantForm({ ...applicantForm, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="candidate@example.com"
                        value={applicantForm.email}
                        onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                      <input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        value={applicantForm.phone}
                        onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Target Job Title</label>
                    <input
                      type="text"
                      value={applicantForm.jobTitle}
                      onChange={(e) => setApplicantForm({ ...applicantForm, jobTitle: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {quickCreateModal === 'client' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Company / Client Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Health Systems"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Industry</label>
                      <input
                        type="text"
                        value={clientForm.industry}
                        onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                      <input
                        type="text"
                        value={clientForm.contactNumber}
                        onChange={(e) => setClientForm({ ...clientForm, contactNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Website</label>
                    <input
                      type="text"
                      placeholder="https://client.com"
                      value={clientForm.website}
                      onChange={(e) => setClientForm({ ...clientForm, website: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {quickCreateModal === 'vendor' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Prime Talent Solutions"
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
                      <input
                        type="text"
                        placeholder="John Miller"
                        value={vendorForm.contactPerson}
                        onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Category</label>
                      <input
                        type="text"
                        value={vendorForm.category}
                        onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="contact@vendor.com"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {quickCreateModal === 'lead' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Lead Contact Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Emily Watson"
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Company *</label>
                      <input
                        type="text"
                        required
                        placeholder="TechCorp Global"
                        value={leadForm.company}
                        onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                      <input
                        type="text"
                        placeholder="+1 (555) 012-3456"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="emily@techcorp.com"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickCreateModal(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickCreate}
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmittingQuickCreate ? 'Creating...' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Search Dialog */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden text-slate-800">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search jobs, candidates, clients, vendors, leads..."
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
              />
              {headerSearchQuery && (
                <button
                  onClick={() => setHeaderSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded bg-slate-200/60 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 text-xs max-h-96 overflow-y-auto">
              {searchResults ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                    Search Results ({searchResults.totalCount} matches)
                  </div>

                  {/* Matching Jobs */}
                  {searchResults.jobs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 uppercase px-2 py-0.5 bg-blue-50 rounded">
                        Job Postings
                      </span>
                      <div className="mt-1 space-y-1">
                        {searchResults.jobs.map((j) => (
                          <div
                            key={j.id}
                            onClick={() => {
                              setActiveModule('jobs');
                              setSearchQuery(j.jobTitle);
                              setShowSearchModal(false);
                              toast.info(`Showing Job: ${j.jobTitle}`);
                            }}
                            className="p-2 hover:bg-blue-50/80 rounded cursor-pointer flex items-center justify-between border border-transparent hover:border-blue-200 transition-all"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">
                                {j.jobCode} - {j.jobTitle}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {j.client} • {j.location} • {j.jobStatus}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Applicants */}
                  {searchResults.applicants.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase px-2 py-0.5 bg-emerald-50 rounded">
                        Applicants
                      </span>
                      <div className="mt-1 space-y-1">
                        {searchResults.applicants.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setActiveModule('applicants');
                              setSearchQuery(a.name);
                              setShowSearchModal(false);
                              toast.info(`Showing Applicant: ${a.name}`);
                            }}
                            className="p-2 hover:bg-emerald-50/80 rounded cursor-pointer flex items-center justify-between border border-transparent hover:border-emerald-200 transition-all"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{a.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {a.jobTitle} • {a.email} • {a.status}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Clients */}
                  {searchResults.clients.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-purple-700 uppercase px-2 py-0.5 bg-purple-50 rounded">
                        Clients
                      </span>
                      <div className="mt-1 space-y-1">
                        {searchResults.clients.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setActiveModule('clients');
                              setSearchQuery(c.name);
                              setShowSearchModal(false);
                              toast.info(`Showing Client: ${c.name}`);
                            }}
                            className="p-2 hover:bg-purple-50/80 rounded cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-200 transition-all"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{c.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {c.industry} • {c.status}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Vendors */}
                  {searchResults.vendors.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase px-2 py-0.5 bg-amber-50 rounded">
                        Vendors
                      </span>
                      <div className="mt-1 space-y-1">
                        {searchResults.vendors.map((v) => (
                          <div
                            key={v.id}
                            onClick={() => {
                              setActiveModule('vendors');
                              setSearchQuery(v.name);
                              setShowSearchModal(false);
                              toast.info(`Showing Vendor: ${v.name}`);
                            }}
                            className="p-2 hover:bg-amber-50/80 rounded cursor-pointer flex items-center justify-between border border-transparent hover:border-amber-200 transition-all"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{v.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {v.category} • {v.contactPerson}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Leads */}
                  {searchResults.leads.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-rose-700 uppercase px-2 py-0.5 bg-rose-50 rounded">
                        Leads
                      </span>
                      <div className="mt-1 space-y-1">
                        {searchResults.leads.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => {
                              setActiveModule('leads');
                              setSearchQuery(l.name);
                              setShowSearchModal(false);
                              toast.info(`Showing Lead: ${l.name}`);
                            }}
                            className="p-2 hover:bg-rose-50/80 rounded cursor-pointer flex items-center justify-between border border-transparent hover:border-rose-200 transition-all"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{l.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {l.company} • {l.status}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.totalCount === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No records matched "{headerSearchQuery}".
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <div className="text-slate-400 text-center py-3">
                    Type keywords to search across all jobs, candidates, clients, vendors, and leads.
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="font-semibold text-slate-600 mb-2 px-1">Quick Browse:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setActiveModule('jobs');
                          setShowSearchModal(false);
                        }}
                        className="p-2 text-left bg-slate-50 hover:bg-blue-50 rounded text-slate-700 font-medium flex items-center justify-between cursor-pointer"
                      >
                        <span>All Job Postings</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveModule('applicants');
                          setShowSearchModal(false);
                        }}
                        className="p-2 text-left bg-slate-50 hover:bg-emerald-50 rounded text-slate-700 font-medium flex items-center justify-between cursor-pointer"
                      >
                        <span>All Applicants</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveModule('clients');
                          setShowSearchModal(false);
                        }}
                        className="p-2 text-left bg-slate-50 hover:bg-purple-50 rounded text-slate-700 font-medium flex items-center justify-between cursor-pointer"
                      >
                        <span>Client Accounts</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveModule('leads');
                          setShowSearchModal(false);
                        }}
                        className="p-2 text-left bg-slate-50 hover:bg-rose-50 rounded text-slate-700 font-medium flex items-center justify-between cursor-pointer"
                      >
                        <span>Recruitment Leads</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Docked vertical blue chevron tab on far right edge of viewport */}
      <button
        onClick={toggleRightDrawer}
        title={isRightDrawerOpen ? 'Collapse side panel' : 'Expand side panel'}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 text-white py-3 px-1 rounded-l-md shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
        style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
      >
        <span className="text-xs font-bold font-mono">{isRightDrawerOpen ? '›' : '‹'}</span>
      </button>
    </>
  );
};
