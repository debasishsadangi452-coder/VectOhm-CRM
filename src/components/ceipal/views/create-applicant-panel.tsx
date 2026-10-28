import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  Save,
  X,
  Building,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  UploadCloud,
  FileText,
  Trash2,
  Paperclip,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplicantItem } from '../types';
import { useCeipal } from '../ceipal-context';
import { uploadCandidateResume } from '../../../lib/api/recruitment';
import { saveStoredResume } from '../resume-storage';
import { extractTextFromFile, parseResumeText, ExtractedResumeData } from '../resume-parser';

interface CreateApplicantPanelProps {
  onBack: () => void;
  onCreated?: (applicant: ApplicantItem) => void;
}

export const CreateApplicantPanel: React.FC<CreateApplicantPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { addApplicant, jobs } = useCeipal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openImmediately, setOpenImmediately] = useState(true);

  // Resume Upload & Scraping State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isScanningResume, setIsScanningResume] = useState(false);
  const [scrapedData, setScrapedData] = useState<ExtractedResumeData | null>(null);
  const [scrapedFields, setScrapedFields] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<{
    file?: File;
    name: string;
    size: string;
    url?: string;
    dataUrl?: string;
    text?: string;
    uploadedAt: string;
  } | null>(null);

  // Form State: starts clean, only populated with real data extracted from resume
  const [formData, setFormData] = useState({
    // Basic & Contact
    name: '',
    jobTitle: '',
    email: '',
    mobile: '',
    city: '',
    state: '',
    source: 'Resume Inbox',
    owner: 'Megan Foster',
    status: 'New lead',

    // Experience & Compensation
    totalExperience: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    workAuthorization: '',
    willingToRelocate: '',

    // Background & Skills
    skills: '',
    summary: '',
    educationDegree: '',
    educationInstitution: '',
    educationYear: '',
    certifications: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResumeFileSelected = async (file: File) => {
    if (!file) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    setIsUploadingResume(true);
    setIsScanningResume(true);
    const toastId = toast.loading(`Scanning resume "${file.name}" & extracting candidate profile…`);

    let remoteUrl: string | undefined = undefined;

    try {
      const uploadRes = await uploadCandidateResume(file);
      if (uploadRes?.url) {
        // Backend-relative path (e.g. "/candidates/resumes/<uuid>.pdf"), by
        // design -- kept relative here so it's portable across environments;
        // resolved to an absolute, fetchable URL where it's rendered.
        remoteUrl = uploadRes.url;
      }
    } catch (err) {
      console.warn('Backend resume upload fallback to local URL:', err);
      try {
        remoteUrl = URL.createObjectURL(file);
      } catch {
        // ignore
      }
    } finally {
      setIsUploadingResume(false);
    }

    // 1. Extract raw text from resume document
    let extractedText = '';
    try {
      extractedText = await extractTextFromFile(file);
    } catch (e) {
      console.warn('Resume text extraction warning:', e);
    }

    // 2. Parse and scrape candidate information
    const scraped = parseResumeText(extractedText, file.name);
    setScrapedData(scraped);

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setResumeFile({
      file,
      name: file.name,
      size: formattedSize,
      url: remoteUrl,
      text: extractedText,
      uploadedAt: timeString,
    });

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setResumeFile((prev) => (prev ? { ...prev, dataUrl } : null));
    };
    reader.readAsDataURL(file);

    // 3. Auto-populate strictly the 5 requested fields if they exist on the resume:
    // Name, Email id, Number, Skills, and Description/Summary
    const filled: string[] = [];
    setFormData((prev) => {
      const next = { ...prev };
      if (scraped.name) {
        next.name = scraped.name;
        filled.push('Name');
      }
      if (scraped.email) {
        next.email = scraped.email;
        filled.push('Email id');
      }
      if (scraped.mobile) {
        next.mobile = scraped.mobile;
        filled.push('Number');
      }
      if (scraped.skills && scraped.skills.length > 0) {
        next.skills = scraped.skills.join(', ');
        filled.push('Skills');
      }
      if (scraped.summary) {
        next.summary = scraped.summary;
        filled.push('Summary');
      }
      return next;
    });

    setIsScanningResume(false);
    setScrapedFields(filled);
    toast.dismiss(toastId);

    if (filled.length > 0) {
      toast.success(
        `✨ Resume scanned! Scraped ${filled.length} candidate fields: ${filled.slice(0, 4).join(', ')}${
          filled.length > 4 ? ` +${filled.length - 4} more` : ''
        }`
      );
    } else {
      toast.success(`Resume "${file.name}" attached successfully!`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleResumeFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('Please enter the applicant full name.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const displayId = String(Math.floor(10000 + Math.random() * 90000));
      const parsedCertifications = formData.certifications
        ? formData.certifications.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      const newApplicant: Omit<ApplicantItem, 'id'> = {
        displayId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        city: formData.city.trim() || 'Toronto',
        state: formData.state.trim() || 'ON',
        source: formData.source,
        status: formData.status,
        jobTitle: formData.jobTitle.trim() || 'Senior Full Stack Engineer',
        owner: formData.owner,
        badgeCount: 1,
        isStarred: false,
        skills: formData.skills.trim(),
        totalExperience: formData.totalExperience,
        currentSalary: formData.currentSalary,
        expectedSalary: formData.expectedSalary,
        noticePeriod: formData.noticePeriod,
        workAuthorization: formData.workAuthorization,
        willingToRelocate: formData.willingToRelocate,
        summary: formData.summary,
        educationDegree: formData.educationDegree,
        educationInstitution: formData.educationInstitution,
        educationYear: formData.educationYear,
        certifications: parsedCertifications,
        resumeFileName: resumeFile?.name,
        resumeFileSize: resumeFile?.size,
        resumeUrl: resumeFile?.url,
        resumeDataUrl: resumeFile?.dataUrl,
        resumeFileType:
          resumeFile?.file?.type ||
          (resumeFile?.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        resumeUploadedAt: resumeFile?.uploadedAt,
      };

      if (resumeFile) {
        saveStoredResume(displayId, newApplicant.name, {
          name: resumeFile.name,
          size: resumeFile.size,
          url: resumeFile.url,
          dataUrl: resumeFile.dataUrl,
          type:
            resumeFile.file?.type ||
            (resumeFile.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
          text: resumeFile.text,
          uploadedAt: resumeFile.uploadedAt,
        });
      }

      await addApplicant(newApplicant);
      toast.success(`Applicant profile for ${formData.name} created successfully!`);

      if (openImmediately && onCreated) {
        onCreated({
          ...newApplicant,
          id: `app-${Date.now()}`,
        });
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to create applicant:', err);
      setErrorMessage(err?.message || 'Could not save applicant profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800 animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-[#cbd5e1] shadow-2xs px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Back & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
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
            <span className="text-xs font-bold text-slate-900">New Applicant Profile</span>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium cursor-pointer shadow-2xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-1 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition-all disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving Profile…' : 'Save Applicant'}</span>
          </button>
        </div>
      </div>

      {/* Main Page Form Body */}
      <div className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5">
        {/* Hidden File Input for Resume Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleResumeFileSelected(file);
              e.target.value = '';
            }
          }}
        />

        {/* Page Banner Header */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Create New Applicant Profile
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete candidate onboarding information across contact, compensation, experience, and background.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
            <X className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Smart Resume Scanner & Auto-Fill Card */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border transition-all overflow-hidden ${
            resumeFile
              ? 'bg-gradient-to-r from-emerald-50/80 to-blue-50/60 border-emerald-300 shadow-xs'
              : isDragging
              ? 'border-blue-500 bg-blue-50/90 scale-[0.99] shadow-md'
              : 'bg-white border-blue-200 hover:border-blue-300 shadow-xs'
          }`}
        >
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                  resumeFile
                    ? 'bg-emerald-600 text-white'
                    : isScanningResume
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isScanningResume ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : resumeFile ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5 text-blue-600" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {isScanningResume
                      ? 'Scanning Resume & Scraping Candidate Info…'
                      : resumeFile
                      ? `Resume Scraped: ${resumeFile.name}`
                      : 'Smart Resume Auto-Fill'}
                  </h3>
                  {resumeFile && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Auto-Filled {scrapedFields.length > 0 ? `${scrapedFields.length} Fields` : 'Active'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                  {isScanningResume
                    ? 'Scanning document text and extracting name, email, phone number, qualifications, experience, and skills…'
                    : resumeFile
                    ? `Successfully auto-filled candidate fields: ${
                        scrapedFields.length > 0
                          ? scrapedFields.join(', ')
                          : 'Name, Contact, Qualifications, and Skills'
                      }. Review or edit any information below.`
                    : 'Upload or drop a candidate resume (PDF, DOCX, TXT). Venus CRM will scan the file and automatically scrap the required applicant information.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningResume || isUploadingResume}
                className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded text-xs font-semibold shadow-xs cursor-pointer transition-all ${
                  resumeFile
                    ? 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {isScanningResume
                    ? 'Scanning…'
                    : resumeFile
                    ? 'Scan Another Resume'
                    : 'Upload Resume to Auto-Fill'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card 1: Personal & Contact Information */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-blue-600" />
              <span>1. Personal & Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Jane Doe"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Primary Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  required
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane.doe@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mobile Number <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    name="mobile"
                    placeholder="+1 (555) 234-5678 or +91 XXXXX XXXXX"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. New York, Toronto"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">State / Province</label>
                <input
                  type="text"
                  name="state"
                  placeholder="e.g. NY, ON, CA"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Source Channel</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="Resume Inbox">Resume Inbox</option>
                  <option value="ZipRecruiter">ZipRecruiter</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Direct Application">Direct Application</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Dice">Dice</option>
                  <option value="Referral">Employee Referral</option>
                  <option value="Career Portal">Career Portal</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Recruiter / Owner</label>
                <select
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-medium"
                >
                  <option value="Megan Foster">Megan Foster</option>
                  <option value="Govind Rao">Govind Rao</option>
                  <option value="Rajesh Kumar">Rajesh Kumar</option>
                  <option value="Paresh Sen">Paresh Sen</option>
                  <option value="Aditya Rao">Aditya Rao</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Recruitment Stage</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-semibold text-emerald-800"
                >
                  <option value="New lead">New lead</option>
                  <option value="Sourced">Sourced</option>
                  <option value="Screening Passed">Screening Passed</option>
                  <option value="Client Interview">Client Interview</option>
                  <option value="Offer Released">Offer Released</option>
                  <option value="Joined">Joined</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Experience & Compensation (Matches Profile Overview panel) */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>2. Experience & Compensation Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Total Experience</label>
                <input
                  type="text"
                  name="totalExperience"
                  placeholder="e.g. 6+ Years, 4 Years"
                  value={formData.totalExperience}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Current Salary / CTC</label>
                <input
                  type="text"
                  name="currentSalary"
                  placeholder="e.g. $115,000 / yr"
                  value={formData.currentSalary}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expected Salary / CTC</label>
                <input
                  type="text"
                  name="expectedSalary"
                  placeholder="e.g. $135,000 / yr"
                  value={formData.expectedSalary}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notice Period / Availability</label>
                <select
                  name="noticePeriod"
                  value={formData.noticePeriod}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="Immediate">Immediate</option>
                  <option value="2 Weeks / Immediate">2 Weeks / Immediate</option>
                  <option value="1 Month">1 Month</option>
                  <option value="2 Months">2 Months</option>
                  <option value="Negotiable">Negotiable</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Work Authorization</label>
                <select
                  name="workAuthorization"
                  value={formData.workAuthorization}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="Authorized / Citizen">Authorized / Citizen</option>
                  <option value="Permanent Resident / Green Card">Permanent Resident / Green Card</option>
                  <option value="H1B / Work Visa">H1B / Work Visa</option>
                  <option value="TN Visa">TN Visa</option>
                  <option value="Requires Sponsorship">Requires Sponsorship</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Willing to Relocate</label>
                <select
                  name="willingToRelocate"
                  value={formData.willingToRelocate}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="Yes (Hybrid / Remote)">Yes (Hybrid / Remote)</option>
                  <option value="Yes (Anywhere in Country)">Yes (Anywhere in Country)</option>
                  <option value="No (Local Only)">No (Local Only)</option>
                  <option value="Remote Only">Remote Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Professional Background, Education & Skills */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>3. Skills, Background & Education</span>
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Core Competencies & Technical Skills
                </label>
                <input
                  type="text"
                  name="skills"
                  placeholder="e.g. TypeScript, React, Python, PostgreSQL, AWS, Docker"
                  value={formData.skills}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Comma-separated list of technical skills shown as badges in applicant profile.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Professional Summary</label>
                <textarea
                  name="summary"
                  rows={3}
                  placeholder="Enter a brief executive bio or candidate summary..."
                  value={formData.summary}
                  onChange={handleChange}
                  className="w-full p-3 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Highest Degree</label>
                  <input
                    type="text"
                    name="educationDegree"
                    placeholder="e.g. B.S. in Computer Science"
                    value={formData.educationDegree}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">College / University</label>
                  <input
                    type="text"
                    name="educationInstitution"
                    placeholder="e.g. University of Toronto"
                    value={formData.educationInstitution}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Graduation Year</label>
                  <input
                    type="text"
                    name="educationYear"
                    placeholder="e.g. 2018"
                    value={formData.educationYear}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Certifications & Accreditations
                </label>
                <input
                  type="text"
                  name="certifications"
                  placeholder="e.g. AWS Solutions Architect, PMI-ACP, Certified Scrum Master"
                  value={formData.certifications}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Resume & CV Document (At Bottom) */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>4. Resume & CV Attachment</span>
              </h2>
              {resumeFile ? (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Resume Attached
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Resume</span>
                </button>
              )}
            </div>

            {!resumeFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5 shadow-2xs">
                  <UploadCloud className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs font-bold text-slate-800 mb-1">
                  Drop candidate resume here, or click to browse
                </p>
                <p className="text-[11px] text-slate-500 mb-3">
                  Accepts PDF, DOC, DOCX, RTF, or TXT (up to 25 MB)
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploadingResume}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-all"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isUploadingResume ? 'Attaching Resume…' : 'Add Resume'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                    {resumeFile.name.split('.').pop() || 'DOC'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{resumeFile.name}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.2 rounded">
                        {resumeFile.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Uploaded at {resumeFile.uploadedAt} • Saved with candidate profile
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>Change Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded cursor-pointer transition-colors shadow-2xs"
                    title="Remove attached resume"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={openImmediately}
                  onChange={(e) => setOpenImmediately(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="font-medium">
                  Open candidate profile panel immediately after saving
                </span>
              </label>

              {resumeFile && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="max-w-[120px] truncate">{resumeFile.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Add Resume Button at the bottom */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingResume}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 font-semibold rounded text-xs cursor-pointer transition-colors shadow-2xs"
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                <span>{resumeFile ? 'Change Resume' : 'Add Resume'}</span>
              </button>

              <button
                type="button"
                onClick={onBack}
                className="px-4 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded text-xs cursor-pointer transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-[#0b5ed7] hover:bg-[#1467d6] text-white font-semibold rounded text-xs cursor-pointer shadow-xs transition-all disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating Applicant Profile…' : 'Create Applicant Profile'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
