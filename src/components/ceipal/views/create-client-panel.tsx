import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Phone,
  Globe,
  UserCheck,
  ShieldCheck,
  Save,
  Loader2,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { ClientItem } from '../types';

interface CreateClientPanelProps {
  onBack: () => void;
  onCreated?: (client: ClientItem) => void;
}

export const CreateClientPanel: React.FC<CreateClientPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { addClient } = useCeipal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    website: '',
    industry: 'Information Technology',
    status: 'Active',
    category: 'Direct Client',
    primaryOwner: 'Megan Davis',
    businessUnit: 'Venus Consultancy',
    displayOnJob: 'Yes',
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
      setErrorMessage('Client Name is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const newClientData: Omit<ClientItem, 'id'> = {
        name: formData.name.trim(),
        contactNumber: formData.contactNumber.trim(),
        website: formData.website.trim(),
        industry: formData.industry.trim(),
        status: formData.status,
        category: formData.category.trim(),
        primaryOwner: formData.primaryOwner.trim(),
        businessUnit: formData.businessUnit.trim(),
        displayOnJob: formData.displayOnJob,
        createdBy: 'Megan Davis',
        hasBadge: false,
      };

      await addClient(newClientData);
      toast.success(`Client account "${formData.name.trim()}" created successfully!`);

      if (onCreated) {
        onCreated({
          ...newClientData,
          id: `client-${Date.now()}`,
        });
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to create client:', err);
      const msg = err?.message || 'Could not add this client. Please try again.';
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
            <span>Back to Clients</span>
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Client</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Add Client Account</span>
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
            <span>{isSubmitting ? 'Saving…' : 'Save Client'}</span>
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

        {/* Section 1: Client Account Profile */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Client Profile</h3>
              <p className="text-[11px] text-slate-500">Legal entity name, commercial classification, and status</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Royal Bank Corp"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g. Direct, MSP, VMS"
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
                placeholder="e.g. Information Technology, Financial Services"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Prospect">Prospect</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Communication */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact & Web Presence</h3>
              <p className="text-[11px] text-slate-500">Official channels and telephone contact numbers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Number</label>
              <input
                type="text"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="+1 (416) 555-0100"
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
                placeholder="https://example.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Internal Account Governance */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Account Governance</h3>
              <p className="text-[11px] text-slate-500">Internal ownership and requisition visibility</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Primary Owner</label>
              <input
                type="text"
                name="primaryOwner"
                value={formData.primaryOwner}
                onChange={handleChange}
                placeholder="e.g. Megan Davis"
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
                placeholder="e.g. Venus Consultancy"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Display on Job Requisition</label>
              <select
                name="displayOnJob"
                value={formData.displayOnJob}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Yes">Yes (Visible)</option>
                <option value="No">No (Confidential)</option>
              </select>
            </div>
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
            <span>{isSubmitting ? 'Saving…' : 'Save Client'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
