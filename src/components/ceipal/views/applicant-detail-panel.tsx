import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  User,
  Star,
  ChevronRight,
  ChevronLeft,
  Building,
  Award,
  GraduationCap,
  Clock,
  Sparkles,
  Share2,
  ExternalLink,
  MessageSquare,
  Plus,
  Send,
  UploadCloud,
  CheckCircle2,
  Download,
  Eye,
  X,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplicantItem } from '../types';
import { useCeipal } from '../ceipal-context';
import { getStoredResume, saveStoredResume, StoredResume } from '../resume-storage';
import { extractTextFromFile, parseResumeText, ExtractedResumeData } from '../resume-parser';
import { uploadCandidateResume } from '../../../lib/api/recruitment';
import { resolveApiAssetUrl } from '../../../lib/api/client';

interface ApplicantDetailPanelProps {
  applicant: ApplicantItem;
  allApplicants?: ApplicantItem[];
  onBack: () => void;
  onSelectApplicant?: (app: ApplicantItem) => void;
}

type PanelTab = 'overview' | 'resume' | 'jobs';

export const ApplicantDetailPanel: React.FC<ApplicantDetailPanelProps> = ({
  applicant,
  allApplicants = [],
  onBack,
  onSelectApplicant,
}) => {
  const { toggleApplicantStar, updateApplicant, autoScreenApplicant, jobs } = useCeipal();
  const [activeTab, setActiveTab] = useState<PanelTab>('overview');
  const [applicantStage, setApplicantStage] = useState(applicant.status || 'New lead');
  const [isStarred, setIsStarred] = useState(Boolean(applicant.isStarred));
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [matchScore, setMatchScore] = useState<number | undefined>(applicant.aiMatchScore);
  const [fitBadge, setFitBadge] = useState<string | undefined>(applicant.fitBadge);
  const [aiSummary, setAiSummary] = useState<string | undefined>(applicant.aiSummary);

  const handleAutoScreen = async () => {
    setIsScreening(true);
    try {
      const res = await autoScreenApplicant(applicant.id);
      if (res) {
        setMatchScore(res.matchResult.aiMatchScore);
        setFitBadge(res.matchResult.fitBadge);
        setAiSummary(res.matchResult.aiSummary);
        if (res.autoAdvanced) {
          setApplicantStage('Screening Passed');
        }
      }
    } finally {
      setIsScreening(false);
    }
  };

  // Reactive candidate profile fields (initialized from applicant, updated when resume is scanned)
  interface ScrapedProfile {
    name: string;
    email: string;
    mobile: string;
    city: string;
    state: string;
    jobTitle: string;
    totalExperience?: string;
    summary?: string;
    skills?: string[];
    educationDegree?: string;
    educationInstitution?: string;
    educationYear?: string;
    certifications?: string[];
  }

  // Resume state - only loads actual uploaded resume
  const [uploadedResume, setUploadedResume] = useState<StoredResume | null>(() => {
    const stored =
      getStoredResume(applicant.id, applicant.name) ||
      getStoredResume(applicant.displayId, applicant.name);
    if (stored) return stored;
    if (applicant.resumeDataUrl || applicant.resumeUrl) {
      return {
        name: applicant.resumeFileName || 'Resume.pdf',
        size: applicant.resumeFileSize || '250 KB',
        type: applicant.resumeFileType || 'application/pdf',
        dataUrl: applicant.resumeDataUrl,
        url: resolveApiAssetUrl(applicant.resumeUrl) || applicant.resumeDataUrl,
        uploadedAt: applicant.resumeUploadedAt || 'Recently',
      };
    }
    return null;
  });

  const [attachedResumeName, setAttachedResumeName] = useState<string | undefined>(
    uploadedResume?.name || applicant.resumeFileName
  );
  const [attachedResumeSize, setAttachedResumeSize] = useState<string | undefined>(
    uploadedResume?.size || applicant.resumeFileSize
  );

  const [isScanningResume, setIsScanningResume] = useState(false);

  const [profile, setProfile] = useState<ScrapedProfile>(() => {
    const stored =
      getStoredResume(applicant.id, applicant.name) ||
      getStoredResume(applicant.displayId, applicant.name);
    const sd = stored?.scrapedData;

    const initialSkills: string[] = [];
    if (sd?.skills && sd.skills.length > 0) {
      initialSkills.push(...sd.skills);
    } else if (Array.isArray(applicant.skills)) {
      initialSkills.push(...applicant.skills);
    } else if (typeof applicant.skills === 'string') {
      initialSkills.push(...applicant.skills.split(',').map((s) => s.trim()).filter(Boolean));
    }

    return {
      name: sd?.name || applicant.name,
      email: sd?.email || applicant.email,
      mobile: sd?.mobile || applicant.mobile,
      city: sd?.city || applicant.city,
      state: sd?.state || applicant.state,
      jobTitle: sd?.jobTitle || applicant.jobTitle,
      totalExperience: sd?.totalExperience || applicant.totalExperience,
      summary: sd?.summary || applicant.summary,
      skills: initialSkills,
      educationDegree: sd?.educationDegree || applicant.educationDegree,
      educationInstitution: sd?.educationInstitution || applicant.educationInstitution,
      educationYear: sd?.educationYear || applicant.educationYear,
      certifications: sd?.certifications || applicant.certifications,
    };
  });

  const [scrapedFields, setScrapedFields] = useState<string[]>(() => {
    const stored =
      getStoredResume(applicant.id, applicant.name) ||
      getStoredResume(applicant.displayId, applicant.name);
    if (!stored?.scrapedData) return [];
    const fields: string[] = [];
    if (stored.scrapedData.name) fields.push('Name');
    if (stored.scrapedData.email) fields.push('Email');
    if (stored.scrapedData.mobile) fields.push('Phone');
    if (stored.scrapedData.jobTitle) fields.push('Job Title');
    if (stored.scrapedData.city || stored.scrapedData.state) fields.push('Location');
    if (stored.scrapedData.skills?.length) fields.push('Key Skills');
    if (stored.scrapedData.educationDegree) fields.push('Qualifications');
    if (stored.scrapedData.totalExperience) fields.push('Experience');
    return fields;
  });

  useEffect(() => {
    const stored =
      getStoredResume(applicant.id, applicant.name) ||
      getStoredResume(applicant.displayId, applicant.name);
    if (stored) {
      setUploadedResume(stored);
      setAttachedResumeName(stored.name);
      setAttachedResumeSize(stored.size);
    } else if (applicant.resumeDataUrl || applicant.resumeUrl) {
      const fallback: StoredResume = {
        name: applicant.resumeFileName || 'Resume.pdf',
        size: applicant.resumeFileSize || '250 KB',
        type: applicant.resumeFileType || 'application/pdf',
        dataUrl: applicant.resumeDataUrl,
        url: resolveApiAssetUrl(applicant.resumeUrl) || applicant.resumeDataUrl,
        uploadedAt: applicant.resumeUploadedAt || 'Recently',
      };
      setUploadedResume(fallback);
      setAttachedResumeName(fallback.name);
      setAttachedResumeSize(fallback.size);
    } else {
      setUploadedResume(null);
      setAttachedResumeName(undefined);
      setAttachedResumeSize(undefined);
    }

    const sd = stored?.scrapedData;
    const initialSkills: string[] = [];
    if (sd?.skills && sd.skills.length > 0) {
      initialSkills.push(...sd.skills);
    } else if (Array.isArray(applicant.skills)) {
      initialSkills.push(...applicant.skills);
    } else if (typeof applicant.skills === 'string') {
      initialSkills.push(...applicant.skills.split(',').map((s) => s.trim()).filter(Boolean));
    }

    setProfile({
      name: sd?.name || applicant.name,
      email: sd?.email || applicant.email,
      mobile: sd?.mobile || applicant.mobile,
      city: sd?.city || applicant.city,
      state: sd?.state || applicant.state,
      jobTitle: sd?.jobTitle || applicant.jobTitle,
      totalExperience: sd?.totalExperience || applicant.totalExperience,
      summary: sd?.summary || applicant.summary,
      skills: initialSkills,
      educationDegree: sd?.educationDegree || applicant.educationDegree,
      educationInstitution: sd?.educationInstitution || applicant.educationInstitution,
      educationYear: sd?.educationYear || applicant.educationYear,
      certifications: sd?.certifications || applicant.certifications,
    });

    if (sd) {
      const fields: string[] = [];
      if (sd.name) fields.push('Name');
      if (sd.email) fields.push('Email');
      if (sd.mobile) fields.push('Phone');
      if (sd.jobTitle) fields.push('Job Title');
      if (sd.city || sd.state) fields.push('Location');
      if (sd.skills?.length) fields.push('Key Skills');
      if (sd.educationDegree) fields.push('Qualifications');
      if (sd.totalExperience) fields.push('Experience');
      setScrapedFields(fields);
    } else {
      setScrapedFields([]);
    }
  }, [applicant]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsResumeModalOpen(false);
      }
    };
    if (isResumeModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResumeModalOpen]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    setIsScanningResume(true);
    const toastId = toast.loading(`Scanning resume "${file.name}" & extracting candidate details…`);

    try {
      // 1. Upload to the backend so the resume is on the candidate record for
      // every recruiter/session, not just this browser's localStorage. Falls
      // back to a local blob: URL (this tab only) if the upload call fails.
      let backendResumeUrl: string | undefined;
      try {
        const uploadRes = await uploadCandidateResume(file);
        backendResumeUrl = uploadRes?.url;
      } catch (err) {
        console.warn('Backend resume upload failed, falling back to local preview:', err);
      }

      // 2. Extract text from file (supports PDF, DOCX, TXT, RTF)
      let extractedText = '';
      try {
        extractedText = await extractTextFromFile(file);
      } catch (err) {
        console.warn('Text extraction warning:', err);
      }

      // 3. Parse candidate information
      const scraped = parseResumeText(extractedText, file.name);

      // Read data URL for PDF preview
      let dataUrl: string | undefined = undefined;
      if (isPdf) {
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const resumeObj: StoredResume = {
        name: file.name,
        size: formattedSize,
        type: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
        dataUrl,
        url: resolveApiAssetUrl(backendResumeUrl) || URL.createObjectURL(file),
        uploadedAt: timeString,
        text: extractedText,
        scrapedData: scraped,
      };

      setUploadedResume(resumeObj);
      setAttachedResumeName(file.name);
      setAttachedResumeSize(formattedSize);
      saveStoredResume(applicant.id, applicant.name, resumeObj);
      saveStoredResume(applicant.displayId, applicant.name, resumeObj);

      // 4. Update candidate profile strictly with the 5 requested fields if they exist:
      // Name, Email id, Number, Skills, and Description/Summary
      const filled: string[] = [];
      // Computed from `profile` directly (not read back out of setProfile's
      // updater) -- setState's functional updater isn't guaranteed to run
      // synchronously here since setIsScanningResume(true) above already
      // schedules an update on this component, so reading a variable
      // assigned inside the updater immediately after this call can still
      // observe the pre-update value.
      const nextProfile = { ...profile };
      if (scraped.name) {
        nextProfile.name = scraped.name;
        filled.push('Name');
      }
      if (scraped.email) {
        nextProfile.email = scraped.email;
        filled.push('Email id');
      }
      if (scraped.mobile) {
        nextProfile.mobile = scraped.mobile;
        filled.push('Number');
      }
      if (scraped.skills && scraped.skills.length > 0) {
        nextProfile.skills = scraped.skills;
        filled.push('Skills');
      }
      if (scraped.summary) {
        nextProfile.summary = scraped.summary;
        filled.push('Summary');
      }
      setProfile(nextProfile);

      // 5. Persist to the backend -- resume + whatever the profile now holds,
      // so it's there on reload/for other recruiters instead of only this browser.
      try {
        await updateApplicant(applicant.id, {
          resumeUrl: backendResumeUrl,
          name: nextProfile.name,
          email: nextProfile.email,
          mobile: nextProfile.mobile,
          skills: nextProfile.skills,
          summary: nextProfile.summary,
        });
      } catch (err) {
        console.warn('Failed to persist scraped resume profile to backend:', err);
      }

      setScrapedFields(filled);
      toast.dismiss(toastId);
      if (filled.length > 0) {
        toast.success(
          `✨ Resume scanned! Scraped ${filled.length} candidate fields (${filled.slice(0, 4).join(', ')}${filled.length > 4 ? ` +${filled.length - 4} more` : ''})`
        );
      } else {
        toast.success(`Resume "${file.name}" uploaded successfully!`);
      }
    } catch (err) {
      console.error('Failed to parse resume:', err);
      toast.dismiss(toastId);
      toast.error('Failed to process resume document');
    } finally {
      setIsScanningResume(false);
      e.target.value = '';
    }
  };

  const handleRescanResume = async () => {
    if (!uploadedResume) return;
    setIsScanningResume(true);
    const toastId = toast.loading(`Re-scanning resume "${uploadedResume.name}"…`);

    try {
      const text = uploadedResume.text || '';
      const scraped = parseResumeText(text, uploadedResume.name);

      const filled: string[] = [];
      // See handleResumeUpload above -- computed directly rather than read
      // back out of setProfile's updater, since that isn't guaranteed to
      // run synchronously (setIsScanningResume(true) above already
      // schedules an update on this component).
      const nextProfile = { ...profile };
      if (scraped.name) {
        nextProfile.name = scraped.name;
        filled.push('Name');
      }
      if (scraped.email) {
        nextProfile.email = scraped.email;
        filled.push('Email');
      }
      if (scraped.mobile) {
        nextProfile.mobile = scraped.mobile;
        filled.push('Phone');
      }
      if (scraped.city) {
        nextProfile.city = scraped.city;
        filled.push('City');
      }
      if (scraped.state) {
        nextProfile.state = scraped.state;
        filled.push('State');
      }
      if (scraped.jobTitle) {
        nextProfile.jobTitle = scraped.jobTitle;
        filled.push('Job Title');
      }
      if (scraped.summary) {
        nextProfile.summary = scraped.summary;
        filled.push('Summary');
      }
      if (scraped.skills && scraped.skills.length > 0) {
        nextProfile.skills = scraped.skills;
        filled.push('Key Skills');
      }
      if (scraped.totalExperience) {
        nextProfile.totalExperience = scraped.totalExperience;
        filled.push('Experience');
      }
      if (scraped.educationDegree) {
        nextProfile.educationDegree = scraped.educationDegree;
        filled.push('Qualifications');
      }
      if (scraped.educationInstitution) {
        nextProfile.educationInstitution = scraped.educationInstitution;
        filled.push('Institution');
      }
      if (scraped.educationYear) {
        nextProfile.educationYear = scraped.educationYear;
        filled.push('Graduation Year');
      }
      if (scraped.certifications && scraped.certifications.length > 0) {
        nextProfile.certifications = scraped.certifications;
        filled.push('Certifications');
      }
      setProfile(nextProfile);

      const updatedObj: StoredResume = {
        ...uploadedResume,
        scrapedData: scraped,
      };
      setUploadedResume(updatedObj);
      saveStoredResume(applicant.id, applicant.name, updatedObj);
      saveStoredResume(applicant.displayId, applicant.name, updatedObj);

      try {
        await updateApplicant(applicant.id, {
          name: nextProfile.name,
          email: nextProfile.email,
          mobile: nextProfile.mobile,
          city: nextProfile.city,
          state: nextProfile.state,
          jobTitle: nextProfile.jobTitle,
          summary: nextProfile.summary,
          skills: nextProfile.skills,
          totalExperience: nextProfile.totalExperience,
          educationDegree: nextProfile.educationDegree,
          educationInstitution: nextProfile.educationInstitution,
          educationYear: nextProfile.educationYear,
          certifications: nextProfile.certifications,
        });
      } catch (err) {
        console.warn('Failed to persist re-scanned profile to backend:', err);
      }

      setScrapedFields(filled);
      toast.dismiss(toastId);
      if (filled.length > 0) {
        toast.success(
          `✨ Resume scanned! Scraped ${filled.length} fields (${filled.slice(0, 4).join(', ')}${filled.length > 4 ? ` +${filled.length - 4} more` : ''})`
        );
      } else {
        toast.info('Resume re-scanned. No new fields detected.');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error('Failed to re-scan resume');
    } finally {
      setIsScanningResume(false);
    }
  };

  // Current applicant navigation (previous / next)
  const currentIndex = allApplicants.findIndex((a) => a.id === applicant.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allApplicants.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectApplicant) {
      onSelectApplicant(allApplicants[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectApplicant) {
      onSelectApplicant(allApplicants[currentIndex + 1]);
    }
  };

  const handleToggleStar = async () => {
    setIsStarred((prev) => !prev);
    try {
      await toggleApplicantStar(applicant.id);
    } catch {
      // ignore
    }
  };

  const handleEmailCandidateClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const emailToUse = profile.email || applicant.email;
    if (!emailToUse) {
      toast.error('No email address attached to this applicant.');
      return;
    }

    const candidateName = profile.name || applicant.name;
    const candidateRole = profile.jobTitle || applicant.jobTitle || 'open position';
    const subject = encodeURIComponent(
      `Regarding your application for ${candidateRole}`
    );
    const body = encodeURIComponent(
      `Hi ${candidateName},\n\nI am contacting you regarding your application for the ${candidateRole} position at Venus.\n\nCould you please let us know your availability for a brief call this week?\n\nBest regards,\nRecruitment Team`
    );

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      emailToUse
    )}&su=${subject}&body=${body}`;

    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Opening Gmail compose for ${emailToUse}…`);
  };

  // Find matching job if any
  const matchedJob = jobs?.find(
    (j) => j.jobTitle.toLowerCase() === (profile.jobTitle || applicant.jobTitle || '').toLowerCase()
  );

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800 animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-[#cbd5e1] shadow-2xs px-4 py-2.5 flex items-center justify-between sticky top-0 z-20 no-print">
        {/* Left: Back button & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>Back to Applicants</span>
          </button>

          <div className="h-4 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Applicants</span>
            <span className="text-slate-400">/</span>
            <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
              {profile.name}
            </span>
            <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              #{applicant.displayId || applicant.id}
            </span>
          </div>
        </div>

        {/* Right: Quick actions & record pager */}
        <div className="flex items-center gap-2">
          {/* Show Resume Button in Top Bar */}
          <button
            onClick={() => {
              if (uploadedResume) {
                setIsResumeModalOpen(true);
              } else {
                toast.info("No resume uploaded yet. Click 'Add Resume' to upload one.");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            title="View candidate's resume"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Show Resume</span>
          </button>

          {/* Add Resume Button in Top Bar */}
          <label
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-xs font-medium cursor-pointer shadow-2xs transition-colors"
            title="Upload or Update Resume"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">
              {uploadedResume ? 'Change Resume' : 'Add Resume'}
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
              className="sr-only"
              onChange={handleResumeUpload}
            />
          </label>



          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Record navigation */}
          {allApplicants.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 mr-1 hidden sm:inline">
                {currentIndex + 1} of {allApplicants.length}
              </span>
              <button
                disabled={!hasPrev}
                onClick={handlePrev}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous applicant"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={!hasNext}
                onClick={handleNext}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next applicant"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Applicant Banner Summary Card */}
      <div className="bg-white border-b border-[#cbd5e1] px-6 py-4 shadow-xs no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Avatar & Main Info */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0 border-2 border-white ring-2 ring-blue-100">
              {profile.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
                <button
                  onClick={handleToggleStar}
                  className="focus:outline-none cursor-pointer p-0.5"
                  title={isStarred ? 'Unstar candidate' : 'Star candidate'}
                >
                  <Star
                    className={`w-4 h-4 transition-colors ${
                      isStarred
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 hover:text-amber-400'
                    }`}
                  />
                </button>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {applicantStage}
                </span>
                {matchScore !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                      fitBadge === 'PLATINUM_FIT' || matchScore >= 85
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : fitBadge === 'GOLD_FIT' || matchScore >= 70
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : fitBadge === 'SILVER_FIT' || matchScore >= 55
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{Math.round(matchScore)}% Fit</span>
                    <span className="text-[10px] font-medium opacity-85">
                      ({fitBadge === 'PLATINUM_FIT' ? 'Platinum' : fitBadge === 'GOLD_FIT' ? 'Gold' : fitBadge === 'SILVER_FIT' ? 'Silver' : 'Review'})
                    </span>
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  Source: {applicant.source || 'Resume Inbox'}
                </span>
                {scrapedFields.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    Auto-Scraped
                  </span>
                )}
              </div>

              {/* Sub-header attributes */}
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>{profile.jobTitle}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    onClick={handleEmailCandidateClick}
                    className="text-blue-600 hover:underline cursor-pointer text-left font-medium"
                    title={`Click to email ${profile.email}`}
                  >
                    {profile.email}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${profile.mobile}`} className="text-slate-700 hover:underline">
                    {profile.mobile}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {profile.city ? `${profile.city}, ${profile.state}` : profile.state || 'Location unassigned'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Owner: {applicant.owner || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stage Selector & Direct Actions */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Recruitment Stage
              </label>
              <select
                value={applicantStage}
                onChange={(e) => {
                  setApplicantStage(e.target.value);
                  toast.success(`Stage updated to "${e.target.value}"`);
                }}
                className="appearance-none pl-2.5 pr-7 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 hover:bg-slate-100 shadow-2xs"
              >
                <option value="New lead">New lead</option>
                <option value="Sourced">Sourced</option>
                <option value="Screening Passed">Screening Passed</option>
                <option value="Client Interview">Client Interview</option>
                <option value="Offer Released">Offer Released</option>
                <option value="Joined">Joined</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Show Resume Action Button in Candidate Header */}
            <button
              onClick={() => {
                if (uploadedResume) {
                  setIsResumeModalOpen(true);
                } else {
                  toast.info("No resume uploaded yet. Click 'Add Resume' to upload one.");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer self-end"
              title="Open Resume"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show Resume</span>
            </button>

            {/* Email Candidate Button */}
            <button
              onClick={handleEmailCandidateClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer self-end"
              title={`Email ${profile.email} via Gmail`}
            >
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span>Email Candidate</span>
            </button>
          </div>
        </div>

        {/* Panel Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 border-t border-slate-200 pt-2 no-print">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('resume')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'resume'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Resume & CV</span>
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'jobs'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Job Requisitions</span>
          </button>
        </div>
      </div>

      {/* Smart Resume Extraction Status Banner */}
      {isScanningResume && (
        <div className="mx-4 md:mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs flex items-center gap-2.5 text-blue-900 shadow-xs animate-pulse">
          <Sparkles className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <div>
            <span className="font-bold">Scanning resume document…</span>
            <span className="text-blue-700 ml-1">
              Extracting candidate name, contact, qualifications, and skills.
            </span>
          </div>
        </div>
      )}

      {scrapedFields.length > 0 && !isScanningResume && (
        <div className="mx-4 md:mx-6 mt-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2.5 text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Resume Scraped & Info Extracted:</span>
              <span className="text-emerald-800 ml-1">
                Candidate details parsed from{' '}
                <strong className="font-semibold">{attachedResumeName || 'resume'}</strong>.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {scrapedFields.map((f) => (
              <span
                key={f}
                className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 rounded text-[10px] font-semibold text-emerald-800 flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* ==================== TAB: RESUME DOCUMENT ==================== */}
        {activeTab === 'resume' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Resume Information & Action Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {uploadedResume ? uploadedResume.name : 'No Resume Uploaded'}
                      </h3>
                      {uploadedResume ? (
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Uploaded Document
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          Missing Resume
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {uploadedResume ? (
                        <span>
                          File Size: <strong>{uploadedResume.size}</strong> • Type:{' '}
                          <span className="uppercase font-semibold">
                            {uploadedResume.name.split('.').pop() || 'PDF'}
                          </span>{' '}
                          • Uploaded {uploadedResume.uploadedAt}
                        </span>
                      ) : (
                        <span>No resume document has been uploaded for {applicant.name} yet.</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Primary Action: Show Resume button */}
                <div className="flex items-center gap-2">
                  {uploadedResume && (
                    <button
                      onClick={() => setIsResumeModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Show Resume</span>
                    </button>
                  )}

                  {uploadedResume && (
                    <button
                      onClick={handleRescanResume}
                      disabled={isScanningResume}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50"
                      title="Re-scan and scrape candidate details from resume"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isScanningResume ? 'animate-spin' : ''}`} />
                      <span>{isScanningResume ? 'Scanning…' : 'Scan & Scrape Info'}</span>
                    </button>
                  )}

                  <label
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-xs font-semibold shadow-2xs cursor-pointer transition-all"
                    title="Upload or change resume"
                  >
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    <span>{uploadedResume ? 'Change Resume' : 'Add Resume'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
                      className="sr-only"
                      onChange={handleResumeUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Secondary Actions Bar */}
              {uploadedResume ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const target = uploadedResume.url || uploadedResume.dataUrl;
                          if (target) window.open(target, '_blank');
                          else setIsResumeModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>Open in New Window</span>
                      </button>



                      {uploadedResume.url && (
                        <a
                          href={uploadedResume.url}
                          download={uploadedResume.name}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => setShowInlinePreview((prev) => !prev)}
                      className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      {showInlinePreview ? 'Hide Inline Preview' : 'Preview Inline'}
                    </button>
                  </div>

                  {/* Optional Inline Preview when explicitly toggled */}
                  {showInlinePreview && (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="bg-slate-100 rounded-lg p-2 border border-slate-200">
                        {uploadedResume.type?.includes('pdf') ||
                        uploadedResume.name?.toLowerCase().endsWith('.pdf') ? (
                          <iframe
                            src={uploadedResume.dataUrl || uploadedResume.url}
                            className="w-full h-[70vh] border-none rounded bg-white"
                            title={uploadedResume.name}
                          />
                        ) : uploadedResume.text ? (
                          <div className="bg-white rounded p-6 max-h-[70vh] overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                            {uploadedResume.text}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-white rounded">
                            <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-700 font-bold">{uploadedResume.name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No resume empty state */
                <div className="mt-4 p-8 border-2 border-dashed border-slate-200 rounded-lg text-center space-y-3 bg-slate-50/50">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600">
                    No resume document uploaded for <strong>{applicant.name}</strong>.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition-all">
                    <UploadCloud className="w-4 h-4" />
                    <span>Add Resume</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
                      className="sr-only"
                      onChange={handleResumeUpload}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: OVERVIEW ==================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column: Personal & Contact Details */}
            <div className="lg:col-span-2 space-y-5">
              {/* ✨ AI Resume Matching & Screening Assessment Card */}
              <div className="bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 rounded-lg border border-indigo-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        AI Resume Match & Auto-Screening
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Evaluated against {applicant.jobTitle || 'assigned role'} requirements
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoScreen}
                      disabled={isScreening}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isScreening ? 'animate-spin' : ''}`} />
                      <span>{isScreening ? 'Screening…' : 'Re-Screen Candidate'}</span>
                    </button>
                  </div>
                </div>

                {/* Score Gauges & Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Overall Match</span>
                    <span className="text-xl font-extrabold text-indigo-600">{Math.round(matchScore ?? 85)}%</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Skills Overlap</span>
                    <span className="text-xl font-extrabold text-emerald-600">{Math.round(applicant.skillMatchScore ?? 88)}%</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Experience Fit</span>
                    <span className="text-xl font-extrabold text-blue-600">{Math.round(applicant.expMatchScore ?? 85)}%</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Location / Type</span>
                    <span className="text-xl font-extrabold text-violet-600">{Math.round(applicant.locMatchScore ?? 90)}%</span>
                  </div>
                </div>

                {/* Narrative Summary Brief */}
                {aiSummary && (
                  <div className="p-3 bg-white/90 border border-indigo-100 rounded-lg text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">AI Brief:</span>
                    <span>{aiSummary}</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Applicant Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Full Name</span>
                    <span className="font-bold text-slate-900 text-sm">{profile.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Applicant ID</span>
                    <span className="font-mono text-slate-800">
                      #{applicant.displayId || applicant.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Email Address</span>
                    <button
                      onClick={handleEmailCandidateClick}
                      className="text-blue-600 font-semibold hover:underline cursor-pointer text-left"
                      title={`Click to email ${profile.email}`}
                    >
                      {profile.email}
                    </button>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Phone Number</span>
                    <span className="font-mono text-slate-800">{profile.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Location</span>
                    <span className="font-medium text-slate-800">
                      {profile.city ? `${profile.city}, ${profile.state}` : profile.state || 'Location unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Recruiter / Owner</span>
                    <span className="font-semibold text-slate-800">{applicant.owner || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Primary Job Title</span>
                    <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                      {profile.jobTitle}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Source Channel</span>
                    <span className="font-medium text-slate-800">{applicant.source || 'Resume Inbox'}</span>
                  </div>
                </div>
              </div>

              {/* Qualifications & Education */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5 flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                    <span>Qualifications & Education</span>
                  </span>
                  {profile.educationDegree && (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      Scraped from Resume
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Degree / Qualification</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {profile.educationDegree || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">University / Institution</span>
                    <span className="font-semibold text-slate-800">
                      {profile.educationInstitution || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Graduation Year</span>
                    <span className="font-mono text-slate-800">
                      {profile.educationYear || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Skills & Technologies */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-blue-600" />
                    <span>Key Skills & Technologies</span>
                  </span>
                  {profile.skills && profile.skills.length > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {profile.skills.length} Detected
                    </span>
                  )}
                </h3>
                {profile.skills && profile.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded text-xs font-medium text-slate-800 transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No skills identified yet. Upload or re-scan resume to automatically detect tech stack.
                  </p>
                )}
              </div>

              {/* Executive Summary / Bio (if available) */}
              {profile.summary && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Executive Summary</span>
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 font-sans">
                    {profile.summary}
                  </p>
                </div>
              )}

              {/* Professional Certifications (if available) */}
              {profile.certifications && profile.certifications.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Certifications</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.certifications.map((cert, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-xs font-semibold text-amber-900 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Compensation & Availability */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>Experience & Compensation</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Total Experience</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {profile.totalExperience || applicant.totalExperience || '6+ Years'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Current Salary</span>
                    <span className="font-semibold text-slate-800">
                      {applicant.currentSalary || '$115,000 / yr'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Expected Salary</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {applicant.expectedSalary || '$135,000 / yr'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Notice Period</span>
                    <span className="font-medium text-slate-800">
                      {applicant.noticePeriod || '2 Weeks / Immediate'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Work Authorization</span>
                    <span className="font-medium text-slate-800">
                      {applicant.workAuthorization || 'Authorized / Citizen'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Willing to Relocate</span>
                    <span className="font-medium text-slate-800">
                      {applicant.willingToRelocate || 'Yes (Hybrid / Remote)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Quick Requisition Card & Resume Card */}
            <div className="space-y-5">
              {/* Resume Card Preview */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Candidate Resume
                  </span>
                  {uploadedResume && (
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                      Attached
                    </span>
                  )}
                </h3>

                {uploadedResume ? (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900 truncate">{uploadedResume.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {uploadedResume.size} • Uploaded {uploadedResume.uploadedAt}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsResumeModalOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Show Resume</span>
                    </button>

                    <button
                      onClick={handleRescanResume}
                      disabled={isScanningResume}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Re-scan and scrape candidate details from resume"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isScanningResume ? 'animate-spin' : ''}`} />
                      <span>{isScanningResume ? 'Scanning Resume…' : 'Re-scan & Scrape Details'}</span>
                    </button>

                    <label className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer">
                      <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                      <span>Change Resume</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
                        className="sr-only"
                        onChange={handleResumeUpload}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="text-center py-3 space-y-2.5">
                    <p className="text-xs text-slate-500">No resume attached to this candidate yet.</p>
                    <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition-colors cursor-pointer">
                      <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                      <span>Add Resume</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
                        className="sr-only"
                        onChange={handleResumeUpload}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Matched Requisition Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  <span>Associated Requisition</span>
                </h3>
                {matchedJob ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-bold text-slate-900">{matchedJob.jobTitle}</div>
                    <div className="text-[11px] text-slate-500">
                      Code: {matchedJob.jobCode} • Client: {matchedJob.client}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Rate: {matchedJob.clientBillRate || 'Competitive'} • Status: {matchedJob.jobStatus}
                    </div>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold mt-1">
                      Matched to Profile
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    <p className="font-medium text-slate-800">{applicant.jobTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Target position configured in candidate profile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: JOB REQUISITIONS ==================== */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs max-w-4xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Available Requisitions for {applicant.name}</span>
            </h3>

            <div className="space-y-2.5">
              {jobs && jobs.length > 0 ? (
                jobs.slice(0, 6).map((job) => {
                  const isDirectMatch =
                    job.jobTitle.toLowerCase() === (applicant.jobTitle || '').toLowerCase();
                  return (
                    <div
                      key={job.id}
                      className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs ${
                        isDirectMatch
                          ? 'bg-blue-50/60 border-blue-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{job.jobTitle}</span>
                          {isDirectMatch && (
                            <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-bold rounded">
                              Current Match
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {job.jobCode} • {job.client} • {job.location || 'Remote'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            toast.success(`Applicant ${applicant.name} submitted to ${job.jobTitle}!`);
                          }}
                          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded text-xs cursor-pointer transition-colors shadow-2xs"
                        >
                          Submit Candidate
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No active job postings available at this moment.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== RESUME VIEWER MODAL ==================== */}
      {isResumeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsResumeModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 rounded text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold flex items-center gap-2 text-white">
                    <span>{applicant.name} — Resume Document</span>
                    {uploadedResume && (
                      <span className="text-[10px] font-normal text-slate-300 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                        {uploadedResume.name} ({uploadedResume.size})
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* Modal Header Actions */}
              <div className="flex items-center gap-2">
                {uploadedResume && (
                  <>
                    <button
                      onClick={() => {
                        const target = uploadedResume.url || uploadedResume.dataUrl;
                        if (target) window.open(target, '_blank');
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer transition-colors"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>



                    {uploadedResume.url && (
                      <a
                        href={uploadedResume.url}
                        download={uploadedResume.name}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </>
                )}

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  onClick={() => setIsResumeModalOpen(false)}
                  className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-300 cursor-pointer transition-colors"
                  title="Close viewer (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-2">
              {uploadedResume ? (
                uploadedResume.type?.includes('pdf') ||
                uploadedResume.name?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={uploadedResume.dataUrl || uploadedResume.url}
                    className="w-full h-full border-none rounded bg-white shadow-inner"
                    title={uploadedResume.name}
                  />
                ) : uploadedResume.text ? (
                  <div className="w-full h-full bg-white rounded p-8 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-sm">
                    {uploadedResume.text}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-8 text-center max-w-md shadow-md space-y-3">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">{uploadedResume.name}</h4>
                    <p className="text-xs text-slate-500">
                      {uploadedResume.size} • Uploaded at {uploadedResume.uploadedAt}
                    </p>
                    {uploadedResume.url && (
                      <a
                        href={uploadedResume.url}
                        download={uploadedResume.name}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Document</span>
                      </a>
                    )}
                  </div>
                )
              ) : (
                <div className="bg-white rounded-lg p-8 text-center max-w-md shadow-md space-y-3">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900">No Resume Uploaded</h4>
                  <p className="text-xs text-slate-500">
                    No resume document has been uploaded for {applicant.name}.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition-all">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Resume Now</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        handleResumeUpload(e);
                        setIsResumeModalOpen(false);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
