import type { ExtractedResumeData } from './resume-parser';

export interface StoredResume {
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
  url?: string;
  uploadedAt: string;
  text?: string;
  scrapedData?: ExtractedResumeData;
}

const STORAGE_KEY = 'orbitaplex_applicant_resumes';
const inMemoryCache = new Map<string, StoredResume>();

export function getStoredResume(applicantId?: string, applicantName?: string): StoredResume | null {
  if (applicantId && inMemoryCache.has(applicantId)) {
    return inMemoryCache.get(applicantId)!;
  }
  if (applicantName) {
    const cleanName = applicantName.toLowerCase().trim();
    if (inMemoryCache.has(cleanName)) {
      return inMemoryCache.get(cleanName)!;
    }
  }

  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (applicantId && map[applicantId]) {
      inMemoryCache.set(applicantId, map[applicantId]);
      return map[applicantId];
    }
    if (applicantName) {
      const cleanName = applicantName.toLowerCase().trim();
      if (map[cleanName]) {
        inMemoryCache.set(cleanName, map[cleanName]);
        return map[cleanName];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredResume(
  applicantId: string | undefined,
  applicantName: string | undefined,
  resume: StoredResume
): void {
  if (applicantId) inMemoryCache.set(applicantId, resume);
  if (applicantName) inMemoryCache.set(applicantName.toLowerCase().trim(), resume);

  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (applicantId) map[applicantId] = resume;
    if (applicantName) {
      const cleanName = applicantName.toLowerCase().trim();
      map[cleanName] = resume;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // If quota exceeded due to large base64 dataUrl, save without dataUrl
      const fallbackMap: Record<string, StoredResume> = {};
      for (const [k, v] of Object.entries(map as Record<string, StoredResume>)) {
        fallbackMap[k] = { ...v, dataUrl: undefined };
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackMap));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
