import React, { useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  DollarSign,
  Users,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { JobPostingItem } from '../types';
import { useRetryJobBoardListing } from '@/hooks/use-recruitment';

interface CreateJobPostingPanelProps {
  onBack: () => void;
  onCreated?: (job: JobPostingItem) => void;
}

export const CreateJobPostingPanel: React.FC<CreateJobPostingPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { jobs, addJob } = useCeipal();
  const retryListingMutation = useRetryJobBoardListing();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    jobTitle: '',
    client: '',
    businessUnit: 'Venus IT Services',
    clientJobId: '',
    locationCity: '',
    locationState: '',
    locationZip: '',
    states: '',
    clientBillRate: '',
    payRate: '',
    budgetMin: '',
    budgetMax: '',
    currency: 'USD',
    salaryPeriod: 'YEARLY',
    taxTerms: 'Full Time',
    jobType: 'Full Time',
    numberOfPositions: 1,
    primarySkills: '',
    experience: '',
    industry: 'Information Technology',
    clearance: 'No',
    recruitmentManager: '',
    assignedTo: '',
    description: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.jobTitle.trim()) {
      setErrorMessage('Job Title is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const nextNum = 100 + jobs.length + 1;
    const skillsArray = formData.primarySkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const locParts = [formData.locationCity, formData.locationState, formData.locationZip].filter(Boolean);
      const locStr = locParts.length > 0 ? `[${locParts.join(', ')}]` : '';

      const newJobData: Omit<JobPostingItem, 'id'> = {
        jobCode: `JPC-${nextNum}`,
        jobTitle: formData.jobTitle.trim(),
        businessUnit: formData.businessUnit.trim(),
        client: formData.client.trim(),
        clientJobId: formData.clientJobId.trim(),
        location: locStr,
        states: formData.states.trim(),
        jobStatus: 'Active',
        clientBillRate: formData.clientBillRate.trim(),
        payRate: formData.payRate.trim() || undefined,
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) : undefined,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) : undefined,
        currency: formData.currency || 'USD',
        salaryPeriod: formData.salaryPeriod || 'YEARLY',
        taxTerms: formData.taxTerms,
        jobType: formData.jobType,
        numberOfPositions: Number(formData.numberOfPositions) || 1,
        primarySkills: skillsArray.length > 0 ? skillsArray : undefined,
        experience: formData.experience.trim() || undefined,
        industry: formData.industry.trim() || undefined,
        clearance: formData.clearance,
        recruitmentManager: formData.recruitmentManager.trim() || undefined,
        assignedTo: formData.assignedTo.trim() || undefined,
        boardStatus: { linkedin: true, indeed: true, ziprecruiter: true, glassdoor: false },
        tags: ['New'],
        applicantsCount: 0,
        sources: ['user'],
        description: formData.description.trim() || undefined,
      };

      const created = await addJob(newJobData);
      toast.success(`Job posting "${formData.jobTitle.trim()}" created successfully!`);

      let updatedJob = created;
      if (newJobData.boardStatus?.linkedin && created?.id) {
        try {
          toast.loading("Publishing job opening to connected LinkedIn profile...", { id: "linkedin-auto-post" });
          const res = await retryListingMutation.mutateAsync({ jobPostingId: created.id, board: "LINKEDIN" as any });
          if (res && (res as any).status === "FAILED") {
            throw new Error((res as any).errorMessage || "Failed to publish to LinkedIn.");
          }
          if (res) {
            updatedJob = {
              ...created,
              boardListings: [
                ...(created.boardListings || []).filter((b: any) => b.board !== "LINKEDIN"),
                res,
              ],
            };
          }
          toast.success(`Job opening "${formData.jobTitle.trim()}" published live to LinkedIn!`, { id: "linkedin-auto-post" });
        } catch (err: any) {
          const errorMsg = err?.message || "Failed to publish to LinkedIn.";
          toast.error(`${errorMsg} (You can also click 'Post to LinkedIn' on the job page to retry)`, { id: "linkedin-auto-post", duration: 6000 });
        }
      }

      if (onCreated) {
        onCreated(updatedJob);
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to create job posting:', err);
      const msg = err?.message || 'Could not create the job posting. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800 animate-in fade-in duration-150">
      {/* Top Sticky Header */}
      <div className="bg-white border-b border-[#cbd5e1] shadow-2xs px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>Back to Job Postings</span>
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Job Postings</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Create New Job Posting</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? 'Saving…' : 'Create Job Posting'}</span>
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="p-4 max-w-5xl mx-auto w-full space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Section 1: Role & Requisition Overview */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Role & Requisition Details</h3>
              <p className="text-[11px] text-slate-500">Core requisition identity, title, and client association</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Job Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Client Job ID</label>
              <input
                type="text"
                name="clientJobId"
                value={formData.clientJobId}
                onChange={handleChange}
                placeholder="e.g. REQ-8480"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Client Name</label>
              <input
                type="text"
                name="client"
                value={formData.client}
                onChange={handleChange}
                placeholder="e.g. Royal Bank of Canada"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Business Unit</label>
              <input
                type="text"
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleChange}
                placeholder="e.g. Venus IT Services"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Industry</label>
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="e.g. Information Technology"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Security Clearance</label>
              <select
                name="clearance"
                value={formData.clearance}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="No">No Clearance Required</option>
                <option value="Reliability Status">Reliability Status</option>
                <option value="Secret">Secret</option>
                <option value="Top Secret">Top Secret</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Location & Geography */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Location & Region</h3>
              <p className="text-[11px] text-slate-500">Primary work site or territory</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">City</label>
              <input
                type="text"
                name="locationCity"
                value={formData.locationCity}
                onChange={handleChange}
                placeholder="e.g. Toronto"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">State / Province</label>
              <input
                type="text"
                name="locationState"
                value={formData.locationState}
                onChange={handleChange}
                placeholder="e.g. ON"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Zip / Postal Code</label>
              <input
                type="text"
                name="locationZip"
                value={formData.locationZip}
                onChange={handleChange}
                placeholder="e.g. M5V 2T6"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Region / States</label>
              <input
                type="text"
                name="states"
                value={formData.states}
                onChange={handleChange}
                placeholder="e.g. Ontario, Canada"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Rates, Compensation & Terms */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Rates, Terms & Staffing</h3>
              <p className="text-[11px] text-slate-500">Bill and pay specifications, job classifications, and capacity</p>
            </div>
          </div>

          {/* Salary Range & Compensation Controls */}
          <div className="crm-form-row grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded mb-4 text-xs">
            {/* Minimum Budget / Salary */}
            <div className="crm-form-group">
              <label htmlFor="budgetMin" className="block text-slate-700 font-semibold mb-1">Min Salary</label>
              <input
                type="number"
                id="budgetMin"
                name="budgetMin"
                placeholder="e.g. 65000"
                value={formData.budgetMin || ''}
                onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value ? (Number(e.target.value) as any) : '' })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                value={formData.budgetMax || ''}
                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? (Number(e.target.value) as any) : '' })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {/* Currency */}
            <div className="crm-form-group">
              <label htmlFor="currency" className="block text-slate-700 font-semibold mb-1">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency || 'USD'}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                value={formData.salaryPeriod || 'YEARLY'}
                onChange={(e) => setFormData({ ...formData, salaryPeriod: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="YEARLY">Per Year (/yr)</option>
                <option value="MONTHLY">Per Month (/mo)</option>
                <option value="HOURLY">Per Hour (/hr)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Client Bill Rate</label>
              <input
                type="text"
                name="clientBillRate"
                value={formData.clientBillRate}
                onChange={handleChange}
                placeholder="e.g. $85.00/hr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Pay Rate / Salary</label>
              <input
                type="text"
                name="payRate"
                value={formData.payRate}
                onChange={handleChange}
                placeholder="e.g. $65.00/hr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tax Terms</label>
              <select
                name="taxTerms"
                value={formData.taxTerms}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Full Time">Full Time</option>
                <option value="W2">W2</option>
                <option value="C2C">C2C</option>
                <option value="1099">1099</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Job Type</label>
              <select
                name="jobType"
                value={formData.jobType}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Full Time">Full Time</option>
                <option value="Contract">Contract</option>
                <option value="Contract to Hire">Contract to Hire</option>
                <option value="Part Time">Part Time</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Open Positions</label>
              <input
                type="number"
                min={1}
                name="numberOfPositions"
                value={formData.numberOfPositions}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Experience Required</label>
              <input
                type="text"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="e.g. 5+ Years"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Team Assignment */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Team Assignment</h3>
              <p className="text-[11px] text-slate-500">Internal stakeholders handling this position</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Recruitment Manager <span className="text-slate-400 font-normal">(Auto-notified on application)</span>
              </label>
              <input
                type="text"
                name="recruitmentManager"
                list="recruitment-managers-list"
                value={formData.recruitmentManager}
                onChange={handleChange}
                placeholder="e.g. Megan Foster (megan@venushiring.ca)"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="recruitment-managers-list">
                <option value="Megan Foster <megan@venushiring.ca>">Megan Foster (Recruitment Manager)</option>
                <option value="megan@venushiring.ca">megan@venushiring.ca</option>
              </datalist>
              <p className="text-[10px] text-slate-500 mt-1">
                Receives an official automated email with full applicant details whenever a candidate submits an application.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Assigned Recruiter <span className="text-slate-400 font-normal">(Auto-notified on application)</span>
              </label>
              <input
                type="text"
                name="assignedTo"
                list="assigned-recruiters-list"
                value={formData.assignedTo}
                onChange={handleChange}
                placeholder="e.g. Jane Doe (jane@yourcompany.com)"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="assigned-recruiters-list">
                <option value="Megan Foster <megan@venushiring.ca>">Megan Foster</option>
              </datalist>
              <p className="text-[10px] text-slate-500 mt-1">
                Assigned recruiter will also be automatically emailed candidate profile, resume, and fit scores.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Skills & Job Description */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Skills & Requirements</h3>
              <p className="text-[11px] text-slate-500">Primary candidate skills and full job description</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Primary Skills <span className="font-normal text-slate-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                name="primarySkills"
                value={formData.primarySkills}
                onChange={handleChange}
                placeholder="e.g. React, TypeScript, Node.js, Next.js, PostgreSQL"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Job Description & Responsibilities</label>
              <textarea
                name="description"
                rows={6}
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter role responsibilities, deliverables, required qualifications, and work mode..."
                className="w-full px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none font-sans"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 pb-8">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? 'Saving…' : 'Create Job Posting'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
