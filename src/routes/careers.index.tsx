import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  MapPin,
  DollarSign,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  Clock,
  Building2,
  Users,
  Award,
  Zap,
  Globe,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { getOpenJobPostings, type PublicJobPosting } from "@/lib/api/careers";

export const Route = createFileRoute("/careers/")({
  head: () => ({
    meta: [
      { title: "Careers — Venus Global Tech | Build the Future of Enterprise Tech" },
      {
        name: "description",
        content:
          "Explore career opportunities at Venus Global Tech. Join our global team of engineers, innovators, and problem solvers. Direct applications, fast 48-hour response.",
      },
      {
        name: "keywords",
        content: "Venus Global Tech careers, software engineer jobs, IT consulting roles, tech careers",
      },
    ],
  }),
  component: CareersListPage,
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

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Posted today";
    if (diffDays === 1) return "Posted 1 day ago";
    if (diffDays < 30) return `Posted ${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return diffMonths === 1 ? "Posted 1 month ago" : `Posted ${diffMonths} months ago`;
  } catch {
    return "Recently posted";
  }
}

function CareersListPage() {
  useLightPageChrome();

  const { data: rawJobs = [], isLoading, isError } = useQuery({
    queryKey: ["careers", "jobs"],
    queryFn: getOpenJobPostings,
  });

  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");

  // Extract dynamic filters from live jobs
  const departments = useMemo(() => {
    const set = new Set<string>();
    rawJobs.forEach((j) => {
      if (j.hiringDepartment?.name) set.add(j.hiringDepartment.name);
    });
    return Array.from(set).sort();
  }, [rawJobs]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    rawJobs.forEach((j) => {
      if (j.location) {
        const cleanLoc = j.location.replace(/^\[|\]$/g, "").trim();
        if (cleanLoc) set.add(cleanLoc);
      }
    });
    return Array.from(set).sort();
  }, [rawJobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return rawJobs.filter((job) => {
      const matchKeyword =
        !searchKeyword.trim() ||
        job.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(searchKeyword.toLowerCase())) ||
        (job.skillsRequired &&
          job.skillsRequired.some((s) => s.toLowerCase().includes(searchKeyword.toLowerCase())));

      const matchDept =
        selectedDepartment === "ALL" || job.hiringDepartment?.name === selectedDepartment;

      const matchType =
        selectedType === "ALL" ||
        job.employmentType.toUpperCase().replace(/\s+/g, "_") === selectedType;

      const matchLoc =
        selectedLocation === "ALL" ||
        (job.location && job.location.includes(selectedLocation));

      return matchKeyword && matchDept && matchType && matchLoc;
    });
  }, [rawJobs, searchKeyword, selectedDepartment, selectedType, selectedLocation]);

  const hasActiveFilters =
    searchKeyword.trim() !== "" ||
    selectedDepartment !== "ALL" ||
    selectedType !== "ALL" ||
    selectedLocation !== "ALL";

  const handleClearFilters = () => {
    setSearchKeyword("");
    setSelectedDepartment("ALL");
    setSelectedType("ALL");
    setSelectedLocation("ALL");
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-[#faf9f6]/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#open-roles"
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Open Roles ({rawJobs.length})
            </a>
            <a
              href="#why-join"
              className="hidden sm:inline-block text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Culture &amp; Perks
            </a>
            <a
              href="#open-roles"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
            >
              Explore Positions
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 border-b border-slate-200/60 bg-gradient-to-b from-indigo-50/40 via-white/30 to-[#faf9f6]">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-100 shadow-xs text-xs font-semibold text-indigo-700">
            <Sparkles className="size-3.5 text-indigo-500 animate-pulse" />
            <span>We are hiring top talent globally</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
            Build the Future of <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 bg-clip-text text-transparent">
              Enterprise Intelligence
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Join a forward-thinking engineering and talent ecosystem solving complex enterprise
            challenges. Direct applications, transparent communication, and 48-hour recruiter reviews.
          </p>

          {/* Key Value Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-700">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Zap className="size-3.5 text-amber-500" />
              <span>48-Hour Application Turnaround</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Globe className="size-3.5 text-emerald-500" />
              <span>Remote &amp; Hybrid Friendly</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <ShieldCheck className="size-3.5 text-indigo-500" />
              <span>Direct Team Review — No Bots</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Open Roles Section ── */}
      <section id="open-roles" className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Open Positions
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Showing{" "}
              <strong className="text-slate-900 font-bold">
                {isLoading ? "..." : filteredJobs.length}
              </strong>{" "}
              opportunities available right now
            </p>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline self-start md:self-auto cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 mb-8 flex flex-col md:flex-row gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Search by title, skills (e.g. React, Java, Cloud)..."
              className="w-full h-10 pl-10 pr-4 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {/* Employment Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Employment Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="CONTRACT">Contract / C2C / W2</option>
            <option value="PART_TIME">Part Time</option>
          </select>

          {/* Location Filter */}
          {locations.length > 0 && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Job List States ── */}
        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block size-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading open career positions...</p>
          </div>
        )}

        {isError && (
          <div className="py-16 text-center bg-rose-50 rounded-2xl border border-rose-200 p-8 space-y-3 max-w-lg mx-auto">
            <p className="text-sm font-bold text-rose-800">
              Unable to load career listings at this moment.
            </p>
            <p className="text-xs text-rose-600">
              Please refresh the page or check back shortly.
            </p>
          </div>
        )}

        {!isLoading && !isError && filteredJobs.length === 0 && (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-10 space-y-4 max-w-lg mx-auto shadow-xs">
            <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Briefcase className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {hasActiveFilters ? "No matching roles found" : "No open roles right now"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              {hasActiveFilters
                ? "Try widening your search terms or clearing your department/location filters to see all available openings."
                : "We frequently open new positions. Check back regularly or reach out to our talent acquisition team directly."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* ── Active Jobs Grid ── */}
        {!isLoading && !isError && filteredJobs.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map((job) => {
              const salaryText = formatSalary(job.budgetMin, job.budgetMax, job.currency, job.salaryPeriod);
              const cleanLocation = job.location
                ? job.location.replace(/^\[|\]$/g, "").trim()
                : "Remote / Multiple Locations";

              return (
                <Link
                  key={job.id}
                  to="/careers/$jobId"
                  params={{ jobId: job.id }}
                  className="group relative bg-white hover:bg-gradient-to-r hover:from-white hover:to-indigo-50/20 border border-slate-200/90 hover:border-indigo-400/80 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.hiringDepartment?.name && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {job.hiringDepartment.name}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 capitalize">
                        {job.employmentType.toLowerCase().replace(/_/g, " ")}
                      </span>
                      {job.jobCode && (
                        <span className="text-[10px] font-mono text-slate-400 font-medium">
                          {job.jobCode}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {job.title}
                      </h3>
                      {job.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata items */}
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <span>{cleanLocation}</span>
                      </div>

                      {salaryText && (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                          <DollarSign className="size-3.5 shrink-0" />
                          <span>{salaryText}</span>
                        </div>
                      )}

                      {job.minExperienceYears > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Award className="size-3.5 text-slate-400 shrink-0" />
                          <span>{job.minExperienceYears}+ yrs experience</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="size-3.5 shrink-0" />
                        <span>{formatRelativeTime(job.createdAt)}</span>
                      </div>
                    </div>

                    {/* Skills Chips */}
                    {job.skillsRequired && job.skillsRequired.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {job.skillsRequired.slice(0, 6).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100/80 text-slate-600 border border-slate-200/60"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skillsRequired.length > 6 && (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            +{job.skillsRequired.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right CTA */}
                  <div className="flex items-center md:flex-col md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all">
                      <span>View &amp; Apply</span>
                      <ArrowRight className="size-3.5" />
                    </span>
                    <span className="text-[10px] text-slate-400 hidden md:inline">
                      Direct Application
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Why Join Venus Section ── */}
      <section id="why-join" className="border-t border-slate-200/80 bg-white py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Why Join Venus Global Tech?
            </h2>
            <p className="text-sm text-slate-600">
              We empower technical talent with challenging problems, high autonomy, and an environment built for rapid professional growth.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-[#faf9f6] space-y-3">
              <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Zap className="size-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">High-Impact Work</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Build enterprise operating systems, AI-powered recruitment tools, and mission-critical workflows used daily by global organizations.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-[#faf9f6] space-y-3">
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="size-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Rapid Career Growth</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Clear promotion paths, cross-functional engineering mobility, and direct mentorship from experienced system architects.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-[#faf9f6] space-y-3">
              <div className="size-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <Globe className="size-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Global &amp; Flexible</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Distributed teams across timezones. We evaluate people on tangible engineering impact and outcomes, not seat time.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-[#faf9f6] space-y-3">
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Comprehensive Package</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Competitive market salary, health coverage, paid annual leave, and ongoing certification allowances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-[#faf9f6] py-10 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              V
            </div>
            <span className="font-semibold text-slate-800">Venus Global Tech Inc.</span>
            <span>— All rights reserved.</span>
          </div>

          <p className="text-slate-400 text-center sm:text-right">
            Venus Global Tech is an Equal Opportunity Employer. We celebrate diversity and are committed to creating an inclusive environment.
          </p>
        </div>
      </footer>
    </div>
  );
}
