import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users2,
  KanbanSquare,
  CheckSquare,
  MessagesSquare,
  Briefcase,
  TrendingUp,
  Search,
  Code2,
  BarChart3,
  BookOpen,
  Settings,
  Command,
  LogOut,
  Clock,
  Rocket,
  Monitor,
  Camera,
  Send,
  SendHorizontal,
  GraduationCap,
  Phone,
  Mail,
  Activity,
  ChevronsUpDown,
  Zap,
  Radio,
  ClipboardList,
  Sparkles,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore, userCanSignOut, type CurrentUser } from "@/stores/auth-store";
import { resolveApiAssetUrl } from "@/lib/api/client";
import { logout as logoutApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useMySignOutRequest, useRequestSignOut } from "@/hooks/use-signout-requests";
import { getRoleLabel } from "@/lib/role-label";
import { WorkSessionToggle } from "@/components/work-session-toggle";
import { useTasks } from "@/hooks/use-tasks";
import { useDeals } from "@/hooks/use-deals";
import { useChatUnreadCount } from "@/hooks/use-chat";
import { useNotifications } from "@/hooks/use-notifications";
import { useSearchStore } from "@/stores/search-store";
import { getInitials } from "@/lib/utils";

const CLOSED_DEAL_STAGES = new Set(["WON", "LOST", "ARCHIVED"]);

const groups: Array<{
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    badgeKey?: "crm" | "chat";
  }>;
}> = [
  {
    label: "CORE",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/crm", label: "CRM & Sales", icon: Users2, badgeKey: "crm" },
      { to: "/projects", label: "Projects", icon: KanbanSquare },
      { to: "/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/hr", label: "HRMS Portal", icon: GraduationCap },
      { to: "/assistant", label: "Assistant", icon: Bot },
    ],
  },
  {
    label: "SPRINTS",
    items: [
      { to: "/sales", label: "Team Performance", icon: TrendingUp },
      { to: "/engagement", label: "Engagement Center", icon: Activity },
      { to: "/outreach", label: "Outreach", icon: Rocket },
      { to: "/inbox", label: "Inbox", icon: Mail },
      { to: "/sent", label: "Sent", icon: SendHorizontal },
      { to: "/calls", label: "Calls", icon: Phone },
      { to: "/recruitment", label: "Recruitment", icon: Briefcase },
      { to: "/recruitment-stream", label: "Daily Recruitment Stream", icon: Radio },
      { to: "/intent-hiring", label: "Intent Hiring", icon: Sparkles },
      { to: "/bulk-email", label: "Email Campaigns", icon: Send },
      { to: "/seo", label: "SEO Monitor", icon: Search },
      { to: "/dev", label: "Dev Sprints", icon: Code2 },
      { to: "/attendance", label: "Attendance", icon: Clock },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { to: "/chat", label: "Team Chat", icon: MessagesSquare, badgeKey: "chat" },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
      { to: "/screen-monitoring", label: "Screen Monitoring", icon: Monitor },
      { to: "/employee-daily-log", label: "Employee Daily Log", icon: ClipboardList },
      { to: "/login-photos", label: "Login Photos", icon: Camera },
      { to: "/how-to-use", label: "How to Use CRM", icon: GraduationCap },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

import { canAccessModule, moduleForPath } from "@/lib/modules";

// Whether a sidebar link shows for this person: Admin sees everything; otherwise the modules an Admin picked
// for them, or the default for their role and department (see src/lib/modules.ts).
function isNavItemVisible(to: string, user: CurrentUser | null): boolean {
  const key = moduleForPath(to);
  return key ? canAccessModule(user, key) : !!user;
}

export function AppSidebar() {
  const setSearchOpen = useSearchStore((s) => s.setSearchOpen);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const { data: mySignOutRequest } = useMySignOutRequest();
  const signOutRequest = mySignOutRequest?.status === "PENDING" ? mySignOutRequest : null;
  const requestSignOutMutation = useRequestSignOut();

  const showCrmBadge = !!user && isNavItemVisible("/crm", user);
  const { data: openDeals } = useDeals({}, showCrmBadge);
  const { data: chatUnread } = useChatUnreadCount();
  const { data: notifications } = useNotifications();

  const unreadNotifications = (notifications ?? []).filter((n) => !n.isRead);

  const getRouteBadge = (to: string): number | undefined => {
    // Unread notifications targeting this panel route
    const notifCount = unreadNotifications.filter((n) => {
      if (!n.link) return false;
      return n.link === to || n.link.startsWith(to + "/") || n.link.startsWith(to + "?");
    }).length;

    if (to === "/chat") {
      const chatTotal = (chatUnread?.count ?? 0) + notifCount;
      return chatTotal > 0 ? chatTotal : undefined;
    }

    if (to === "/crm") {
      const dealsCount = openDeals?.filter((d) => !CLOSED_DEAL_STAGES.has(d.stage)).length ?? 0;
      const total = dealsCount + notifCount;
      return total > 0 ? total : undefined;
    }

    return notifCount > 0 ? notifCount : undefined;
  };

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((item) => isNavItemVisible(item.to, user))
        .map((item) => ({
          ...item,
          badge: getRouteBadge(item.to),
        })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-white/5 bg-[#0b132b] text-white font-sans select-none">
      <div className="h-16 px-4 flex items-center gap-3 border-b border-white/10">
        <div className="size-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
          V
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-extrabold tracking-tight text-sm text-white">Venus CRM</span>
          <span className="text-[11px] text-slate-400 font-medium">
            {user?.department?.name ? `${user.department.name} Workspace` : "Recruitment Workspace"}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-3.5 space-y-4 overflow-y-auto">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] font-extrabold text-slate-400/80 uppercase tracking-widest px-3 mb-2">
              {g.label}
            </div>
            <div className="space-y-1">
              {g.items.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all font-bold " +
                      (active
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30 border border-blue-500/30"
                        : "text-slate-300/90 hover:text-white hover:bg-white/5")
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <WorkSessionToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-9 shrink-0 border border-white/10">
                    {user.avatarUrl ? (
                      <AvatarImage
                        src={resolveApiAssetUrl(user.avatarUrl)}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-blue-600 text-white font-black text-xs">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="font-extrabold text-xs text-white truncate">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      {getRoleLabel(user)}
                    </span>
                  </div>
                </div>
                <ChevronsUpDown className="size-4 text-slate-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#0b132b] text-white border-white/10 p-1.5 shadow-xl space-y-1">
              <DropdownMenuItem
                onSelect={() => {
                  window.location.href = "/account";
                }}
                className="text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer font-bold text-xs rounded-lg py-2"
              >
                <Settings className="size-4 mr-2 text-blue-400" /> Account Settings
              </DropdownMenuItem>
              {!userCanSignOut(user) && (
                <>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      if (!signOutRequest) requestSignOutMutation.mutate(undefined);
                    }}
                    disabled={!!signOutRequest || requestSignOutMutation.isPending}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer font-bold text-xs rounded-lg py-2"
                  >
                    <LogOut className="size-4 mr-2" />
                    {signOutRequest ? "Sign-out request pending…" : "Request Sign Out"}
                  </DropdownMenuItem>
                </>
              )}
              {userCanSignOut(user) && (
                <>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuItem
                    onSelect={async (e) => {
                      e.preventDefault();
                      try {
                        await logoutApi();
                      } catch (err) {
                        // The server refuses sign-out for accounts an Admin hasn't allowed.
                        if (err instanceof ApiError && err.status === 403) {
                          toast.error(err.message);
                          return;
                        }
                        // other api errors: still sign out locally
                      }
                      useAuthStore.getState().clearAuth();
                      toast.success("Signed Out Successfully");
                      window.location.href = "/login";
                    }}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer font-bold text-xs rounded-lg py-2"
                  >
                    <LogOut className="size-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
