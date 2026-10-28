import { Injectable, Logger } from "@nestjs/common";

export interface AdzunaMatch {
  companyName: string;
  externalJobId: string;
  title: string;
  url: string;
  location?: string;
  salary?: string;
  description?: string;
  created?: string;
}

// Adzuna's real, self-serve developer API (https://developer.adzuna.com) --
// requires the user's own free ADZUNA_APP_ID/ADZUNA_APP_KEY, same
// env-var-driven pattern as every other integration in this codebase.
@Injectable()
export class AdzunaAdapter {
  private readonly logger = new Logger(AdzunaAdapter.name);

  isConfigured(): boolean {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  // Detects the optimal Adzuna country code based on location string.
  determineCountryCode(location?: string): string {
    if (!location) return "in"; // default to India or US based on typical usage
    const loc = location.toLowerCase().trim();

    const indianKeywords = [
      "india", "bhubaneswar", "bangalore", "bengaluru", "mumbai", "delhi",
      "hyderabad", "pune", "chennai", "kolkata", "noida", "gurgaon",
      "gurugram", "odisha", "ahmedabad", "jaipur", "kochi", "chandigarh", "indore"
    ];
    if (indianKeywords.some((k) => loc.includes(k))) return "in";

    if (loc.includes("uk") || loc.includes("united kingdom") || loc.includes("london") || loc.includes("manchester") || loc.includes("birmingham")) {
      return "gb";
    }
    if (loc.includes("canada") || loc.includes("toronto") || loc.includes("vancouver") || loc.includes("montreal")) {
      return "ca";
    }
    if (loc.includes("australia") || loc.includes("sydney") || loc.includes("melbourne") || loc.includes("brisbane")) {
      return "au";
    }
    if (loc.includes("singapore")) return "sg";
    if (loc.includes("germany") || loc.includes("berlin") || loc.includes("munich")) return "de";

    return "us";
  }

  async search(
    keyword: string,
    location?: string,
    country?: string,
    resultsPerPage: number = 25,
  ): Promise<AdzunaMatch[]> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];

    const market = country || this.determineCountryCode(location);

    try {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        what: keyword,
        results_per_page: String(Math.min(resultsPerPage, 50)),
        "content-type": "application/json",
      });

      const countryNames = new Set([
        "india", "united states", "usa", "us", "uk", "united kingdom",
        "canada", "australia", "germany", "singapore", "remote", "global"
      ]);

      const locLower = (location || "").trim().toLowerCase();
      // Only set where parameter if it's a specific city/state/region and not the entire country
      if (locLower && !countryNames.has(locLower)) {
        params.set("where", location!.trim());
      }

      const url = `https://api.adzuna.com/v1/api/jobs/${market}/search/1?${params}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        // If country specific endpoint had an issue and market was not "us", try "us" as fallback
        if (market !== "us") {
          return this.search(keyword, location, "us", resultsPerPage);
        }
        return [];
      }

      const data = (await res.json()) as {
        results?: Array<{
          id: string;
          title: string;
          redirect_url: string;
          created?: string;
          description?: string;
          salary_min?: number;
          salary_max?: number;
          company?: { display_name?: string };
          location?: { display_name?: string; area?: string[] };
        }>;
      };

      const results = (data.results ?? [])
        .filter((r) => r.company?.display_name && r.title)
        .map((r) => {
          let salaryStr: string | undefined;
          if (r.salary_min || r.salary_max) {
            const min = r.salary_min ? Math.round(r.salary_min) : undefined;
            const max = r.salary_max ? Math.round(r.salary_max) : undefined;
            if (min && max && min === max) salaryStr = `${min.toLocaleString()}`;
            else if (min && max) salaryStr = `${min.toLocaleString()} - ${max.toLocaleString()}`;
            else if (min) salaryStr = `${min.toLocaleString()}+`;
            else if (max) salaryStr = `Up to ${max.toLocaleString()}`;
          }

          return {
            companyName: r.company!.display_name!.trim(),
            externalJobId: String(r.id),
            title: r.title.trim(),
            url: r.redirect_url,
            location: r.location?.display_name || (r.location?.area ? r.location.area.join(", ") : location),
            salary: salaryStr,
            description: r.description,
            created: r.created,
          };
        });

      // If specific city search returned 0 results, retry without the city constraint to still get relevant open roles in the country
      if (results.length === 0 && location && location.trim().length > 0 && !countryNames.has(locLower)) {
        return this.search(keyword, undefined, market, resultsPerPage);
      }

      // If still 0 results and market was not US, try US
      if (results.length === 0 && market !== "us") {
        return this.search(keyword, undefined, "us", resultsPerPage);
      }

      return results;
    } catch (err) {
      this.logger.warn(`Adzuna search failed for "${keyword}" (loc: ${location}): ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
