import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    name?: string | null;
  } | null,
  fallback = "?",
): string {
  if (!user) return fallback;
  const first = user.firstName?.trim() || "";
  const last = user.lastName?.trim() || "";
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (last) {
    return last.slice(0, 2).toUpperCase();
  }
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email?.trim()) {
    return user.email.trim().slice(0, 2).toUpperCase();
  }
  return fallback;
}

export function navigateNotificationLink(
  navigate: (opts: any) => void,
  link?: string | null,
) {
  if (!link || !link.trim()) return;

  try {
    const trimmed = link.trim();
    const [pathname, searchStr] = trimmed.split("?");
    const searchParams: Record<string, string> = {};
    if (searchStr) {
      const urlParams = new URLSearchParams(searchStr);
      urlParams.forEach((value, key) => {
        searchParams[key] = value;
      });
    }

    const dealsMatch = pathname.match(/^\/deals\/([a-zA-Z0-9_-]+)$/);
    if (dealsMatch) {
      navigate({
        to: "/deals/$id",
        params: { id: dealsMatch[1] },
        search: Object.keys(searchParams).length > 0 ? searchParams : undefined,
      });
      return;
    }

    const projectsMatch = pathname.match(/^\/projects\/([a-zA-Z0-9_-]+)$/);
    if (projectsMatch) {
      navigate({
        to: "/projects/$id",
        params: { id: projectsMatch[1] },
        search: Object.keys(searchParams).length > 0 ? searchParams : undefined,
      });
      return;
    }

    if (Object.keys(searchParams).length > 0) {
      navigate({
        to: pathname as any,
        search: searchParams as any,
      });
    } else {
      navigate({
        to: pathname as any,
      });
    }
  } catch (e) {
    console.error("Navigation error, falling back to window.location:", e);
    window.location.href = link;
  }
}

