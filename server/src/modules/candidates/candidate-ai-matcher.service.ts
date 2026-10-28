import { Injectable } from "@nestjs/common";
import { FitBadge, JobPosting } from "@prisma/client";

export interface CandidateMatchingInput {
  skills?: string[];
  currentTitle?: string | null;
  totalExperienceYears?: number | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriodDays?: number | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  summary?: string | null;
}

export interface CandidateMatchResult {
  aiMatchScore: number;
  skillMatchScore: number;
  expMatchScore: number;
  locMatchScore: number;
  salaryMatchScore: number;
  noticeMatchScore: number;
  cultureMatchScore: number;
  fitBadge: FitBadge;
  aiSummary: string;
  overlappingSkills: string[];
  missingSkills: string[];
  recommendation: "FAST_TRACK_SCREENING" | "STANDARD_REVIEW" | "MANUAL_INSPECTION";
}

@Injectable()
export class CandidateAiMatcherService {
  /**
   * Normalizes a technical skill string for robust comparison
   * e.g., "React.js" -> "react", "Node.JS" -> "node", "C++" -> "c++"
   */
  private normalizeSkill(skill: string): string {
    return skill
      .toLowerCase()
      .trim()
      .replace(/\.js$/i, "")
      .replace(/\s+/g, "");
  }

  /**
   * Computes multi-dimensional AI match scores and fit classification
   * comparing candidate profile against job requisition requirements.
   */
  computeMatch(
    candidate: CandidateMatchingInput,
    job: Pick<
      JobPosting,
      | "title"
      | "description"
      | "skillsRequired"
      | "minExperienceYears"
      | "location"
      | "budgetMin"
      | "budgetMax"
    >,
  ): CandidateMatchResult {
    const jobSkills = Array.isArray(job.skillsRequired) ? job.skillsRequired : [];
    const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills : [];

    const normCandidateSkills = candidateSkills.map((s) => this.normalizeSkill(s));

    // 1. Skill Matching
    let overlappingSkills: string[] = [];
    let missingSkills: string[] = [];

    if (jobSkills.length > 0) {
      overlappingSkills = jobSkills.filter((js) =>
        normCandidateSkills.some((cs) => {
          const njs = this.normalizeSkill(js);
          return cs === njs || cs.includes(njs) || njs.includes(cs);
        }),
      );
      missingSkills = jobSkills.filter((js) => !overlappingSkills.includes(js));
    }

    let skillMatchScore = 80.0;
    if (jobSkills.length > 0) {
      const matchRatio = overlappingSkills.length / jobSkills.length;
      skillMatchScore = Math.min(100, Math.max(20, Math.round(matchRatio * 100)));
    } else if (candidateSkills.length > 0) {
      skillMatchScore = 85.0;
    }

    // 2. Experience Matching
    const minExp = job.minExperienceYears || 2;
    const candExp = candidate.totalExperienceYears || 0;
    let expMatchScore = 85.0;
    if (candExp >= minExp) {
      const expSurplus = Math.min(5, candExp - minExp);
      expMatchScore = Math.min(100, 88 + expSurplus * 2.4);
    } else {
      const ratio = candExp / Math.max(1, minExp);
      expMatchScore = Math.max(30, Math.round(ratio * 80));
    }

    // 3. Location Matching
    const jobLoc = (job.location || "").toLowerCase();
    const candLoc = [candidate.city, candidate.state, candidate.location]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let locMatchScore = 85.0;
    if (jobLoc.includes("remote") || candLoc.includes("remote")) {
      locMatchScore = 98.0;
    } else if (jobLoc && candLoc) {
      const isMatch =
        jobLoc.split(/[\s,]+/).some((w) => w.length > 2 && candLoc.includes(w)) ||
        candLoc.split(/[\s,]+/).some((w) => w.length > 2 && jobLoc.includes(w));
      locMatchScore = isMatch ? 92.0 : 70.0;
    }

    // 4. Salary Alignment
    let salaryMatchScore = 85.0;
    const budgetMax = job.budgetMax || 150000;
    if (candidate.expectedSalary && candidate.expectedSalary > 0) {
      if (candidate.expectedSalary <= budgetMax) {
        salaryMatchScore = 95.0;
      } else {
        const gapRatio = (candidate.expectedSalary - budgetMax) / budgetMax;
        salaryMatchScore = Math.max(40, Math.round(90 - gapRatio * 100));
      }
    }

    // 5. Notice Period Alignment
    let noticeMatchScore = 88.0;
    const noticeDays = candidate.noticePeriodDays ?? 30;
    if (noticeDays <= 15) {
      noticeMatchScore = 98.0;
    } else if (noticeDays <= 30) {
      noticeMatchScore = 90.0;
    } else if (noticeDays <= 60) {
      noticeMatchScore = 75.0;
    } else {
      noticeMatchScore = 55.0;
    }

    // 6. Title / Role Relevance
    const jobTitleWords = (job.title || "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const candTitle = (candidate.currentTitle || "").toLowerCase();
    let titleOverlap = 0;
    jobTitleWords.forEach((w) => {
      if (candTitle.includes(w)) titleOverlap++;
    });
    const cultureMatchScore = Math.min(
      96,
      Math.max(65, 75 + titleOverlap * 8),
    );

    // 7. Weighted Composite Match Score
    const aiMatchScore = Number(
      (
        skillMatchScore * 0.40 +
        expMatchScore * 0.25 +
        locMatchScore * 0.15 +
        salaryMatchScore * 0.10 +
        noticeMatchScore * 0.10
      ).toFixed(1),
    );

    // 8. Fit Badge Assignment
    let fitBadge: FitBadge = FitBadge.SILVER_FIT;
    let recommendation: "FAST_TRACK_SCREENING" | "STANDARD_REVIEW" | "MANUAL_INSPECTION" =
      "STANDARD_REVIEW";

    if (aiMatchScore >= 85) {
      fitBadge = FitBadge.PLATINUM_FIT;
      recommendation = "FAST_TRACK_SCREENING";
    } else if (aiMatchScore >= 70) {
      fitBadge = FitBadge.GOLD_FIT;
      recommendation = "FAST_TRACK_SCREENING";
    } else if (aiMatchScore >= 55) {
      fitBadge = FitBadge.SILVER_FIT;
      recommendation = "STANDARD_REVIEW";
    } else {
      fitBadge = FitBadge.REVIEW_REQUIRED;
      recommendation = "MANUAL_INSPECTION";
    }

    // 9. AI Executive Summary Narrative
    const skillsSummary =
      overlappingSkills.length > 0
        ? `Overlaps in ${overlappingSkills.slice(0, 4).join(", ")}${overlappingSkills.length > 4 ? ` (+${overlappingSkills.length - 4} more)` : ""}`
        : "General competencies verified";

    const expSummary = `${candExp} yrs exp vs ${minExp} yrs required`;
    const aiSummary = `${aiMatchScore}% composite match for ${job.title}. ${skillsSummary}. ${expSummary}. ${recommendation === "FAST_TRACK_SCREENING" ? "Recommended for accelerated recruiter screen." : "Review requirements alignment."}`;

    return {
      aiMatchScore,
      skillMatchScore,
      expMatchScore,
      locMatchScore,
      salaryMatchScore,
      noticeMatchScore,
      cultureMatchScore,
      fitBadge,
      aiSummary,
      overlappingSkills,
      missingSkills,
      recommendation,
    };
  }
}
