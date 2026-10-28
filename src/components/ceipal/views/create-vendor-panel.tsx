import React, { useState } from 'react';
import {
  ArrowLeft,
  Building,
  Phone,
  Globe,
  Mail,
  User,
  Shield,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCeipal } from '../ceipal-context';
import { VendorItem } from '../types';

interface CreateVendorPanelProps {
  onBack: () => void;
  onCreated?: (vendor: VendorItem) => void;
}

export const CreateVendorPanel: React.FC<CreateVendorPanelProps> = ({
  onBack,
  onCreated,
}) => {
  const { addVendor } = useCeipal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    website: '',
    contactNumber: '',
    contactPerson: '',
    email: '',
    category: 'Staffing Supplier',
    state: 'ON',
    country: 'Canada',
    ownership: 'Partnership',
    businessUnit: 'Venus Consultancy',
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
      setErrorMessage('Vendor Name is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const today = new Date().toISOString().split('T')[0];

    try {
      const newVendorData: Omit<VendorItem, 'id'> = {
        name: formData.name.trim(),
        website: formData.website.trim(),
        contactNumber: formData.contactNumber.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
        category: formData.category.trim() || undefined,
        state: formData.state.trim(),
        country: formData.country.trim(),
        ownership: formData.ownership.trim(),
        businessUnit: formData.businessUnit.trim(),
        createdBy: 'Megan Davis',
        createdOn: today,
        modifiedBy: 'Megan Davis',
        modifiedOn: today,
      };

      await addVendor(newVendorData);
      toast.success(`Vendor partner "${formData.name.trim()}" added successfully!`);

      if (onCreated) {
        onCreated({
          ...newVendorData,
          id: `vendor-${Date.now()}`,
        });
      } else {
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to create vendor:', err);
      const msg = err?.message || 'Could not add this vendor. Please try again.';
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
            <span>Back to Vendors</span>
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Vendors</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Add Vendor Partner</span>
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
            <span>{isSubmitting ? 'Saving…' : 'Save Vendor'}</span>
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

        {/* Section 1: Vendor Profile */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Vendor Partner Profile</h3>
              <p className="text-[11px] text-slate-500">Legal entity name, ownership model, and supplier category</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Vendor Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Apex Global Solutions"
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
                placeholder="e.g. Staffing Supplier, Subcontractor"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ownership Model</label>
              <select
                name="ownership"
                value={formData.ownership}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Partnership">Partnership</option>
                <option value="Corporation">Corporation</option>
                <option value="LLC">LLC</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
              </select>
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
          </div>
        </div>

        {/* Section 2: Contact Information & Representative */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact & Representatives</h3>
              <p className="text-[11px] text-slate-500">Contact person, email, and phone coordinates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                placeholder="e.g. Jonathan Clark"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="vendor@company.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
              <input
                type="text"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="+1 (555) 019-2831"
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
                placeholder="https://vendor.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Geographic Jurisdiction */}
        <div className="bg-white rounded border border-[#cbd5e1] shadow-2xs p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Jurisdiction & Location</h3>
              <p className="text-[11px] text-slate-500">Registered territory of operation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">State / Province</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. ON"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g. Canada"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
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
            <span>{isSubmitting ? 'Saving…' : 'Save Vendor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
