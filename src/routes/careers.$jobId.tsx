import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Award,
  Share2,
  Check,
  Copy,
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ShieldCheck,
  Send,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getOpenJobPosting,
  submitApplication,
  uploadApplicationResume,
  type PublicJobPosting,
} from "@/lib/api/careers";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/careers/$jobId")({
  head: () => ({
    meta: [
      { title: "Apply — Venus Global Tech Careers" },
      {
        name: "description",
        content: "Apply directly to Venus Global Tech. Direct candidate review with fast 48-hour response.",
      },
    ],
  }),
  component: CareersJobDetailPage,
});

function useLightPageChrome() {
  useEffect(() => {
    const { body } = document;
    const previousBg = body.style.backgroundColor;
    const previousColor = body.style.color;
    body.style.backgroundColor = "#faf9f6";
    body.style.color = "#0f172a";
    return () => {
      body.style.backgroundColor = previousBg;
      body.style.color = previousColor;
    };
  }, []);
}

function useApplicationSource(): string {
  return useMemo(() => {
    if (typeof window === "undefined") return "careers_site";
    return new URLSearchParams(window.location.search).get("source") || "careers_site";
  }, []);
}

function useJobPostingJsonLd(job: PublicJobPosting) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: job.title,
      description: job.description ?? job.title,
      datePosted: job.createdAt,
      employmentType: job.employmentType,
      hiringOrganization: {
        "@type": "Organization",
        name: "Venus Global Tech",
        sameAs: typeof window !== "undefined" ? window.location.origin : "https://venusglobaltech.com",
      },
      jobLocation: job.location
        ? {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.location.replace(/^\[|\]$/g, "") },
          }
        : undefined,
      baseSalary: job.budgetMin
        ? {
            "@type": "MonetaryAmount",
            currency: job.currency || "USD",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.budgetMin,
              maxValue: job.budgetMax || job.budgetMin,
              unitText:
                job.salaryPeriod === "HOURLY"
                  ? "HOUR"
                  : job.salaryPeriod === "MONTHLY"
                  ? "MONTH"
                  : job.salaryPeriod === "YEARLY"
                  ? "YEAR"
                  : job.budgetMin < 1000
                  ? "HOUR"
                  : "YEAR",
            },
          }
        : undefined,
    });
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [job]);
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string = "USD",
  salaryPeriod?: string
): string | null {
  if (!min && !max) return null;
  const currSymbol = currency === "USD" ? "$" : `${currency} `;
  const period = (salaryPeriod || "").toUpperCase();
  const unitSuffix =
    period === "HOURLY"
      ? " / hr"
      : period === "MONTHLY"
      ? " / mo"
      : period === "YEARLY"
      ? " / yr"
      : min && min < 1000
      ? " / hr"
      : " / yr";

  const isHourly = unitSuffix === " / hr";
  const fmt = (v: number) => (isHourly ? String(v) : v.toLocaleString("en-US"));

  if (min && max && min !== max) {
    return `${currSymbol}${fmt(min)} - ${currSymbol}${fmt(max)}${unitSuffix}`;
  }
  const val = (min || max)!;
  return `${currSymbol}${fmt(val)}${unitSuffix}`;
}

function CareersJobDetailPage() {
  useLightPageChrome();
  const { jobId } = useParams({ from: "/careers/$jobId" });
  const source = useApplicationSource();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["careers", "jobs", jobId],
    queryFn: () => getOpenJobPosting(jobId),
  });

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-[#faf9f6]/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link to="/careers" className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white font-extrabold flex items-center justify-center shadow-md shadow-indigo-600/20 text-base">
              V
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Venus Global Tech
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Careers Portal
              </span>
            </div>
          </Link>

          <Link
            to="/careers"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>All Open Positions</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {isLoading && (
          <div className="py-24 text-center space-y-3">
            <div className="inline-block size-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading role details...</p>
          </div>
        )}

        {isError && (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-10 space-y-4 max-w-lg mx-auto shadow-xs">
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">This role is no longer available</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              This position may have been filled or closed. Please explore our other open career opportunities.
            </p>
            <Link
              to="/careers"
              className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
            >
              Browse All Open Positions
            </Link>
          </div>
        )}

        {job && <JobDetailView job={job} source={source} />}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-[#faf9f6] py-10 px-4 sm:px-6 text-xs text-slate-500 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              V
            </div>
            <span className="font-semibold text-slate-800">Venus Global Tech Inc.</span>
            <span>— All rights reserved.</span>
          </div>

          <p className="text-slate-400 text-center sm:text-right">
            Venus Global Tech is an Equal Opportunity Employer.
          </p>
        </div>
      </footer>
    </div>
  );
}

function JobDetailView({ job, source }: { job: PublicJobPosting; source: string }) {
  useJobPostingJsonLd(job);

  const [copiedLink, setCopiedLink] = useState(false);
  const salaryText = formatSalary(job.budgetMin, job.budgetMax, job.currency, job.salaryPeriod);
  const cleanLocation = job.location
    ? job.location.replace(/^\[|\]$/g, "").trim()
    : "Remote / Multiple Locations";

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Job link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareLinkedIn = () => {
    const shareUrl = encodeURIComponent(`${window.location.origin}/careers/${job.id}?source=linkedin`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, "_blank");
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Check out this job opening for "${job.title}" at Venus Global Tech: ${window.location.origin}/careers/${job.id}?source=whatsapp`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-8">
      {/* ── Header Badge Row ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {job.hiringDepartment?.name && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {job.hiringDepartment.name}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
              {job.employmentType.toLowerCase().replace(/_/g, " ")}
            </span>
            {job.jobCode && (
              <span className="text-xs font-mono text-slate-400 font-medium">
                {job.jobCode}
              </span>
            )}
          </div>

          {/* Social Share Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs transition-all"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-500" />}
              <span>{copiedLink ? "Copied" : "Copy Link"}</span>
            </button>
            <button
              onClick={handleShareLinkedIn}
              className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-xs font-bold text-blue-700 cursor-pointer shadow-2xs transition-all"
            >
              Share on LinkedIn
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-xs font-bold text-emerald-700 cursor-pointer shadow-2xs transition-all"
            >
              WhatsApp
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight">
            {job.title}
          </h1>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600 mt-4">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 text-slate-400 shrink-0" />
              <span className="font-medium">{cleanLocation}</span>
            </div>

            {salaryText && (
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                <DollarSign className="size-4 shrink-0" />
                <span>{salaryText}</span>
              </div>
            )}

            {job.minExperienceYears > 0 && (
              <div className="flex items-center gap-1.5">
                <Award className="size-4 text-slate-400 shrink-0" />
                <span>{job.minExperienceYears}+ Years Experience</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="size-4 shrink-0" />
              <span>Direct Team Review</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout: Job Specs (Left) & Application Form (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Job Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Overview & Description */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Role Overview &amp; Responsibilities
            </h2>

            {job.description ? (
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line space-y-4">
                {job.description}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Detailed description not provided for this requisition. Please review required skills below.
              </p>
            )}

            {/* Required Skills */}
            {job.skillsRequired && job.skillsRequired.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Required Technologies &amp; Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.skillsRequired.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* About Venus Global Tech */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="size-4 text-indigo-600" />
              <span>About Working at Venus Global Tech</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Venus Global Tech is a premier technology consulting and enterprise systems partner.
              We design, build, and support high-performance software for Fortune 500 enterprises and
              high-growth companies globally. We pride ourselves on engineering excellence, meritocracy,
              and a supportive, transparent work culture.
            </p>
          </div>
        </div>

        {/* Right: Direct Application Form */}
        <div className="lg:col-span-5 sticky top-24">
          <ApplicationFormPanel job={job} source={source} />
        </div>
      </div>
    </div>
  );
}

function ApplicationFormPanel({ job, source }: { job: PublicJobPosting; source: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File exceeds 25MB limit. Please upload a smaller resume.");
        return;
      }
      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      let resumeUrl: string | undefined;
      if (resumeFile) {
        const uploadRes = await uploadApplicationResume(resumeFile);
        resumeUrl = uploadRes.url;
      }

      await submitApplication({
        jobPostingId: job.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        resumeUrl,
        source,
        honeypot: honeypot || undefined,
      });

      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong submitting your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!submitted) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = "https://www.linkedin.com";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  if (submitted) {
    return (
      <div className="bg-white rounded-3xl border border-emerald-200/90 p-8 shadow-sm text-center space-y-5 animate-in fade-in duration-300">
        <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="size-9" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-slate-900">Application Submitted!</h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            Thank you for applying for the <strong className="text-slate-900">{job.title}</strong> role at Venus Global Tech.
            Our talent acquisition team has received your application and resume.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 max-w-sm mx-auto">
          <p className="text-xs font-semibold text-slate-700">
            Redirecting you back to LinkedIn in{" "}
            <span className="font-extrabold text-indigo-600 text-sm">{countdown}s</span>...
          </p>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((4 - countdown) / 3) * 100}%` }}
            />
          </div>
        </div>

        <div className="pt-1">
          <a
            href="https://www.linkedin.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0a66c2] hover:bg-[#004182] shadow-sm transition-all"
          >
            <span>Return to LinkedIn Now</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-sm space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Apply for This Position</h2>
          {source && source !== "careers_site" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
              Via {source}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Takes under 2 minutes. No account or password required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Spam Protection Honeypot */}
        <input
          type="text"
          name="verification_token_5x9"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="opacity-0 absolute -left-[9999px] pointer-events-none"
          aria-hidden="true"
        />

        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              First Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.doe@example.com"
            className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">
            Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
          />
        </div>

        {/* Resume Upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Resume / CV <span className="text-slate-400 font-normal">(PDF, DOCX up to 25MB)</span>
          </label>

          {resumeFile ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 text-indigo-600 shrink-0" />
                <span className="truncate font-semibold text-slate-800">{resumeFile.name}</span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  ({(resumeFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResumeFile(null)}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                title="Remove resume"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl cursor-pointer bg-slate-50/40 hover:bg-indigo-50/20 transition-all group">
              <UploadCloud className="size-6 text-slate-400 group-hover:text-indigo-600 mb-1 transition-colors" />
              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                Click to attach resume
              </span>
              <span className="text-[10px] text-slate-400">PDF, DOC, DOCX up to 25MB</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Submitting Application...</span>
            </>
          ) : (
            <>
              <Send className="size-3.5" />
              <span>Submit Application</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          By submitting, your details will be delivered directly to Venus Global Tech's hiring team.
        </p>
      </form>
    </div>
  );
}
