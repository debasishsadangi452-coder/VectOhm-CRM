import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit,
  FileText,
  Building,
  MapPin,
  HelpCircle,
  Share2,
  Mail,
  Send,
  Plus,
  ChevronDown,
  RotateCcw,
  ExternalLink,
  Check,
  Briefcase,
  X,
  Clock,
  Tag,
  Trash2,
  Download,
  Upload,
  Copy,
  UserCheck,
  Globe,
  DollarSign,
  Users,
  Layers,
  ShieldCheck,
  CheckCircle2,
  FilePlus,
  SendHorizontal,
  Sparkles,
  Linkedin,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRetryJobBoardListing } from '@/hooks/use-recruitment';
import {
  JobPostingItem,
  JobTaskItem,
  JobActivityItem,
  JobEmailMergeItem,
  JobSubmissionItem,
  JobNoteItem,
  JobDocumentItem,
} from '../types';
import { useCeipal } from '../ceipal-context';

interface JobDetailPanelProps {
  job: JobPostingItem;
  onBack: () => void;
  onSelectJob?: (job: JobPostingItem) => void;
}

type TabKey =
  | 'snapshot'
  | 'job_details'
  | 'additional_details'
  | 'task_manager'
  | 'activities'
  | 'email_merges';

type SubmissionsFilterTab =
  | 'pipeline'
  | 'all'
  | 'client_submissions'
  | 'interviews'
  | 'confirmations'
  | 'placements'
  | 'not_joined';

type NotesTab = 'job_posting' | 'applicant_reference';

function parseSkills(skills: string[] | string | undefined | null): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof skills === 'string') return skills.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function formatSkills(skills: string[] | string | undefined | null): string {
  return parseSkills(skills).join(', ');
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({ job: propJob, onBack, onSelectJob }) => {
  const {
    jobs,
    updateJob,
    addJob,
    deleteJob,
    setActiveModule,
    customApplicants,
    jobTasks,
    addJobTask,
    deleteJobTask,
    jobActivities,
    addJobActivity,
    jobEmailMerges,
    addJobEmailMerge,
    jobSubmissions,
    addJobSubmission,
    deleteJobSubmission,
    jobNotes,
    addJobNote,
    deleteJobNote,
    jobDocuments,
    addJobDocument,
    deleteJobDocument,
    toggleJobBoardStatus,
    submitCandidateToJob,
    setSelectedJobDetail,
  } = useCeipal();

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.name === 'ADMIN';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Always keep the panel synced with the live job state in Ceipal context
  const job =
    jobs.find((j) => j.id === propJob.id) ||
    jobs.find((j) => propJob.jobCode && j.jobCode === propJob.jobCode) ||
    jobs.find((j) => propJob.jobTitle && j.jobTitle.toLowerCase() === propJob.jobTitle.toLowerCase()) ||
    propJob;
  const retryListingMutation = useRetryJobBoardListing();
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const linkedInListing = job.boardListings?.find((b) => b.board === 'LINKEDIN');

  const handleDeleteJob = async () => {
    if (!isAdmin) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting job requisition ${job.jobCode}...`);
    try {
      await deleteJob(job.id);
      toast.success(
        `Job "${job.jobTitle}" (${job.jobCode}) was permanently deleted from CRM and VenusGlobalTech website.`,
        { id: toastId }
      );
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete job posting.', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Active top tab
  const [activeTab, setActiveTab] = useState<TabKey>('snapshot');

  // Submissions state (zero mock data, persisted per job ID)
  const [submissionsTab, setSubmissionsTab] = useState<SubmissionsFilterTab>('all');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const submissionsList: JobSubmissionItem[] = (jobSubmissions[job.id] || []).filter(
    (s) => s.name !== 'Alexander Wright' && s.name !== 'Priya Sharma' && s.name !== 'Marcus Vance' && !s.id.startsWith('mock-')
  );

  // Notes state (zero mock notes)
  const [notesTab, setNotesTab] = useState<NotesTab>('job_posting');
  const notesList: JobNoteItem[] = (jobNotes[job.id] || []).filter((n) => n.id !== 'note-init');
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Documents state (zero mock documents)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentsList: JobDocumentItem[] = (jobDocuments[job.id] || []).filter((d) => d.id !== 'doc-1');

  // Tasks state from Context (persisted per job ID)
  const currentTasks: JobTaskItem[] = jobTasks[job.id] || [];
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    taskName: '',
    dueDate: '2026-09-25',
    timeZone: 'EST',
    assignedTo: job.assignedTo || 'Govardhan',
  });

  // Activities state from Context (persisted per job ID)
  const currentActivities: JobActivityItem[] = jobActivities[job.id] || [];
  const [activityTimeFilter, setActivityTimeFilter] = useState('All Time');

  // Email Merges state from Context (persisted per job ID)
  const currentEmailMerges: JobEmailMergeItem[] = jobEmailMerges[job.id] || [];
  const [showComposeMergeModal, setShowComposeMergeModal] = useState(false);
  const initialSkillsList = parseSkills(job.primarySkills);
  const [mergeForm, setMergeForm] = useState({
    sentTo: 'All Matching Candidates (3)',
    searchString: initialSkillsList.length > 0 ? `(${initialSkillsList.map((s) => s.toUpperCase()).join(') AND (')})` : `(${job.jobTitle.toUpperCase()})`,
    zipLocation: job.location || 'Ontario, Canada',
    subject: `Immediate Job Opportunity: ${job.jobCode} - ${job.jobTitle}`,
    emailDetails: `Hi {Candidate_Name},\n\nWe came across your profile and noticed your strong background in ${formatSkills(job.primarySkills) || job.jobTitle}.\n\nWe have an urgent opening with ${job.client} for ${job.jobTitle} in ${job.location}.\nRate: ${job.clientBillRate || 'Competitive'} | Tax Terms: ${job.taxTerms || 'Full Time'}\n\nPlease reply with your updated resume if interested.\n\nBest regards,\n${job.recruitmentManager || 'Venus Hiring Team'}`,
  });

  // Right Side Search Criteria State
  const defaultQuery = initialSkillsList.length > 0
    ? initialSkillsList
        .map((s) => `(${s.toUpperCase()})`)
        .join(' AND ')
    : `(${job.jobTitle.toUpperCase()})`;
  const [searchCriteriaQuery, setSearchCriteriaQuery] = useState(defaultQuery);
  const [jobTitleCriteria, setJobTitleCriteria] = useState(job.jobTitle);
  const [recentJobTitleChecked, setRecentJobTitleChecked] = useState(false);
  const [locationType, setLocationType] = useState<'radius' | 'selected'>('selected');
  const [selectedCountry, setSelectedCountry] = useState('Canada');
  const [selectedProvince, setSelectedProvince] = useState('Ontario');
  const [selectedCities, setSelectedCities] = useState<string[]>([
    job.location ? job.location.replace(/^\[|\]$/g, '') : 'Toronto Ontario',
  ]);
  const [cityInput, setCityInput] = useState('');

  // Dropdown states for header actions
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [showSubmitDropdown, setShowSubmitDropdown] = useState(false);
  const [showJobBoardsDropdown, setShowJobBoardsDropdown] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showStringBuilder, setShowStringBuilder] = useState(false);

  // Submit Candidate Modal State
  const [showSubmitCandidateModal, setShowSubmitCandidateModal] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [candidateSubmitStage, setCandidateSubmitStage] = useState<SubmissionsFilterTab>('client_submissions');
  const [candidatePayRate, setCandidatePayRate] = useState(job.payRate || '$65.00/hr');
  const [candidateBillRate, setCandidateBillRate] = useState(job.clientBillRate || '$85.00/hr');

  // Send Requirement modal
  const [showSendReqModal, setShowSendReqModal] = useState(false);
  const [sendReqForm, setSendReqForm] = useState({
    recipients: '',
    subject: `Job Requirement: ${job.jobCode} - ${job.jobTitle}`,
    message: `Hi,\n\nPlease review the following opening for ${job.jobTitle} located at ${job.location}.\nRate: ${job.clientBillRate || 'Competitive'}\nPay Rate: ${job.payRate || 'Negotiable'}\nTax Terms: ${job.taxTerms || 'Full Time'}\n\nBest regards,\n${job.recruitmentManager || 'Venus Consultancy'}`,
  });

  // Expand job description state
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Edit Job Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    jobTitle: job.jobTitle,
    client: job.client,
    businessUnit: job.businessUnit,
    clientBillRate: job.clientBillRate,
    payRate: job.payRate || '',
    budgetMin: (job.budgetMin ?? '') as number | string,
    budgetMax: (job.budgetMax ?? '') as number | string,
    currency: job.currency || 'USD',
    salaryPeriod: job.salaryPeriod || 'YEARLY',
    taxTerms: job.taxTerms || 'Full Time',
    jobType: job.jobType || 'Full Time',
    numberOfPositions: job.numberOfPositions || 1,
    primarySkills: formatSkills(job.primarySkills),
    experience: job.experience || '',
    industry: job.industry || '',
    clearance: job.clearance || 'None',
    recruitmentManager: job.recruitmentManager || '',
    assignedTo: job.assignedTo || '',
    location: job.location,
    states: job.states,
    description: job.description || '',
  });

  // Sync edit form when job changes
  useEffect(() => {
    setEditForm({
      jobTitle: job.jobTitle,
      client: job.client,
      businessUnit: job.businessUnit,
      clientBillRate: job.clientBillRate,
      payRate: job.payRate || '',
      budgetMin: (job.budgetMin ?? '') as number | string,
      budgetMax: (job.budgetMax ?? '') as number | string,
      currency: job.currency || 'USD',
      salaryPeriod: job.salaryPeriod || 'YEARLY',
      taxTerms: job.taxTerms || 'Full Time',
      jobType: job.jobType || 'Full Time',
      numberOfPositions: job.numberOfPositions || 1,
      primarySkills: formatSkills(job.primarySkills),
      experience: job.experience || '',
      industry: job.industry || '',
      clearance: job.clearance || 'None',
      recruitmentManager: job.recruitmentManager || '',
      assignedTo: job.assignedTo || '',
      location: job.location,
      states: job.states,
      description: job.description || '',
    });
    setJobTitleCriteria(job.jobTitle);
    const updatedSkills = parseSkills(job.primarySkills);
    if (updatedSkills.length > 0) {
      setSearchCriteriaQuery(
        updatedSkills
          .map((s) => `(${s.toUpperCase()})`)
          .join(' AND ')
      );
    }
  }, [job]);

  // Previous and next job navigation
  const currentIndex = jobs.findIndex((j) => j.id === job.id);
  const prevJob = currentIndex > 0 ? jobs[currentIndex - 1] : null;
  const nextJob = currentIndex >= 0 && currentIndex < jobs.length - 1 ? jobs[currentIndex + 1] : null;

  const handlePrev = () => {
    if (prevJob && onSelectJob) {
      onSelectJob(prevJob);
      toast.info(`Switched to ${prevJob.jobCode} - ${prevJob.jobTitle}`);
    }
  };

  const handleNext = () => {
    if (nextJob && onSelectJob) {
      onSelectJob(nextJob);
      toast.info(`Switched to ${nextJob.jobCode} - ${nextJob.jobTitle}`);
    }
  };

  // Document upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const author = job.owner || 'Admin';
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
    addJobDocument({
      jobId: job.id,
      name: file.name,
      addedBy: author,
      onDate: dateStr,
      type: file.name.endsWith('.pdf') ? 'PDF Document' : 'Attachment',
      size: `${Math.round(file.size / 1024)} KB`,
    });
    addJobActivity(job.id, {
      description: `Document attached: "${file.name}" by ${author}`,
      type: 'general',
      user: author,
    });
    toast.success(`Document "${file.name}" uploaded successfully!`);
    e.target.value = '';
  };

  const handleDeleteDoc = (id: string, name: string) => {
    deleteJobDocument(job.id, id);
    const author = job.owner || 'Admin';
    addJobActivity(job.id, {
      description: `Document deleted: "${name}"`,
      type: 'general',
      user: author,
    });
    toast.success(`Deleted document: ${name}`);
  };

  // Task creation handler (stored in Context)
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.taskName.trim()) return;
    addJobTask({
      jobId: job.id,
      taskName: newTaskForm.taskName.trim(),
      dueDate: newTaskForm.dueDate,
      timeZone: newTaskForm.timeZone,
      assignedTo: newTaskForm.assignedTo || job.assignedTo || 'Unassigned',
      assignedBy: job.owner || 'Admin',
      status: 'Open',
    });
    setNewTaskForm({
      taskName: '',
      dueDate: '2026-09-25',
      timeZone: 'EST',
      assignedTo: job.assignedTo || '',
    });
    setShowAddTaskModal(false);
    toast.success('Task created successfully and added to Task Manager!');
  };

  const handleDeleteTask = (id: string) => {
    deleteJobTask(id, job.id);
    toast.success('Task deleted');
  };

  // Note creation handler
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const author = job.owner || 'Admin';
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
    addJobNote({
      jobId: job.id,
      addedBy: author,
      onDate: dateStr,
      text: newNoteText.trim(),
      action: 'View / Edit',
    });
    addJobActivity(job.id, {
      description: `Note added by ${author}: "${newNoteText.trim()}"`,
      type: 'general',
      user: author,
    });
    setNewNoteText('');
    setShowAddNoteModal(false);
    toast.success('Note added successfully!');
  };

  // Candidate submission handler
  const handleCandidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateId) {
      toast.error('Please select a candidate to submit');
      return;
    }
    const cand = customApplicants.find((c) => c.id === selectedCandidateId);
    if (!cand) return;

    submitCandidateToJob(
      job.id,
      cand.id,
      cand.name,
      candidateSubmitStage,
      candidatePayRate || job.payRate || 'N/A',
      candidateBillRate || job.clientBillRate || 'N/A'
    );
    setShowSubmitCandidateModal(false);
    toast.success(`Candidate ${cand.name} successfully submitted to ${job.jobCode}!`);
  };

  // Email merge handler
  const handleSendEmailMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeForm.subject.trim() || !mergeForm.emailDetails.trim()) {
      toast.error('Please fill in subject and body');
      return;
    }
    addJobEmailMerge({
      jobId: job.id,
      sentBy: job.owner || 'Admin',
      sentTo: mergeForm.sentTo,
      searchString: mergeForm.searchString,
      zipLocation: mergeForm.zipLocation,
      subject: mergeForm.subject,
      details: mergeForm.emailDetails,
    });
    setShowComposeMergeModal(false);
    toast.success(`Email merge campaign dispatched to ${mergeForm.sentTo}!`);
  };

  // Save full job edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedFields = {
        jobTitle: editForm.jobTitle,
        client: editForm.client,
        businessUnit: editForm.businessUnit,
        clientBillRate: editForm.clientBillRate,
        payRate: editForm.payRate,
        budgetMin: editForm.budgetMin !== '' && editForm.budgetMin !== null ? Number(editForm.budgetMin) : null,
        budgetMax: editForm.budgetMax !== '' && editForm.budgetMax !== null ? Number(editForm.budgetMax) : null,
        currency: editForm.currency || 'USD',
        salaryPeriod: editForm.salaryPeriod || 'YEARLY',
        taxTerms: editForm.taxTerms,
        jobType: editForm.jobType,
        numberOfPositions: Number(editForm.numberOfPositions) || 1,
        primarySkills: editForm.primarySkills,
        experience: editForm.experience,
        industry: editForm.industry,
        clearance: editForm.clearance,
        recruitmentManager: editForm.recruitmentManager,
        assignedTo: editForm.assignedTo,
        location: editForm.location,
        states: editForm.states,
        description: editForm.description,
      };
      await updateJob(job.id, updatedFields);
      if (onSelectJob) {
        onSelectJob({ ...job, ...updatedFields });
      }
      addJobActivity(job.id, {
        description: `Job details and compensation modified by ${job.owner || 'Govardhan'}`,
        type: 'general',
        user: job.owner || 'Govardhan',
      });
    } catch {
      toast.error('Could not save job details. Please try again.');
      return;
    }
    setIsEditing(false);
    toast.success('Job details updated and synchronized across all panels!');
  };

  // Send Requirement modal dispatch
  const handleSendRequirements = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendReqForm.recipients.trim()) {
      toast.error('Please enter recipient email addresses');
      return;
    }
    addJobActivity(job.id, {
      description: `Job requirement broadcast dispatched to ${sendReqForm.recipients}`,
      type: 'broadcast',
      user: job.owner || 'Govardhan',
    });
    toast.success(`Requirement email dispatched to ${sendReqForm.recipients}!`);
    setShowSendReqModal(false);
  };

  // Clone Job
  const handleCloneJob = async () => {
    const newCode = `JPC - ${Math.floor(500 + Math.random() * 499)}`;
    const cloned = await addJob({
      jobCode: newCode,
      jobTitle: `${job.jobTitle} (Copy)`,
      client: job.client,
      businessUnit: job.businessUnit,
      clientBillRate: job.clientBillRate,
      payRate: job.payRate,
      taxTerms: job.taxTerms,
      jobType: job.jobType,
      numberOfPositions: job.numberOfPositions,
      primarySkills: job.primarySkills,
      experience: job.experience,
      industry: job.industry,
      clearance: job.clearance,
      recruitmentManager: job.recruitmentManager,
      assignedTo: job.assignedTo,
      location: job.location,
      states: job.states,
      jobStatus: 'Draft',
      description: job.description,
    });
    if (onSelectJob) {
      onSelectJob(cloned);
    }
    toast.success(`Job cloned successfully as ${newCode}!`);
  };

  // Copy shareable summary
  const handleCopyLink = () => {
    const summary = [
      `Job Requirement: ${job.jobCode} - ${job.jobTitle}`,
      `Client: ${job.client || 'Venus Consulting'}`,
      `Location: ${job.location}, ${job.states}`,
      `Bill Rate: ${job.clientBillRate || 'N/A'} | Pay Rate: ${job.payRate || 'N/A'}`,
      `Tax Terms: ${job.taxTerms || 'Full Time'} | Experience: ${job.experience || '3-5 yrs'}`,
      `Primary Skills: ${formatSkills(job.primarySkills) || 'N/A'}`,
      `Portal Link: ${window.location.origin}/#job=${job.jobCode}`,
    ].join('\n');

    navigator.clipboard.writeText(summary);
    toast.success('Job details and portal URL copied to clipboard!');
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setShowStatusDropdown(false);
    try {
      await updateJob(job.id, { jobStatus: newStatus });
      if (onSelectJob) {
        onSelectJob({ ...job, jobStatus: newStatus });
      }
    } catch {
      toast.error('Could not update job status. Please try again.');
      return;
    }
    toast.success(`Job status changed to ${newStatus}`);
  };

  const toggleTag = (t: string) => {
    const currentTags = job.tags || ['Urgent', 'Direct Client'];
    const updated = currentTags.includes(t)
      ? currentTags.filter((item) => item !== t)
      : [...currentTags, t];
    updateJob(job.id, { tags: updated });
    toast.info(`Tag "${t}" ${updated.includes(t) ? 'added' : 'removed'}`);
  };

  const handleInsertBoolean = (op: string) => {
    setSearchCriteriaQuery((prev) => `${prev} ${op} `);
    setShowStringBuilder(false);
    toast.info(`Added ${op} to search string`);
  };

  const handleAddCity = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && cityInput.trim()) {
      e.preventDefault();
      if (!selectedCities.includes(cityInput.trim())) {
        setSelectedCities([...selectedCities, cityInput.trim()]);
      }
      setCityInput('');
    }
  };

  const removeCity = (city: string) => {
    setSelectedCities(selectedCities.filter((c) => c !== city));
  };

  const locationDisplay = job.location.replace(/^\[|\]$/g, '');
  const boardStatus = job.boardStatus || {
    linkedin: true,
    indeed: true,
    ziprecruiter: false,
    glassdoor: false,
  };

  // Filter activities based on selection
  const filteredActivities = currentActivities.filter((a) => {
    if (activityTimeFilter === 'All Time') return true;
    return true;
  });

  // Calculate real matching candidate count from applicant talent pool (zero fake numbers)
  const matchingApplicantsCount = useMemo(() => {
    const jobSkills = parseSkills(job.primarySkills).map((s) => s.toLowerCase());
    const titleWords = (job.jobTitle || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (jobSkills.length === 0 && titleWords.length === 0) return 0;
    return customApplicants.filter((c) => {
      if (!c) return false;
      const cSkills = (Array.isArray(c.skills) ? c.skills : (c.skills || '').split(',')).map((s: string) => s.trim().toLowerCase());
      const cTitle = (c.jobTitle || (c as any).currentTitle || '').toLowerCase();
      const hasSkillMatch = jobSkills.some((js) => cSkills.some((cs) => cs.includes(js) || js.includes(cs)));
      const hasTitleMatch = titleWords.some((w) => cTitle.includes(w));
      return hasSkillMatch || hasTitleMatch;
    }).length;
  }, [job.primarySkills, job.jobTitle, customApplicants]);

  return (
    <div className="flex flex-col flex-1 bg-[#eef1f6] min-h-screen text-slate-800 antialiased font-sans">
      {/* 1. Sub-Header Navigation Bar matching UI mockup */}
      <div className="bg-white border-b border-[#cbd5e1] px-4 py-1.5 flex items-center justify-between shadow-2xs">
        {/* Left Tabs: Snapshot, Job Details, Additional Details, Task Manager, Activities, Email Merges */}
        <div className="flex items-center gap-6 text-[13px] font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('snapshot')}
            className={`pb-1 transition-colors relative cursor-pointer ${
              activeTab === 'snapshot'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            Snapshot
          </button>
          <button
            onClick={() => setActiveTab('job_details')}
            className={`pb-1 transition-colors relative cursor-pointer ${
              activeTab === 'job_details'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            Job Details
          </button>
          <button
            onClick={() => setActiveTab('additional_details')}
            className={`pb-1 transition-colors relative cursor-pointer ${
              activeTab === 'additional_details'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            Additional Details
          </button>
          <button
            onClick={() => setActiveTab('task_manager')}
            className={`pb-1 transition-colors relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'task_manager'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            <span>Task Manager</span>
            {currentTasks.length > 0 && (
              <span className="bg-blue-100 text-[#0b5ed7] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {currentTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`pb-1 transition-colors relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'activities'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            <span>Activities</span>
            {currentActivities.length > 0 && (
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {currentActivities.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('email_merges')}
            className={`pb-1 transition-colors relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'email_merges'
                ? 'text-[#0b5ed7] font-semibold border-b-2 border-[#0b5ed7]'
                : 'hover:text-slate-900'
            }`}
          >
            <span>Email Merges</span>
            {currentEmailMerges.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {currentEmailMerges.length}
              </span>
            )}
          </button>
        </div>

        {/* Right action icons & buttons */}
        <div className="flex items-center gap-2">
          {/* Tags dropdown */}
          <div className="relative">
            <button
              title="Job Tags"
              onClick={() => setShowTagsDropdown(!showTagsDropdown)}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center gap-0.5 cursor-pointer border border-transparent hover:border-slate-200"
            >
              <Tag className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showTagsDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded shadow-lg z-30 py-1 text-xs text-slate-700 animate-in fade-in">
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  Manage Tags
                </div>
                {['Urgent', 'Direct Client', 'Exclusive', 'Hot Req', 'C2C Only', 'Remote Friendly'].map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{t}</span>
                    {(job.tags || ['Urgent', 'Direct Client']).includes(t) && (
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send requirement icon button */}
          <button
            title="Dispatch Job Requirement"
            onClick={() => setShowSendReqModal(true)}
            className="p-1.5 text-slate-600 hover:text-[#0b5ed7] hover:bg-slate-100 rounded cursor-pointer border border-transparent hover:border-slate-200"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* Submit candidate button */}
          <div className="relative">
            <button
              onClick={() => setShowSubmitDropdown(!showSubmitDropdown)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Submit</span>
              <ChevronDown className="w-3 h-3 text-white/80" />
            </button>
            {showSubmitDropdown && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg z-30 py-1 text-xs text-slate-700 animate-in fade-in">
                <button
                  onClick={() => {
                    setShowSubmitDropdown(false);
                    setShowSubmitCandidateModal(true);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold text-blue-600 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Submit Candidate to Job
                </button>
                <div className="border-t border-slate-100 my-0.5" />
                <button
                  onClick={() => {
                    addJobActivity(job.id, {
                      description: `Active pipeline submitted to client manager at ${job.client}`,
                      type: 'submission',
                      user: job.owner || 'Govardhan',
                    });
                    toast.success(`Pipeline for ${job.jobCode} submitted to client ${job.client}!`);
                    setShowSubmitDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
                >
                  Submit Active Pipeline to Client
                </button>
                <button
                  onClick={() => {
                    addJobActivity(job.id, {
                      description: 'Candidate profiles routed to Internal Talent Screening review',
                      type: 'submission',
                      user: job.owner || 'Govardhan',
                    });
                    toast.success('Candidate profiles routed to Internal Review');
                    setShowSubmitDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
                >
                  Route to Internal Review
                </button>
              </div>
            )}
          </div>

          {/* Job Boards syndication button */}
          <div className="relative">
            <button
              onClick={() => setShowJobBoardsDropdown(!showJobBoardsDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Job Boards</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showJobBoardsDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded shadow-lg z-30 py-1 text-xs text-slate-700 animate-in fade-in">
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  Syndication Platforms
                </div>
                {[
                  { key: 'linkedin', label: 'LinkedIn Jobs' },
                  { key: 'indeed', label: 'Indeed' },
                  { key: 'ziprecruiter', label: 'ZipRecruiter' },
                  { key: 'glassdoor', label: 'Glassdoor' },
                ].map((b) => {
                  const isActive = (boardStatus as any)[b.key] === true;
                  return (
                    <button
                      key={b.key}
                      onClick={() => {
                        toggleJobBoardStatus(job.id, b.key as any);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{b.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Published' : 'Disabled'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* View on Public Careers Page */}
          <a
            href={`/careers/${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Public Candidate View in new tab"
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 hover:bg-indigo-50/70 text-indigo-700 rounded text-xs font-semibold shadow-2xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
            <span>Public Page</span>
          </a>

          {/* LinkedIn Live Post / Direct Publish */}
          {linkedInListing?.externalUrl && !linkedInListing.simulated ? (
            <a
              href={linkedInListing.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the live post on your connected LinkedIn feed"
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0a66c2] hover:bg-[#004182] text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5 fill-current" />
              <span>LinkedIn Post ↗</span>
            </a>
          ) : (
            <button
              disabled={isPostingToLinkedIn}
              onClick={async () => {
                setIsPostingToLinkedIn(true);
                let targetJobId = job.id;
                try {
                  toast.loading("Publishing job opening to connected LinkedIn account...", { id: "linkedin-post" });

                  // Resolve real DB job ID from context jobs or auto-persist if it's a client mock job
                  const matchedLiveJob =
                    jobs.find((j) => j.id === job.id && !j.id.startsWith("job-")) ||
                    jobs.find((j) => job.jobCode && j.jobCode === job.jobCode && !j.id.startsWith("job-")) ||
                    jobs.find((j) => job.jobTitle && j.jobTitle.toLowerCase() === job.jobTitle.toLowerCase() && !j.id.startsWith("job-"));

                  if (matchedLiveJob) {
                    targetJobId = matchedLiveJob.id;
                  } else if (targetJobId.startsWith("job-") || !targetJobId.includes("-") || targetJobId.length < 20) {
                    // Local mock requisition not yet in database -- create it so it receives a permanent DB UUID
                    const created = await addJob({
                      jobTitle: job.jobTitle,
                      client: job.client,
                      businessUnit: job.businessUnit,
                      clientBillRate: job.clientBillRate,
                      payRate: job.payRate,
                      taxTerms: job.taxTerms,
                      jobType: job.jobType,
                      numberOfPositions: job.numberOfPositions,
                      primarySkills: job.primarySkills,
                      experience: job.experience,
                      industry: job.industry,
                      clearance: job.clearance,
                      recruitmentManager: job.recruitmentManager,
                      assignedTo: job.assignedTo,
                      location: job.location,
                      states: job.states,
                      description: job.description,
                      jobStatus: job.jobStatus || "Active",
                    });
                    if (created?.id) {
                      targetJobId = created.id;
                      if (setSelectedJobDetail) {
                        setSelectedJobDetail(created);
                      }
                    }
                  }

                  const res = await retryListingMutation.mutateAsync({ jobPostingId: targetJobId, board: "LINKEDIN" as any });
                  if (res && (res as any).status === "FAILED") {
                    throw new Error((res as any).errorMessage || "Failed to publish to LinkedIn.");
                  }
                  if (res && setSelectedJobDetail) {
                    setSelectedJobDetail({
                      ...job,
                      boardListings: [
                        ...(job.boardListings || []).filter((b) => b.board !== "LINKEDIN"),
                        res,
                      ],
                    });
                  }
                  toast.success("Job opening successfully published live to your LinkedIn feed!", { id: "linkedin-post" });
                } catch (err: any) {
                  const errorMsg = err?.message || "Failed to publish to LinkedIn. Check connection.";
                  const applyUrl = `${window.location.origin}/careers/${targetJobId}?source=linkedin`;
                  const copyText = `🚀 WE ARE HIRING: ${job.jobTitle.toUpperCase()} [${job.jobCode || 'REQ'}] 🚀\n\nVenus Consultancy is actively seeking a qualified ${job.jobTitle} to join our team!\n\n📍 Location: ${job.location || 'Remote'}\n💼 Type: ${job.jobType || 'Full Time'}\n💰 Pay Rate: ${job.payRate || 'Competitive'}\n\n👉 Apply directly here:\n${applyUrl}\n\n#Hiring #Careers #JobOpening`;
                  navigator.clipboard.writeText(copyText);
                  toast.error(`${errorMsg} (Full post & apply link copied to your clipboard as instant fallback)`, { id: "linkedin-post", duration: 6000 });
                } finally {
                  setIsPostingToLinkedIn(false);
                }
              }}
              title="Publish job post announcement to connected LinkedIn profile via Unipile"
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0a66c2] hover:bg-[#004182] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <Linkedin className="w-3.5 h-3.5 fill-current" />
              <span>{isPostingToLinkedIn ? "Posting..." : "Post to LinkedIn"}</span>
            </button>
          )}

          {/* ✨ Copilot Viral Hiring Post */}
          <button
            onClick={() => {
              const skillsList = Array.isArray(job.primarySkills)
                ? job.primarySkills
                : typeof job.primarySkills === "string"
                  ? job.primarySkills.split(",")
                  : [];
              const formattedSkills = skillsList.length > 0
                ? skillsList.map((s: string) => `• ${s.trim()}`).join("\n")
                : "• Relevant technical expertise";
              const text = `🚀 WE ARE HIRING! 🚀\n\nWe are looking for an exceptional ${job.jobTitle} to join our team!\n\n📍 Location: ${job.location || 'Remote'}\n💼 Type: ${job.jobType || 'Full Time'}\n\nKey Requirements:\n${formattedSkills}\n\n📌 Apply directly through our official Venus Careers portal:\n${window.location.origin}/careers/${job.id}\n\n#Hiring #Careers #JobOpening`;
              navigator.clipboard.writeText(text);
              toast.success("Copied viral hiring post with career portal link! Ready to paste into LinkedIn or Indeed.");
            }}
            title="Generate & copy viral hiring post for LinkedIn / Job Boards"
            className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Post</span>
          </button>

          {/* Share button */}
          <button
            onClick={handleCopyLink}
            title="Copy Job Summary and URL"
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Share</span>
          </button>

          {/* Admin-only Delete Requisition */}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              title="Permanently delete job requisition from CRM and VenusGlobalTech website (Admin Only)"
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main 2-Column Content Area */}
      <div className="flex-1 p-3 flex gap-3 overflow-hidden">
        {/* LEFT COLUMN: Main Job Summary, Submissions, Notes (70% width) */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
          {/* Top Job Banner Card */}
          <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
            {/* Header line: Back Arrow, Gear, Title, Magnifier, Mic, Active badge, Navigation arrows */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <button
                  onClick={onBack}
                  title="Back to Job Postings list"
                  className="mt-0.5 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                      {job.jobCode} - {job.jobTitle}
                    </h2>
                    <Search
                      onClick={() => toast.info(`Requisition search ID: ${job.jobCode}`)}
                      className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-blue-600"
                    />
                  </div>

                  {/* Subline: Business Unit / Client | Location */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                    <span className="text-[#0b5ed7] font-medium flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {job.businessUnit} | {job.client}
                    </span>
                    <span>|</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-500" />
                      {locationDisplay}, {job.states}
                    </span>
                  </div>

                  {/* Assigned To */}
                  <div className="mt-1 text-xs text-slate-500">
                    Assigned Recruiter :{' '}
                    <span className="text-slate-800 font-semibold">
                      {job.assignedTo || 'Unassigned'}
                    </span>
                  </div>

                  {/* Links: Edit Job | Matching Applicants | Delete Job (Admin) */}
                  <div className="flex items-center gap-3 mt-2 text-xs font-semibold">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-[#0b5ed7] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Edit Job
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => {
                        setActiveModule('applicants');
                        toast.info(`Showing candidates matching "${job.jobTitle}"`);
                      }}
                      className="text-[#0b5ed7] hover:underline cursor-pointer"
                    >
                      Matching Applicants{' '}
                      <span className="text-slate-600 font-normal">
                        {matchingApplicantsCount}
                      </span>
                    </button>
                    {isAdmin && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Job
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Right: Active status pill + Prev/Next chevron navigations */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className={`px-2.5 py-0.5 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors ${
                      job.jobStatus === 'Closed'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : job.jobStatus === 'Hold'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : job.jobStatus === 'Draft'
                        ? 'bg-slate-600 hover:bg-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <span>{job.jobStatus || 'Active'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 rounded shadow-lg z-30 py-1 text-xs text-slate-700 animate-in fade-in">
                      {['Active', 'Hold', 'Draft', 'Closed'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusUpdate(st)}
                          className="w-full text-left px-3 py-1 hover:bg-slate-50 font-medium cursor-pointer"
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center text-slate-400">
                  <button
                    onClick={handlePrev}
                    disabled={!prevJob}
                    title={prevJob ? `Previous Job: ${prevJob.jobCode}` : 'No previous job'}
                    className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!nextJob}
                    title={nextJob ? `Next Job: ${nextJob.jobCode}` : 'No next job'}
                    className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-[#e2e6ec] my-0.5" />

            {/* 5 Real Information Columns */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">Recruitment Manager</span>
                <span className="font-semibold text-slate-800">
                  {job.recruitmentManager || 'Unassigned'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5 flex items-center gap-1">
                  Client Bill Rate <HelpCircle className="w-3 h-3 text-blue-500" />
                </span>
                <span className="font-semibold text-slate-800">
                  {job.clientBillRate || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5 flex items-center gap-1">
                  Pay Rate / Salary <HelpCircle className="w-3 h-3 text-blue-500" />
                </span>
                <span className="font-semibold text-slate-800 text-emerald-700">
                  {job.payRate || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">Created By & On</span>
                <span className="font-semibold text-slate-800 block">{job.owner || 'Admin'}</span>
                <span className="text-slate-500 text-[10px]">
                  On {job.createdAt || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">Business Unit</span>
                <span className="font-semibold text-slate-800">{job.businessUnit || 'N/A'}</span>
              </div>
            </div>

            {/* Job Description section */}
            <div className="mt-1 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                <span>Job Description</span>
                <FileText className="w-3 h-3 text-blue-500" />
              </div>

              <div
                className={`text-slate-600 leading-relaxed ${
                  !isDescExpanded ? 'line-clamp-2' : ''
                }`}
              >
                {job.description || 'No job description provided.'}
              </div>

              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="text-[#0b5ed7] font-semibold text-[11px] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  {isDescExpanded ? 'Less ▴' : 'More ▾'}
                </button>

                <button
                  onClick={() => {
                    handleCopyLink();
                  }}
                  className="px-2 py-0.5 bg-[#84cc16] hover:bg-[#65a30d] text-white text-[11px] font-bold rounded shadow-2xs transition-colors cursor-pointer"
                >
                  Copy Public Job Link
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: SNAPSHOT */}
          {activeTab === 'snapshot' && (
            <>
              {/* Submissions Section Card */}
              <div className="bg-white rounded border border-[#cbd5e1] p-3 shadow-2xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-900">Submissions</h3>
                    <button
                      onClick={() => setShowSubmitCandidateModal(true)}
                      className="px-2 py-0.5 bg-[#0b5ed7] hover:bg-[#1467d6] text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Submit Candidate
                    </button>
                  </div>

                  {/* Submissions Tabs Filter Row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Search input with icon */}
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Search candidate"
                        value={submissionSearch}
                        onChange={(e) => setSubmissionSearch(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-l focus:outline-none focus:border-blue-500 w-28 sm:w-36"
                      />
                      <button className="bg-[#0b5ed7] text-white px-2 py-1 rounded-r flex items-center justify-center">
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Filter Pills */}
                    {(
                      [
                        { key: 'pipeline', label: 'Pipeline' },
                        { key: 'all', label: 'All' },
                        { key: 'client_submissions', label: 'Client Submissions' },
                        { key: 'interviews', label: 'Interviews' },
                        { key: 'confirmations', label: 'Confirmations' },
                        { key: 'placements', label: 'Placements' },
                      ] as const
                    ).map((pill) => {
                      const count =
                        pill.key === 'all'
                          ? submissionsList.length
                          : submissionsList.filter((s) => s.status === pill.key).length;
                      return (
                        <button
                          key={pill.key}
                          onClick={() => setSubmissionsTab(pill.key)}
                          className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                            submissionsTab === pill.key
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {pill.label} <span className="font-bold">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                      <tr>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">NAME</th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">
                          SUBMITTED BY/ON
                        </th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">
                          CONTACT/LOCATION
                        </th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">
                          PAY RATE / BILL RATE
                        </th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">STATUS</th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {submissionsList
                        .filter((sub) => {
                          if (submissionsTab !== 'all' && sub.status !== submissionsTab) return false;
                          if (
                            submissionSearch &&
                            !sub.name.toLowerCase().includes(submissionSearch.toLowerCase()) &&
                            !sub.contact.toLowerCase().includes(submissionSearch.toLowerCase()) &&
                            !sub.location.toLowerCase().includes(submissionSearch.toLowerCase())
                          ) {
                            return false;
                          }
                          return true;
                        })
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800 font-bold">
                              <span
                                onClick={() => {
                                  setActiveModule('applicants');
                                  toast.info(`Opening candidate profile for ${s.name}`);
                                }}
                                className="text-[#0b5ed7] hover:underline cursor-pointer"
                              >
                                {s.name}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <span className="font-semibold">{s.submittedBy}</span>
                              <span className="text-slate-400 block text-[10px]">{s.submittedOn}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <div>{s.contact}</div>
                              <div className="text-slate-400 text-[10px]">{s.location}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <div className="font-semibold text-emerald-700">{s.payRate}</div>
                              <div className="text-slate-400 text-[10px]">Bill: {s.billRate}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {s.statusLabel}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => {
                                  deleteJobSubmission(job.id, s.id);
                                  toast.success(`Removed submission for ${s.name}`);
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                title="Remove submission"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {submissionsList.filter((sub) => {
                        if (submissionsTab !== 'all' && sub.status !== submissionsTab) return false;
                        if (
                          submissionSearch &&
                          !sub.name.toLowerCase().includes(submissionSearch.toLowerCase()) &&
                          !sub.contact.toLowerCase().includes(submissionSearch.toLowerCase()) &&
                          !sub.location.toLowerCase().includes(submissionSearch.toLowerCase())
                        ) {
                          return false;
                        }
                        return true;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-normal">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <Users className="w-6 h-6 text-slate-300" />
                              <span className="font-medium text-slate-600">No candidate submissions found</span>
                              <span className="text-[11px] text-slate-400">
                                Click &quot;+ Submit Candidate&quot; above to submit candidates from your talent pool.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes Section Card */}
              <div className="bg-white rounded border border-[#cbd5e1] p-3 shadow-2xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-900">Notes</h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setNotesTab('job_posting')}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors cursor-pointer ${
                          notesTab === 'job_posting'
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Job Posting <span className="font-bold">{notesList.length}</span>
                      </button>
                      <button
                        onClick={() => setNotesTab('applicant_reference')}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors cursor-pointer ${
                          notesTab === 'applicant_reference'
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Applicant Reference <span className="font-bold">0</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddNoteModal(true)}
                      className="px-2.5 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white text-xs font-bold rounded flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Note
                    </button>
                  </div>
                </div>

                <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                      <tr>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider w-1/4">
                          ADDED BY / ON
                        </th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider w-1/2">
                          NOTES / DESCRIPTION
                        </th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider w-1/4 text-right">
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {notesList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 font-normal">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <FileText className="w-6 h-6 text-slate-300" />
                              <span className="font-medium text-slate-600">No notes recorded yet</span>
                              <span className="text-[11px] text-slate-400">
                                Click &quot;+ Add Note&quot; to log client updates, recruiter notes, or requisition instructions.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        notesList.map((n) => (
                          <tr key={n.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-700 font-medium">
                              {n.addedBy} <br />
                              <span className="text-[10px] text-slate-400 font-normal">{n.onDate}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-800">{n.text}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => {
                                  deleteJobNote(job.id, n.id);
                                  toast.success('Note deleted');
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Documents Section Card */}
              <div className="bg-white rounded border border-[#cbd5e1] p-3 shadow-2xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Documents</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white text-xs font-bold rounded flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Upload Document
                    </button>
                  </div>
                </div>
                <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                      <tr>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">DOCUMENT NAME</th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">ADDED BY / ON</th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider">TYPE</th>
                        <th className="px-3 py-2 uppercase text-[11px] tracking-wider text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {documentsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-normal">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <FilePlus className="w-6 h-6 text-slate-300" />
                              <span className="font-medium text-slate-600">No documents attached</span>
                              <span className="text-[11px] text-slate-400">
                                Click &quot;+ Upload Document&quot; to upload job specifications, candidate agreements, or attachments.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        documentsList.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800 font-medium flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              <span>{doc.name}</span>
                              {doc.size && <span className="text-[10px] text-slate-400">({doc.size})</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <span>{doc.addedBy}</span>
                              <span className="text-slate-400 text-[10px] block">{doc.onDate}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-medium">{doc.type}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => toast.success(`Downloading ${doc.name}...`)}
                                  className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id, doc.name)}
                                  className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: JOB DETAILS */}
          {activeTab === 'job_details' && (
            <>
              {/* Card 1: Job Details */}
              <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-600" /> Job Details
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    title="Edit Job Details"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Job Type</span>
                    <span className="font-semibold text-slate-800">{job.jobType || 'Full Time'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Tax Terms</span>
                    <span className="font-semibold text-slate-800">{job.taxTerms || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Client Bill Rate</span>
                    <span className="font-semibold text-slate-800">{job.clientBillRate || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Target Pay Rate</span>
                    <span className="font-semibold text-emerald-700">{job.payRate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Number of Positions</span>
                    <span className="font-semibold text-slate-800">{job.numberOfPositions || 1}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Client Job ID</span>
                    <span className="font-semibold text-slate-800">{job.clientJobId || job.jobCode}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Client</span>
                    <span className="font-semibold text-blue-600">{job.client || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Business Unit</span>
                    <span className="font-semibold text-slate-800">{job.businessUnit || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Job Location</span>
                    <span className="font-semibold text-slate-800">{locationDisplay || 'Not specified'}{job.states ? `, ${job.states}` : ''}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Clearance</span>
                    <span className="font-semibold text-slate-800">{job.clearance || 'None Required'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Career Portal Posting</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded">
                      ACTIVE ON PORTAL
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Created Date</span>
                    <span className="font-semibold text-slate-800">{job.createdAt || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Skills & Qualifications */}
              <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Skills & Qualifications
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Primary Skills</span>
                    <span className="font-semibold text-blue-700">
                      {formatSkills(job.primarySkills) || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Minimum Experience</span>
                    <span className="font-semibold text-slate-800">{job.experience || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Industry Domain</span>
                    <span className="font-semibold text-slate-800">{job.industry || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Team & Assignments */}
              <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" /> Team & Assignments
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Recruitment Manager</span>
                    <span className="font-semibold text-slate-800">
                      {job.recruitmentManager || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Assigned Recruiter</span>
                    <span className="font-semibold text-slate-800">
                      {job.assignedTo || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Account / Client Manager</span>
                    <span className="font-semibold text-slate-800">{job.client || 'Unassigned'}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: ADDITIONAL DETAILS */}
          {activeTab === 'additional_details' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" /> Operational & Additional Details
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Operational Info
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded">
                    <span className="text-slate-400 block text-[11px] mb-1">Requisition Code</span>
                    <span className="font-bold text-slate-800 text-sm">{job.jobCode}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded">
                    <span className="text-slate-400 block text-[11px] mb-1">Client Job ID</span>
                    <span className="font-bold text-slate-800 text-sm">{job.clientJobId || job.jobCode}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded">
                    <span className="text-slate-400 block text-[11px] mb-1">Open Positions</span>
                    <span className="font-bold text-slate-800 text-sm">{job.numberOfPositions || 1} Openings</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Tax Terms</span>
                    <span className="font-semibold text-slate-800">{job.taxTerms || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Employment Type</span>
                    <span className="font-semibold text-slate-800">{job.jobType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Clearance Requirement</span>
                    <span className="font-semibold text-slate-800">{job.clearance || 'None'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Recruitment Manager</span>
                    <span className="font-semibold text-slate-800">{job.recruitmentManager || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Assigned Recruiter</span>
                    <span className="font-semibold text-slate-800">{job.assignedTo || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Industry</span>
                    <span className="font-semibold text-slate-800">{job.industry || 'Not specified'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Client Bill Rate</span>
                    <span className="font-semibold text-slate-800">{job.clientBillRate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Target Pay Rate</span>
                    <span className="font-semibold text-emerald-700">{job.payRate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Syndication Status</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${boardStatus.linkedin ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-slate-600 font-medium">
                        {boardStatus.linkedin ? 'LinkedIn Active' : 'Unpublished'}
                      </span>
                      {linkedInListing?.externalUrl && !linkedInListing.simulated && (
                        <a
                          href={linkedInListing.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 text-[11px] text-[#0a66c2] hover:text-[#004182] font-semibold underline inline-flex items-center gap-0.5"
                          title="Open live post on LinkedIn"
                        >
                          View Live ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TASK MANAGER */}
          {activeTab === 'task_manager' && (
            <div className="bg-white rounded border border-[#cbd5e1] p-3 shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Task Manager</h3>
                  <p className="text-[11px] text-slate-500">
                    Follow-ups, client interviews, and recruiter actions tied to {job.jobCode}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-2.5 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white text-xs font-bold rounded flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>
              </div>

              <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                    <tr>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">TASK NAME</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">DUE DATE</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">TIME ZONE</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">ASSIGNED TO</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">ASSIGNED BY</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">CREATED ON</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {currentTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 italic font-normal">
                          No tasks scheduled for this job posting yet. Click "+ Add Task" to schedule recruiter tasks.
                        </td>
                      </tr>
                    ) : (
                      currentTasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-800 font-semibold">{t.taskName}</td>
                          <td className="px-3 py-2 text-slate-600 font-medium">{t.dueDate}</td>
                          <td className="px-3 py-2 text-slate-500">{t.timeZone}</td>
                          <td className="px-3 py-2 text-slate-700">{t.assignedTo}</td>
                          <td className="px-3 py-2 text-slate-700">{t.assignedBy}</td>
                          <td className="px-3 py-2 text-slate-500">{t.createdOn}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITIES */}
          {activeTab === 'activities' && (
            <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Activities & Audit Log</h3>
                  <p className="text-[11px] text-slate-500">
                    Real chronological events recorded for requisition {job.jobCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={activityTimeFilter}
                    onChange={(e) => setActivityTimeFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded text-slate-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="All Time">All Time</option>
                    <option value="Last 1 Month">Last 1 Month</option>
                    <option value="Last 3 Months">Last 3 Months</option>
                    <option value="Last 6 Months">Last 6 Months</option>
                  </select>
                </div>
              </div>

              <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                    <tr>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider w-1/4">
                        DATE & TIME
                      </th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">
                        EVENT DESCRIPTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-[11px]">
                    {filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-slate-400 italic">
                          No activity recorded yet for this job posting.
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((act) => (
                        <tr key={act.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap flex items-center gap-1.5 font-mono">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            {act.timestamp}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {act.user && (
                              <span className="font-semibold text-slate-800 block text-xs">
                                By {act.user}
                              </span>
                            )}
                            <p className="mt-0.5 text-slate-600">{act.description}</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: EMAIL MERGES */}
          {activeTab === 'email_merges' && (
            <div className="bg-white rounded border border-[#cbd5e1] p-4 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Email Merges & Outreach</h3>
                  <p className="text-[11px] text-slate-500">
                    Targeted email broadcasts dispatched to candidates matching {job.jobCode}
                  </p>
                </div>
                <button
                  onClick={() => setShowComposeMergeModal(true)}
                  className="px-2.5 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <SendHorizontal className="w-3.5 h-3.5" /> Compose Email Merge
                </button>
              </div>

              <div className="border border-[#cbd5e1] rounded overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#e9eff6] text-slate-700 font-bold border-b border-[#cbd5e1]">
                    <tr>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">SENT BY / ON</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">SENT TO</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">SEARCH STRING</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">LOCATION</th>
                      <th className="px-3 py-2 uppercase text-[11px] tracking-wider">SUBJECT</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {currentEmailMerges.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                          No email merges sent for this job yet. Click "Compose Email Merge" to reach out to matching applicants.
                        </td>
                      </tr>
                    ) : (
                      currentEmailMerges.map((em) => (
                        <tr key={em.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700">
                            <span className="font-semibold block">{em.sentBy}</span>
                            <span className="text-slate-400 text-[10px]">{em.sentOn}</span>
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{em.sentTo}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-600 max-w-[150px] truncate">
                            {em.searchString}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{em.zipLocation}</td>
                          <td className="px-3 py-2 text-blue-600 font-medium">{em.subject}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Search Criteria Panel (30% width) */}
        <div className="w-[340px] shrink-0 bg-white rounded border border-[#cbd5e1] p-3 shadow-2xs flex flex-col gap-3 overflow-y-auto">
          {/* Top header: Search Criteria */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h3 className="text-sm font-bold text-[#0b5ed7]">Candidate Search Criteria</h3>
            <button
              onClick={() => {
                setSearchCriteriaQuery(defaultQuery);
                toast.info('Search criteria reset to job primary skills');
              }}
              title="Reset to job skills"
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Query Text Area */}
          <div>
            <textarea
              rows={3}
              value={searchCriteriaQuery}
              onChange={(e) => setSearchCriteriaQuery(e.target.value)}
              className="w-full text-xs font-mono p-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-slate-700 uppercase"
            />
            <div className="flex justify-end mt-0.5 relative">
              <button
                onClick={() => setShowStringBuilder(!showStringBuilder)}
                className="text-[11px] font-semibold text-[#0b5ed7] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                String Builder <ChevronDown className="w-3 h-3" />
              </button>
              {showStringBuilder && (
                <div className="absolute right-0 top-5 w-48 bg-white border border-slate-200 rounded shadow-lg z-30 p-2 text-xs space-y-1 animate-in fade-in">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Insert Operators
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['AND', 'OR', 'NOT', 'NEAR', '()'].map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => handleInsertBoolean(op)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 rounded font-mono text-[11px] font-semibold cursor-pointer"
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* JOB TITLE Section */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              JOB TITLE
            </label>
            <input
              type="text"
              value={jobTitleCriteria}
              onChange={(e) => setJobTitleCriteria(e.target.value)}
              className="w-full text-xs p-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-slate-800"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={recentJobTitleChecked}
                onChange={(e) => setRecentJobTitleChecked(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 w-3.5 h-3.5"
              />
              <span>Exact / Recent Job Title</span>
            </label>
          </div>

          {/* LOCATION DETAILS Section */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              LOCATION DETAILS
            </label>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="locType"
                  checked={locationType === 'radius'}
                  onChange={() => setLocationType('radius')}
                  className="text-blue-600"
                />
                <span>Search Within Radius</span>
              </label>

              {locationType === 'radius' && (
                <div className="pl-4 space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Country</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full p-1 border border-slate-300 rounded text-xs"
                    >
                      <option value="Canada">Canada</option>
                      <option value="United States">United States</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-slate-400 block text-[10px]">City, Zip Code</span>
                      <input
                        type="text"
                        defaultValue={locationDisplay}
                        className="w-full p-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Radius</span>
                      <select className="w-full p-1 border border-slate-300 rounded text-xs">
                        <option>25 Miles</option>
                        <option>50 Miles</option>
                        <option>100 Miles</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="locType"
                  checked={locationType === 'selected'}
                  onChange={() => setLocationType('selected')}
                  className="text-blue-600"
                />
                <span>Search Within Selected Locations</span>
              </label>

              {locationType === 'selected' && (
                <div className="pl-4 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Country</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full p-1 border border-slate-300 rounded text-xs"
                    >
                      <option value="Canada">Canada</option>
                      <option value="United States">United States</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Province</span>
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full p-1 border border-slate-300 rounded text-xs"
                    >
                      <option value="Ontario">Ontario</option>
                      <option value="Alberta">Alberta</option>
                      <option value="British Columbia">British Columbia</option>
                      <option value="Quebec">Quebec</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                      City
                    </span>

                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {selectedCities.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 bg-[#84cc16] text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          {c}
                          <button
                            onClick={() => removeCity(c)}
                            className="hover:opacity-80 ml-0.5 text-white cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Search city and press Enter"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      onKeyDown={handleAddCity}
                      className="w-full p-1 border border-slate-300 rounded text-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FILTERS Section */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              FILTERS
            </label>

            <div>
              <span className="text-slate-600 block text-[11px] font-semibold mb-1">
                Experience Range
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  defaultValue="3"
                  className="w-16 p-1 border border-slate-300 rounded text-xs text-center"
                />
                <span className="text-slate-500 text-[11px]">to</span>
                <input
                  type="text"
                  defaultValue="8"
                  className="w-16 p-1 border border-slate-300 rounded text-xs text-center"
                />
                <span className="text-slate-500 text-[11px]">years</span>
              </div>
            </div>

            <div>
              <span className="text-slate-600 block text-[11px] font-semibold mb-1">
                Tax Terms / Authorization
              </span>
              <select className="w-full p-1 border border-slate-300 rounded text-xs">
                <option value="">Any Authorization</option>
                <option value="citizen">Citizen / PR</option>
                <option value="work_permit">Work Permit</option>
                <option value="w2">W2</option>
                <option value="c2c">C2C</option>
              </select>
            </div>

            {/* Action Buttons: Save | Save and Search */}
            <div className="flex items-center gap-1.5 pt-2 flex-wrap">
              <button
                onClick={() => toast.success('Candidate Search Criteria saved!')}
                className="px-3 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setActiveModule('applicants');
                  toast.success(`Filtering talent matching: ${searchCriteriaQuery}`);
                }}
                className="px-3 py-1 bg-white border border-[#0b5ed7] text-[#0b5ed7] hover:bg-blue-50 rounded text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Save & Search Talent
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Submit Candidate to Job */}
      {showSubmitCandidateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" /> Submit Candidate to {job.jobCode}
              </h4>
              <button
                onClick={() => setShowSubmitCandidateModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCandidateSubmit} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Select Candidate *</label>
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Candidate from Pool --</option>
                  {customApplicants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email || 'No email'}) - {c.displayId || c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Submission Stage *</label>
                  <select
                    value={candidateSubmitStage}
                    onChange={(e) => setCandidateSubmitStage(e.target.value as SubmissionsFilterTab)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="client_submissions">Client Submissions</option>
                    <option value="interviews">Interview Scheduled</option>
                    <option value="pipeline">Internal Pipeline</option>
                    <option value="confirmations">Offer Confirmation</option>
                    <option value="placements">Placement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Target Pay Rate</label>
                  <input
                    type="text"
                    value={candidatePayRate}
                    onChange={(e) => setCandidatePayRate(e.target.value)}
                    placeholder="e.g. $65.00/hr"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Target Bill Rate</label>
                <input
                  type="text"
                  value={candidateBillRate}
                  onChange={(e) => setCandidateBillRate(e.target.value)}
                  placeholder="e.g. $85.00/hr"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitCandidateModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Submit to Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Compose Email Merge */}
      {showComposeMergeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <SendHorizontal className="w-4 h-4" /> Compose Email Merge Campaign
              </h4>
              <button
                onClick={() => setShowComposeMergeModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendEmailMerge} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Recipients Audience *</label>
                <input
                  type="text"
                  required
                  value={mergeForm.sentTo}
                  onChange={(e) => setMergeForm({ ...mergeForm, sentTo: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Location Target</label>
                  <input
                    type="text"
                    value={mergeForm.zipLocation}
                    onChange={(e) => setMergeForm({ ...mergeForm, zipLocation: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Skill Query</label>
                  <input
                    type="text"
                    value={mergeForm.searchString}
                    onChange={(e) => setMergeForm({ ...mergeForm, searchString: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Subject *</label>
                <input
                  type="text"
                  required
                  value={mergeForm.subject}
                  onChange={(e) => setMergeForm({ ...mergeForm, subject: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Message Template</label>
                <textarea
                  rows={5}
                  value={mergeForm.emailDetails}
                  onChange={(e) => setMergeForm({ ...mergeForm, emailDetails: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowComposeMergeModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Job Details */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white shrink-0">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Edit className="w-3.5 h-3.5" /> Edit Job Requisition - {job.jobCode}
              </h4>
              <button onClick={() => setIsEditing(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Client *</label>
                  <input
                    type="text"
                    required
                    value={editForm.client}
                    onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Business Unit</label>
                  <input
                    type="text"
                    value={editForm.businessUnit}
                    onChange={(e) => setEditForm({ ...editForm, businessUnit: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Open Positions</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.numberOfPositions}
                    onChange={(e) => setEditForm({ ...editForm, numberOfPositions: Number(e.target.value) || 1 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Salary Range & Compensation Controls */}
              <div className="crm-form-row grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                {/* Minimum Budget / Salary */}
                <div className="crm-form-group">
                  <label htmlFor="budgetMin" className="block text-slate-700 font-semibold mb-1">Min Salary</label>
                  <input
                    type="number"
                    id="budgetMin"
                    name="budgetMin"
                    placeholder="e.g. 65000"
                    value={editForm.budgetMin ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, budgetMin: e.target.value ? (Number(e.target.value) as any) : '' })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {/* Maximum Budget / Salary */}
                <div className="crm-form-group">
                  <label htmlFor="budgetMax" className="block text-slate-700 font-semibold mb-1">Max Salary</label>
                  <input
                    type="number"
                    id="budgetMax"
                    name="budgetMax"
                    placeholder="e.g. 75000"
                    value={editForm.budgetMax ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, budgetMax: e.target.value ? (Number(e.target.value) as any) : '' })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {/* Currency */}
                <div className="crm-form-group">
                  <label htmlFor="currency" className="block text-slate-700 font-semibold mb-1">Currency</label>
                  <select
                    id="currency"
                    name="currency"
                    value={editForm.currency || 'USD'}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                {/* Salary Period */}
                <div className="crm-form-group">
                  <label htmlFor="salaryPeriod" className="block text-slate-700 font-semibold mb-1">Pay Frequency</label>
                  <select
                    id="salaryPeriod"
                    name="salaryPeriod"
                    value={editForm.salaryPeriod || 'YEARLY'}
                    onChange={(e) => setEditForm({ ...editForm, salaryPeriod: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="YEARLY">Per Year (/yr)</option>
                    <option value="MONTHLY">Per Month (/mo)</option>
                    <option value="HOURLY">Per Hour (/hr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Bill Rate</label>
                  <input
                    type="text"
                    value={editForm.clientBillRate}
                    onChange={(e) => setEditForm({ ...editForm, clientBillRate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Pay Rate</label>
                  <input
                    type="text"
                    value={editForm.payRate}
                    onChange={(e) => setEditForm({ ...editForm, payRate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tax Terms</label>
                  <select
                    value={editForm.taxTerms}
                    onChange={(e) => setEditForm({ ...editForm, taxTerms: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="W2">W2</option>
                    <option value="C2C">C2C</option>
                    <option value="1099">1099</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Job Type</label>
                  <select
                    value={editForm.jobType}
                    onChange={(e) => setEditForm({ ...editForm, jobType: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Part Time">Part Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">City / Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">State / Province</label>
                  <input
                    type="text"
                    value={editForm.states}
                    onChange={(e) => setEditForm({ ...editForm, states: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Primary Skills (comma separated)</label>
                  <input
                    type="text"
                    value={editForm.primarySkills}
                    onChange={(e) => setEditForm({ ...editForm, primarySkills: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Experience Required</label>
                  <input
                    type="text"
                    value={editForm.experience}
                    onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Recruitment Manager</label>
                  <input
                    type="text"
                    value={editForm.recruitmentManager}
                    onChange={(e) => setEditForm({ ...editForm, recruitmentManager: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Assigned Recruiter</label>
                  <input
                    type="text"
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Job Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Note - {job.jobCode}
              </h4>
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddNote} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Note / Activity Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter notes regarding client updates, candidate screening, or team instructions..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Task - {job.jobCode}
              </h4>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Task Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up on client technical interview"
                  value={newTaskForm.taskName}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, taskName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Time Zone</label>
                  <select
                    value={newTaskForm.timeZone}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, timeZone: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="EST">EST</option>
                    <option value="CST">CST</option>
                    <option value="PST">PST</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Assigned To</label>
                <input
                  type="text"
                  value={newTaskForm.assignedTo}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, assignedTo: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Send Requirement Modal */}
      {showSendReqModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b5ed7] text-white">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Send Requirement - {job.jobCode}
              </h4>
              <button
                onClick={() => setShowSendReqModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendRequirements} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Recipient Emails (comma separated) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. candidates@talent.com, vendors@agency.ca"
                  value={sendReqForm.recipients}
                  onChange={(e) => setSendReqForm({ ...sendReqForm, recipients: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Subject</label>
                <input
                  type="text"
                  value={sendReqForm.subject}
                  onChange={(e) => setSendReqForm({ ...sendReqForm, subject: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Body</label>
                <textarea
                  rows={5}
                  value={sendReqForm.message}
                  onChange={(e) => setSendReqForm({ ...sendReqForm, message: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-sans"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSendReqModal(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0b5ed7] text-white rounded font-medium hover:bg-[#1467d6] flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ Admin-Only Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Job Requisition (Admin Only)
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-slate-900">{job.jobTitle}</strong>{' '}
                  <span className="font-mono text-slate-500">({job.jobCode})</span>?
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
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteJob}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
