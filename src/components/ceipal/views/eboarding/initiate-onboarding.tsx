import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Plus,
  Trash2,
  FileCheck,
  Send,
  Save,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useCeipal } from '../../ceipal-context';

export const InitiateOnboardingView: React.FC = () => {
  const { addEboarding, setEboardingSubModule, setEboardingStatusFilter } = useCeipal();

  // 3-step state: 1 = Fill Details, 2 = Add Checklist, 3 = Initiate Onboarding
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State: General
  const [businessUnit, setBusinessUnit] = useState('Venus Consultancy');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Canada');
  const [stateVal, setStateVal] = useState('Ontario');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dateOfJoin, setDateOfJoin] = useState('2026-03-01');
  const [employmentType, setEmploymentType] = useState('Employee');
  const [streetAddress, setStreetAddress] = useState('');
  const [onboardingCode, setOnboardingCode] = useState('OB-2026-09');
  const [alternateEmail, setAlternateEmail] = useState('');
  const [comments, setComments] = useState('');

  // Form State: Placement
  const [jobTitle, setJobTitle] = useState('Senior Full Stack Developer');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2027-03-01');
  const [vendor, setVendor] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [client, setClient] = useState('Niagara Health');
  const [billRate, setBillRate] = useState('$85.00/hr');
  const [payRate, setPayRate] = useState('$65.00/hr');
  const [placementType, setPlacementType] = useState('Full-Time');
  const [taxTerms, setTaxTerms] = useState('W2');

  // Checklist Items (Step 2)
  const [checklists, setChecklists] = useState<Array<{ id: string; name: string; completed: boolean }>>([
    { id: '1', name: 'Signed Offer Letter & Employment Agreement', completed: true },
    { id: '2', name: 'Government ID & Work Authorization (I-9 / Sin / PR)', completed: true },
    { id: '3', name: 'Direct Deposit Form & Void Cheque', completed: true },
    { id: '4', name: 'Background Verification & Reference Consent', completed: false },
    { id: '5', name: 'Emergency Contact Information', completed: false },
  ]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Submission state -- Save as draft / Initiate Onboarding both write to
  // the backend now, so both need a way to fail visibly instead of silently
  // pretending to succeed.
  const [isSubmittingEboarding, setIsSubmittingEboarding] = useState(false);
  const [eboardingSubmitError, setEboardingSubmitError] = useState<string | null>(null);

  // Validation
  const validateStep1 = () => {
    if (!businessUnit) return false;
    if (!firstName.trim() || !lastName.trim()) return false;
    if (!phoneNumber.trim() || !email.trim()) return false;
    if (!country.trim() || !stateVal.trim()) return false;
    if (!dateOfJoin) return false;
    return true;
  };

  const handleSaveAsDraft = async () => {
    setEboardingSubmitError(null);
    setIsSubmittingEboarding(true);
    const fullName = `${firstName.trim() || 'Untitled'} ${lastName.trim()}`.trim();
    try {
      await addEboarding({
        name: fullName,
        email: email || 'draft@example.com',
        jobTitle: jobTitle || 'Position Pending',
        phone: phoneNumber || 'N/A',
        initiatedOn: new Date().toISOString().split('T')[0],
        joiningDate: dateOfJoin || 'Pending',
        taxTerms: taxTerms || 'W2',
        vendorName: vendor,
        vendorEmail: vendorEmail,
        atsBu: businessUnit,
        status: 'Draft',
        comments,
        client,
        billRate,
        payRate,
        placementType,
        checklists,
      });
    } catch {
      setEboardingSubmitError('Could not save this draft. Please try again.');
      return;
    } finally {
      setIsSubmittingEboarding(false);
    }
    setEboardingStatusFilter('Draft');
    setEboardingSubModule('dashboard');
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateStep1()) {
        alert('Please fill in all required fields marked with * before proceeding.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleFinalSubmit = async () => {
    setEboardingSubmitError(null);
    setIsSubmittingEboarding(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    try {
      await addEboarding({
        name: fullName,
        email,
        jobTitle,
        phone: phoneNumber,
        initiatedOn: new Date().toISOString().split('T')[0],
        joiningDate: dateOfJoin,
        taxTerms,
        vendorName: vendor,
        vendorEmail,
        atsBu: businessUnit,
        status: 'Initiated',
        gender,
        country,
        state: stateVal,
        city,
        zipCode,
        employmentType,
        streetAddress,
        onboardingCode,
        alternateEmail,
        comments,
        client,
        billRate,
        payRate,
        placementType,
        checklists,
      });
    } catch {
      setEboardingSubmitError('Could not initiate onboarding. Please try again.');
      return;
    } finally {
      setIsSubmittingEboarding(false);
    }
    setEboardingStatusFilter('Initiated');
    setEboardingSubModule('dashboard');
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklists((prev) => [
      ...prev,
      { id: `${Date.now()}`, name: newChecklistText.trim(), completed: false },
    ]);
    setNewChecklistText('');
  };

  return (
    <div className="bg-[#eef1f6] min-h-[calc(100vh-60px)] flex flex-col text-slate-800 text-xs">
      {/* Top Step Progress Bar */}
      <div className="bg-white border-b border-[#e2e6ec] py-4 px-6 shadow-xs select-none">
        <div className="max-w-2xl mx-auto flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
              }}
            />
          </div>

          {/* Step 1: Fill Details */}
          <div className="relative z-10 flex flex-col items-center bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-colors ${
                currentStep >= 1
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-slate-300 text-slate-400 bg-white'
              }`}
            >
              ✏
            </div>
            <span
              className={`mt-1.5 text-xs font-semibold ${
                currentStep === 1 ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              Fill Details
            </span>
          </div>

          {/* Step 2: Add Checklist */}
          <div className="relative z-10 flex flex-col items-center bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-colors ${
                currentStep >= 2
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-slate-300 text-slate-400 bg-white'
              }`}
            >
              ✓
            </div>
            <span
              className={`mt-1.5 text-xs font-semibold ${
                currentStep === 2 ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              Add Checklist
            </span>
          </div>

          {/* Step 3: Initiate Onboarding */}
          <div className="relative z-10 flex flex-col items-center bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-colors ${
                currentStep === 3
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-slate-300 text-slate-400 bg-white'
              }`}
            >
              👍
            </div>
            <span
              className={`mt-1.5 text-xs font-semibold ${
                currentStep === 3 ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              Initiate Onboarding
            </span>
          </div>
        </div>
      </div>

      {/* Main Wizard Form Body */}
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full pb-20">
        {currentStep === 1 && (
          <div className="space-y-4">
            {/* Form Section: "General" */}
            <div className="bg-white rounded-md border border-[#e2e6ec] p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                General
              </h3>

              {/* Business unit (ATS) * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business unit (ATS) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={businessUnit}
                  onChange={(e) => setBusinessUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="Venus Consultancy">Venus Consultancy</option>
                  <option value="Venus IT Services">Venus IT Services</option>
                </select>
              </div>

              {/* Row of 4: First Name * | Middle Name | Last Name * | Gender */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    placeholder="Middle Name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <div className="flex items-center gap-4 py-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="Male"
                        checked={gender === 'Male'}
                        onChange={() => setGender('Male')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Male</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="Female"
                        checked={gender === 'Female'}
                        onChange={() => setGender('Female')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Female</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row of 4: Phone Number * | Email * | Country * | State * */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+1 (416) 555-0199"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="candidate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={stateVal}
                    onChange={(e) => setStateVal(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Row of 4: City/Zip | Date of Join * | Employment Type | Street Address */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Zip</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="Zip"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date of Join <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={dateOfJoin}
                      onChange={(e) => setDateOfJoin(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor (C2C)</option>
                    <option value="W2 Hourly">W2 Hourly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                  <textarea
                    rows={2}
                    placeholder="Street Address..."
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded resize-y"
                  />
                </div>
              </div>

              {/* Row of 3: Onboarding Code | Alternate Email | Comments */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Onboarding Code</label>
                  <input
                    type="text"
                    value={onboardingCode}
                    onChange={(e) => setOnboardingCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alternate Email</label>
                  <input
                    type="email"
                    placeholder="alt@example.com"
                    value={alternateEmail}
                    onChange={(e) => setAlternateEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Comments</label>
                  <textarea
                    rows={2}
                    placeholder="Additional notes for HR & verification..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Form Section: "Placement" (normally scrolling continuation) */}
            <div className="bg-white rounded-md border border-[#e2e6ec] p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Placement Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Client</label>
                  <select
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="Niagara Health">Niagara Health</option>
                    <option value="Venus Consultancy">Venus Consultancy</option>
                    <option value="IG">IG</option>
                    <option value="Cliantha">Cliantha</option>
                    <option value="OnPrem">OnPrem</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor (if any)</label>
                  <input
                    type="text"
                    placeholder="Vendor Name"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor Email</label>
                  <input
                    type="email"
                    placeholder="vendor@company.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Client Bill Rate</label>
                  <input
                    type="text"
                    value={billRate}
                    onChange={(e) => setBillRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pay Rate</label>
                  <input
                    type="text"
                    value={payRate}
                    onChange={(e) => setPayRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placement Type</label>
                  <select
                    value={placementType}
                    onChange={(e) => setPlacementType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Right-to-Hire">Right-to-Hire</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Terms</label>
                  <select
                    value={taxTerms}
                    onChange={(e) => setTaxTerms(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="W2">W2</option>
                    <option value="C2C">Corp-to-Corp (C2C)</option>
                    <option value="1099">1099</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Add Checklist */}
        {currentStep === 2 && (
          <div className="bg-white rounded-md border border-[#e2e6ec] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Onboarding Checklist</h3>
                <p className="text-slate-500 text-[11px]">
                  Configure verification requirements and compliance items for {firstName} {lastName}
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {checklists.filter((c) => c.completed).length} of {checklists.length} Included
              </span>
            </div>

            <form onSubmit={handleAddChecklist} className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom compliance requirement..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#0b5ed7] hover:bg-[#1467d6] text-white rounded font-medium flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </form>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded">
              {checklists.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => {
                        setChecklists((prev) =>
                          prev.map((c) => (c.id === item.id ? { ...c, completed: !c.completed } : c))
                        );
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className={`text-xs ${item.completed ? 'font-medium text-slate-800' : 'text-slate-500 line-through'}`}>
                      {item.name}
                    </span>
                  </label>
                  <button
                    onClick={() => setChecklists((prev) => prev.filter((c) => c.id !== item.id))}
                    className="text-slate-300 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Initiate Onboarding Confirmation */}
        {currentStep === 3 && (
          <div className="bg-white rounded-md border border-[#e2e6ec] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Review & Initiate Onboarding Packet
            </h3>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate</span>
                <p className="font-semibold text-slate-900 text-sm">{firstName} {lastName}</p>
                <p className="text-slate-600">{email} • {phoneNumber}</p>
                <p className="text-slate-500">{city}, {stateVal}, {country}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Placement</span>
                <p className="font-semibold text-slate-900">{jobTitle}</p>
                <p className="text-slate-600">Client: <strong>{client}</strong> | BU: <strong>{businessUnit}</strong></p>
                <p className="text-slate-500">Start Date: <strong>{dateOfJoin}</strong> • Tax Terms: <strong>{taxTerms}</strong></p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900">
              <p className="font-semibold mb-1">Verification Packet Actions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800">
                <li>A secure eBoarding portal link will be emailed to {email}</li>
                <li>Status will transition to <strong>Initiated</strong></li>
                <li>{checklists.filter((c) => c.completed).length} compliance checklist documents required</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#cbd5e1] px-6 py-2.5 shadow-lg flex items-center justify-between z-30 select-none">
        {/* Far Left: Activities link button */}
        <button
          onClick={() => alert('Onboarding audit activity log')}
          className="text-xs font-semibold text-[#1467d6] hover:underline"
        >
          Activities
        </button>

        {/* Center / Right Buttons: Cancel — Save as draft — Next / Initiate */}
        <div className="flex items-center gap-2">
          {eboardingSubmitError && (
            <span className="text-destructive font-medium mr-1">{eboardingSubmitError}</span>
          )}

          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-50 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          <button
            type="button"
            onClick={() => setEboardingSubModule('dashboard')}
            className="px-3.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAsDraft}
            disabled={isSubmittingEboarding}
            className="px-3.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-50 flex items-center gap-1 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" /> {isSubmittingEboarding ? 'Saving…' : 'Save as draft'}
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded font-semibold shadow-xs flex items-center gap-1 hover:opacity-90"
              style={{ backgroundColor: '#0b5ed7', color: '#ffffff' }}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmittingEboarding}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingEboarding ? 'Submitting…' : 'Initiate Onboarding'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
