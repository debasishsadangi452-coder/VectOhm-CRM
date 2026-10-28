import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  User,
  Briefcase,
  Building,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { PlacementItem } from '../types';

interface RecordPlacementPanelProps {
  onBack: () => void;
  onCreated?: (placement: PlacementItem) => void;
}

export const RecordPlacementPanel: React.FC<RecordPlacementPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { addPlacement, jobs, customApplicants } = useCeipal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextCode = `PLC-${100 + Math.floor(Math.random() * 900)}`;

  const [formData, setFormData] = useState({
    applicantName: '',
    placementCode: nextCode,
    jobCode: 'JPC-102',
    jobTitle: 'Senior Java Full Stack Developer',
    placementType: 'Full-Time',
    clientPrimeVendor: 'Niagara Health',
    businessUnit: 'Venus Consultancy',
    clientBillRate: '$85.00/hr',
    payRate: '$65.00/hr',
    perDiemHr: '$0.00',
    overhead: '$5.00/hr',
    margin: '$15.00/hr',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJobSelect = (jobTitle: string) => {
    const matched = jobs.find((j) => j.jobTitle.toLowerCase() === jobTitle.toLowerCase());
    if (matched) {
      setFormData((prev) => ({
        ...prev,
        jobTitle: matched.jobTitle,
        jobCode: matched.jobCode,
        clientPrimeVendor: matched.client || prev.clientPrimeVendor,
        clientBillRate: matched.clientBillRate || prev.clientBillRate,
        payRate: matched.payRate || prev.payRate,
      }));
    } else {
      setFormData((prev) => ({ ...prev, jobTitle }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicantName.trim()) {
      setErrorMessage('Applicant Name is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const today = new Date().toISOString().split('T')[0];

    try {
      const newPlacementData: Omit<PlacementItem, 'id'> = {
        applicantName: formData.applicantName.trim(),
        placementCode: formData.placementCode.trim(),
        jobCode: formData.jobCode.trim(),
        jobTitle: formData.jobTitle.trim(),
        placementType: formData.placementType,
        clientPrimeVendor: formData.clientPrimeVendor.trim(),
        businessUnit: formData.businessUnit.trim(),
        clientBillRate: formData.clientBillRate.trim(),
        payRate: formData.payRate.trim(),
        perDiemHr: formData.perDiemHr.trim(),
        overhead: formData.overhead.trim(),
        margin: formData.margin.trim(),
        createdOn: today,
        createdBy: 'Megan Davis',
      };

      await addPlacement(newPlacementData);
      toast.success(`Placement record for "${formData.applicantName.trim()}" created successfully!`);

      if (onCreated) {
        onCreated({
          ...newPlacementData,
          id: `placement-${Date.now()}`,
        });
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to record placement:', err);
      const msg = err?.message || 'Could not save this placement. Please try again.';
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
            <span>Back to Placements</span>
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Placements</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Record Placement</span>
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
            <span>{isSubmitting ? 'Saving…' : 'Save Placement'}</span>
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="p-4 max-w-4xl mx-auto w-full space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Section 1: Candidate & Placement Identity */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Candidate & Placement Info</h3>
              <p className="text-[11px] text-slate-500">Applicant selection, placement code, and employment classification</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Applicant Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="applicants-list"
                name="applicantName"
                value={formData.applicantName}
                onChange={handleChange}
                placeholder="e.g. Emily Anderson"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="applicants-list">
                {customApplicants.map((app) => (
                  <option key={app.id} value={app.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Placement Code</label>
              <input
                type="text"
                name="placementCode"
                value={formData.placementCode}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Placement Type</label>
              <select
                name="placementType"
                value={formData.placementType}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Full-Time">Full-Time (Permanent)</option>
                <option value="Contract">Contract (C2C / W2)</option>
                <option value="Contract to Hire">Contract to Hire</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Business Unit</label>
              <input
                type="text"
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Requisition & Client Association */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Requisition & Client Details</h3>
              <p className="text-[11px] text-slate-500">Target role, client organization, and internal job code</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Job Title</label>
              <input
                type="text"
                list="jobs-list"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => handleJobSelect(e.target.value)}
                placeholder="e.g. Senior Java Full Stack Developer"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="jobs-list">
                {jobs.map((j) => (
                  <option key={j.id} value={j.jobTitle} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Job Code</label>
              <input
                type="text"
                name="jobCode"
                value={formData.jobCode}
                onChange={handleChange}
                placeholder="e.g. JPC-102"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Client / Prime Vendor</label>
              <input
                type="text"
                name="clientPrimeVendor"
                value={formData.clientPrimeVendor}
                onChange={handleChange}
                placeholder="e.g. Niagara Health"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Financials & Rate Breakdown */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Financial Breakdown & Margins</h3>
              <p className="text-[11px] text-slate-500">Bill rate, pay rate, per diem, overhead, and gross margins</p>
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
              <label className="block text-slate-700 font-semibold mb-1">Pay Rate</label>
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
              <label className="block text-slate-700 font-semibold mb-1">Per Diem / Hr</label>
              <input
                type="text"
                name="perDiemHr"
                value={formData.perDiemHr}
                onChange={handleChange}
                placeholder="e.g. $0.00"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Overhead Rate</label>
              <input
                type="text"
                name="overhead"
                value={formData.overhead}
                onChange={handleChange}
                placeholder="e.g. $5.00/hr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Gross Margin</label>
              <input
                type="text"
                name="margin"
                value={formData.margin}
                onChange={handleChange}
                placeholder="e.g. $15.00/hr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
            <span>{isSubmitting ? 'Saving…' : 'Save Placement'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
