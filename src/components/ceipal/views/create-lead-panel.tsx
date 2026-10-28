import React, { useState } from 'react';
import {
  ArrowLeft,
  UserCheck,
  Building,
  Phone,
  Globe,
  MapPin,
  Save,
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { LeadItem } from '../types';

interface CreateLeadPanelProps {
  onBack: () => void;
  onCreated?: (lead: LeadItem) => void;
}

export const CreateLeadPanel: React.FC<CreateLeadPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { addLead } = useCeipal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    status: 'Open',
    source: 'Website Form',
    website: '',
    contactNumber: '',
    email: '',
    businessUnit: 'Venus Consultancy',
    zipCode: 'M5V 2T6',
    notes: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Lead Name is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const today = new Date().toISOString().split('T')[0];

    try {
      const newLeadData: Omit<LeadItem, 'id'> = {
        name: formData.name.trim(),
        company: formData.company.trim() || undefined,
        status: formData.status,
        source: formData.source.trim(),
        website: formData.website.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        businessUnit: formData.businessUnit.trim(),
        zipCode: formData.zipCode.trim(),
        createdOn: today,
        createdBy: 'Megan Davis',
        leadAge: '0d',
        modifiedOn: today,
        lastActivity: formData.notes.trim() || 'Inquiry received',
      };

      await addLead(newLeadData);
      toast.success(`Lead "${formData.name.trim()}" created successfully!`);

      if (onCreated) {
        onCreated({
          ...newLeadData,
          id: `lead-${Date.now()}`,
        });
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to create lead:', err);
      const msg = err?.message || 'Could not add this lead. Please try again.';
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
            <span>Back to Leads</span>
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Leads</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Create New Lead</span>
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
            <span>{isSubmitting ? 'Saving…' : 'Save Lead'}</span>
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

        {/* Section 1: Lead Identity & Association */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lead Information</h3>
              <p className="text-[11px] text-slate-500">Contact person name, organization, status, and acquisition source</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Lead Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Acme Tech Solutions"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company / Organization</label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="e.g. Acme Corporation"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Lead Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Open">Open</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Unqualified">Unqualified</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Source</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="e.g. Website Form, LinkedIn Outreach, Referral"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Contact Coordinates */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact Details</h3>
              <p className="text-[11px] text-slate-500">Telephone coordinates and web address</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@company.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Number</label>
              <input
                type="text"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="+1 (416) 555-0199"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Website URL</label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://acme.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Territory & Organization */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Territory & Postal Code</h3>
              <p className="text-[11px] text-slate-500">Business unit assignment and postal geographic zone</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Business Unit</label>
              <input
                type="text"
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleChange}
                placeholder="e.g. Venus Consultancy"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Zip / Postal Code</label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="e.g. M5V 2T6"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Initial Inquiry & Activity Notes */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Initial Inquiry & Activity Notes</h3>
              <p className="text-[11px] text-slate-500">Context on the inquiry or initial discussion</p>
            </div>
          </div>

          <div className="text-xs">
            <textarea
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Record any details from the incoming inquiry, requirement summary, or next planned action..."
              className="w-full px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none font-sans"
            />
          </div>
        </div>

        {/* Bottom Action Buttons */}
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
            <span>{isSubmitting ? 'Saving…' : 'Save Lead'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
