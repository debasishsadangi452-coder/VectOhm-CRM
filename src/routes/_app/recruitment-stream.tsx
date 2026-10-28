import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Radio,
  RotateCw,
  Search,
  Filter,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  Calendar,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/recruitment-stream")({
  component: RecruitmentStreamPage,
});

export interface StreamActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  detail: string;
  time: string;
  timestamp: number;
}

const LOCAL_STORAGE_STREAM_KEY = "omnios_recruitment_daily_stream_v2";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function formatStreamTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) return "Just now";
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return "24h ago";
}

const getInitialStreamItems = (): StreamActivityItem[] => {
  const now = Date.now();
  return [
    {
      id: "stream-init-1",
      user: "Megan Foster",
      action: "moved candidate",
      target: "Alex Chen",
      detail: "to Shortlisted",
      time: "2m ago",
      timestamp: now - 2 * 60 * 1000,
    },
    {
      id: "stream-init-2",
      user: "Hiring Manager",
      action: "submitted scorecard",
      target: "David Miller",
      detail: "Strong Hire (5/5)",
      time: "14m ago",
      timestamp: now - 14 * 60 * 1000,
    },
    {
      id: "stream-init-3",
      user: "Recruitment Bot",
      action: "released offer",
      target: "Emily Zhang",
      detail: "OFF-2026-104 ($150k)",
      time: "1h ago",
      timestamp: now - 60 * 60 * 1000,
    },
    {
      id: "stream-init-4",
      user: "Candidate Portal",
      action: "applied via LinkedIn",
      target: "Marcus Brody",
      detail: "Senior Full Stack AI Eng",
      time: "2h ago",
      timestamp: now - 2 * 60 * 60 * 1000,
    },
    {
      id: "stream-init-5",
      user: "AI Rediscovery Engine",
      action: "re-engaged candidate",
      target: "David Miller",
      detail: "94.5% Vector Match - Outreach Sent",
      time: "3h ago",
      timestamp: now - 3 * 60 * 60 * 1000,
    },
    {
      id: "stream-init-6",
      user: "Panel Interviewer",
      action: "joined video meeting",
      target: "Alex Chen",
      detail: "Live Interview Session",
      time: "4h ago",
      timestamp: now - 4 * 60 * 60 * 1000,
    },
  ];
};

import { useDepartmentGuard } from "@/hooks/use-department-guard";

function RecruitmentStreamPage() {
  useDepartmentGuard("Recruitment");
  const [streamItems, setStreamItems] = useState<StreamActivityItem[]>(() => {
    if (typeof window === "undefined") return getInitialStreamItems();
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_STREAM_KEY);
      if (stored) {
        const parsed: StreamActivityItem[] = JSON.parse(stored);
        const now = Date.now();
        const valid = parsed.filter((item) => now - item.timestamp < TWENTY_FOUR_HOURS_MS);
        if (valid.length > 0) {
          return valid.map((item) => ({
            ...item,
            time: formatStreamTime(item.timestamp),
          }));
        }
      }
    } catch {
      // fallback
    }
    return getInitialStreamItems();
  });

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_STREAM_KEY, JSON.stringify(streamItems));
    } catch {
      // ignore
    }
  }, [streamItems]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStreamItems((prev) => {
        const now = Date.now();
        const valid = prev.filter((item) => now - item.timestamp < TWENTY_FOUR_HOURS_MS);
        return valid.map((item) => ({
          ...item,
          time: formatStreamTime(item.timestamp),
        }));
      });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    return streamItems.filter((item) => {
      const matchesSearch =
        item.user.toLowerCase().includes(search.toLowerCase()) ||
        item.action.toLowerCase().includes(search.toLowerCase()) ||
        item.target.toLowerCase().includes(search.toLowerCase()) ||
        item.detail.toLowerCase().includes(search.toLowerCase());

      const act = item.action.toLowerCase();
      if (activeCategory === "ALL") return matchesSearch;
      if (activeCategory === "AI" && (act.includes("re-engage") || act.includes("rediscover") || act.includes("vector"))) return matchesSearch;
      if (activeCategory === "MOVES" && act.includes("moved")) return matchesSearch;
      if (activeCategory === "OFFERS" && (act.includes("offer") || act.includes("hired") || act.includes("joined"))) return matchesSearch;
      if (activeCategory === "INTERVIEWS" && (act.includes("interview") || act.includes("scorecard"))) return matchesSearch;
      return false;
    });
  }, [streamItems, search, activeCategory]);

  const handleRefresh = () => {
    const fresh = getInitialStreamItems();
    setStreamItems(fresh);
    toast.success("24h Stream Refreshed!", {
      description: "Cleared old activities and loaded fresh 24-hour log.",
    });
  };

  return (
    <div className="p-5 max-w-[1720px] mx-auto space-y-6 font-sans select-none pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Radio className="size-6 text-blue-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Daily Recruitment Stream</h1>
              <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" /> Live Audit ({streamItems.length} Events)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Stateful 24-hour activity audit trail tracking candidate movements, AI rediscovery outreach, interview scorecards, and offers.
            </p>
          </div>
        </div>

        <Button onClick={handleRefresh} variant="outline" size="sm" className="rounded-xl border-slate-200 font-bold text-xs h-9 cursor-pointer">
          <RotateCw className="size-3.5 mr-1.5 text-slate-500" /> Refresh 24h Stream
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="size-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search stream events, recruiter names, candidate targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none">
            {[
              { id: "ALL", label: "All Events" },
              { id: "AI", label: "AI Rediscovery" },
              { id: "MOVES", label: "Stage Moves" },
              { id: "OFFERS", label: "Offers & Hires" },
              { id: "INTERVIEWS", label: "Interviews" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full Page Stream Timeline */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-16">
            <Activity className="size-10 text-slate-300 mx-auto mb-2 stroke-1" />
            <span className="font-extrabold text-slate-800 text-sm block">No Stream Events Logged</span>
            <span className="text-slate-500">Perform actions in Recruitment to populate the live 24-hour audit stream.</span>
          </div>
        ) : (
          filteredItems.map((item) => {
            const getDotColor = () => {
              const act = item.action.toLowerCase();
              if (act.includes("re-engage") || act.includes("rediscover") || act.includes("vector")) return "bg-purple-600 shadow-md shadow-purple-500/30";
              if (act.includes("offer") || act.includes("hired") || act.includes("joined")) return "bg-emerald-600 shadow-md shadow-emerald-500/30";
              if (act.includes("interview") || act.includes("scorecard")) return "bg-amber-500 shadow-md shadow-amber-500/30";
              return "bg-blue-600 shadow-md shadow-blue-500/30";
            };

            return (
              <div key={item.id} className="flex items-start gap-4 p-3.5 rounded-2xl hover:bg-slate-50 border border-slate-100 transition-colors">
                <div className={`size-3 rounded-full ${getDotColor()} shrink-0 mt-1.5`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900">{item.user}</span>
                    <span className="text-xs text-slate-400 font-mono font-bold flex items-center gap-1">
                      <Clock className="size-3" /> {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    <span className="text-slate-600 font-bold">{item.action}</span>{" "}
                    <span className="font-black text-blue-600">{item.target}</span>{" "}
                    <span className="text-slate-500">({item.detail})</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
