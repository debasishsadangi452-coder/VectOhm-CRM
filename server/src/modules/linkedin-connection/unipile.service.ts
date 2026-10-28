import { Injectable, Logger } from "@nestjs/common";

export interface UnipileProfile {
  provider_id: string;
  public_identifier: string;
  member_urn?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  profile_pic_url?: string;
  location?: string;
  email?: string;
}

export interface UnipileAccount {
  id: string;
  name: string;
  type: string;
  status: string;
  publicIdentifier?: string;
  email?: string;
}

export interface CreateLinkedInPostOptions {
  text: string;
  externalLink?: string;
  accountId?: string;
  apiKey?: string;
}

export interface CreateLinkedInPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface CreateLinkedInJobPostingOptions {
  title: string;
  companyName?: string;
  workplace?: "REMOTE" | "HYBRID" | "ON_SITE";
  location?: string;
  descriptionHtml: string;
  accountId?: string;
  apiKey?: string;
}

export interface CreateLinkedInJobPostingResult {
  success: boolean;
  jobId?: string;
  jobUrl?: string;
  isDraft?: boolean;
  verificationRequired?: boolean;
  verificationUrl?: string;
  error?: string;
}

@Injectable()
export class UnipileService {
  private readonly logger = new Logger(UnipileService.name);

  getDsn(): string {
    const raw = (process.env.UNIPILE_DSN || "https://api70.unipile.com:20079").trim();
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      return `https://${raw}`;
    }
    return raw;
  }

  getApiKey(overrideKey?: string): string {
    return (overrideKey || process.env.UNIPILE_API_KEY || "").trim();
  }

  getDefaultAccountId(overrideAccountId?: string): string {
    return (overrideAccountId || process.env.UNIPILE_ACCOUNT_ID || "").trim();
  }

  isConfigured(overrideKey?: string): boolean {
    return Boolean(this.getApiKey(overrideKey) && this.getDsn());
  }

  /**
   * Cleans and extracts the LinkedIn public identifier (vanity name) from a profile URL or raw string.
   * e.g. "https://www.linkedin.com/in/pratyush-kumar-76a707446/" -> "pratyush-kumar-76a707446"
   */
  extractPublicIdentifier(input: string): string {
    if (!input) return "";
    let cleaned = input.trim();

    // If input starts without protocol but includes domain or www (e.g. "www.linkedin.com/..." or "linkedin.com/..."):
    if (!/^https?:\/\//i.test(cleaned) && (cleaned.startsWith("www.") || cleaned.includes("linkedin.com/"))) {
      cleaned = `https://${cleaned.replace(/^\/+/, "")}`;
    }

    try {
      if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
        const url = new URL(cleaned);
        const parts = url.pathname.split("/").filter(Boolean);
        const inIdx = parts.indexOf("in");
        if (inIdx !== -1 && parts[inIdx + 1]) {
          return decodeURIComponent(parts[inIdx + 1]).replace(/[/?#].*$/, "").trim();
        }
        if (parts.length > 0) {
          return decodeURIComponent(parts[parts.length - 1]).replace(/[/?#].*$/, "").trim();
        }
      }
    } catch {
      // fallback to regex
    }

    cleaned = cleaned
      .replace(/^https?:\/\//i, "")
      .replace(/^(www\.)?linkedin\.com\/(in\/)?/i, "")
      .replace(/^in\//i, "")
      .replace(/\/.*$/, "")
      .replace(/\?.*$/, "")
      .replace(/#.*$/, "")
      .trim();

    return cleaned;
  }

  /**
   * Fetches the connected LinkedIn account details from Unipile.
   */
  async getConnectedAccount(accountId?: string, apiKey?: string): Promise<UnipileAccount | null> {
    const dsn = this.getDsn();
    const key = this.getApiKey(apiKey);
    const targetId = this.getDefaultAccountId(accountId);

    if (!key) {
      this.logger.warn("Unipile API key is not configured.");
      return null;
    }

    try {
      const res = await fetch(`${dsn}/api/v1/accounts`, {
        method: "GET",
        headers: {
          "X-API-KEY": key,
          accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Unipile accounts fetch failed: HTTP ${res.status} - ${text}`);
        return null;
      }

      const data = await res.json();
      const items: any[] = data.items || [];
      if (!items.length) return null;

      // An explicit account id must match exactly; never fall back to some other account.
      const match = targetId
        ? items.find((a) => a.id === targetId)
        : items.find((a) => a.type === "LINKEDIN");

      if (!match) return null;

      const isOk =
        match.sources?.some((s: any) => s.status === "OK") ||
        match.status_counts?.OK > 0 ||
        match.status === "OK";

      return {
        id: match.id,
        name: match.name,
        type: match.type,
        status: isOk ? "OK" : "ERROR",
        publicIdentifier: match.connection_params?.im?.publicIdentifier,
        email: match.connection_params?.im?.username?.includes("@")
          ? match.connection_params?.im?.username
          : undefined,
      };
    } catch (err: any) {
      this.logger.error(`Failed to get Unipile account: ${err.message}`);
      return null;
    }
  }

  /**
   * Resolves a LinkedIn profile identifier or URL to a full profile object (with provider_id).
   */
  async resolveProfile(
    identifierOrUrl: string,
    accountId?: string,
    apiKey?: string,
  ): Promise<UnipileProfile | null> {
    const identifier = this.extractPublicIdentifier(identifierOrUrl);
    if (!identifier) return null;

    const dsn = this.getDsn();
    const key = this.getApiKey(apiKey);
    const targetAccountId = this.getDefaultAccountId(accountId);

    if (!key || !targetAccountId) {
      this.logger.warn("Unipile API key or Account ID missing for resolveProfile.");
      return null;
    }

    try {
      const url = `${dsn}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(targetAccountId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-KEY": key,
          accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Unipile user lookup failed for '${identifier}': HTTP ${res.status} - ${text}`);
        return null;
      }

      const data = await res.json();
      return {
        provider_id: data.provider_id,
        public_identifier: data.public_identifier || identifier,
        member_urn: data.member_urn,
        first_name: data.first_name,
        last_name: data.last_name,
        headline: data.headline,
        profile_pic_url: data.profile_picture_url || data.profile_pic_url,
        location: data.location,
        email: data.contact_info?.emails?.[0],
      };
    } catch (err: any) {
      this.logger.error(`Failed resolving profile for '${identifier}': ${err.message}`);
      return null;
    }
  }

  /**
   * Sends a connection request / invitation on LinkedIn with an optional personalized note (max 300 chars).
   */
  async sendInvitation(options: {
    targetUrlOrIdentifier: string;
    message?: string;
    accountId?: string;
    apiKey?: string;
  }): Promise<{ success: boolean; invitationId?: string; recipientName?: string; error?: string }> {
    const dsn = this.getDsn();
    const key = this.getApiKey(options.apiKey);
    const targetAccountId = this.getDefaultAccountId(options.accountId);

    if (!key || !targetAccountId) {
      return { success: false, error: "Unipile integration is not fully configured (API Key or Account ID missing)." };
    }

    // 1. Resolve profile to get provider_id
    const profile = await this.resolveProfile(options.targetUrlOrIdentifier, targetAccountId, key);
    if (!profile || !profile.provider_id) {
      return {
        success: false,
        error: `Could not resolve LinkedIn profile for '${options.targetUrlOrIdentifier}'. Make sure the URL is public and valid.`,
      };
    }

    // 2. Format invitation message (LinkedIn max 300 characters)
    let note: string | undefined = undefined;
    if (options.message && options.message.trim()) {
      note = options.message.trim();
      if (note.length > 300) {
        note = note.slice(0, 297) + "...";
      }
    }

    try {
      const payload: any = {
        account_id: targetAccountId,
        provider_id: profile.provider_id,
      };
      if (note) {
        payload.message = note;
      }

      const res = await fetch(`${dsn}/api/v1/users/invite`, {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
        this.logger.error(`Unipile send invitation failed: ${errorMsg}`);
        return {
          success: false,
          recipientName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.public_identifier,
          error: errorMsg,
        };
      }

      this.logger.log(`LinkedIn invitation successfully sent to ${profile.public_identifier} (invitation_id: ${data.invitation_id})`);
      return {
        success: true,
        invitationId: data.invitation_id || "sent",
        recipientName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.public_identifier,
      };
    } catch (err: any) {
      this.logger.error(`Failed sending invitation: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends a direct LinkedIn message to a connection or recipient.
   */
  async sendMessage(options: {
    targetUrlOrIdentifier: string;
    text: string;
    accountId?: string;
    apiKey?: string;
  }): Promise<{
    success: boolean;
    chatId?: string;
    messageId?: string;
    recipientId?: string;
    recipientName?: string;
    error?: string;
  }> {
    const dsn = this.getDsn();
    const key = this.getApiKey(options.apiKey);
    const targetAccountId = this.getDefaultAccountId(options.accountId);

    if (!key || !targetAccountId) {
      return { success: false, error: "Unipile integration is not configured." };
    }

    if (!options.text || !options.text.trim()) {
      return { success: false, error: "Message text cannot be empty." };
    }

    // 1. Resolve profile to get provider_id
    const profile = await this.resolveProfile(options.targetUrlOrIdentifier, targetAccountId, key);
    if (!profile || !profile.provider_id) {
      return {
        success: false,
        error: `Could not resolve recipient LinkedIn profile for '${options.targetUrlOrIdentifier}'.`,
      };
    }

    try {
      const payload = {
        account_id: targetAccountId,
        attendees_ids: [profile.provider_id],
        text: options.text.trim(),
      };

      const res = await fetch(`${dsn}/api/v1/chats`, {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
        this.logger.error(`Unipile send message failed: ${errorMsg}`);
        return {
          success: false,
          recipientName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.public_identifier,
          error: errorMsg,
        };
      }

      return {
        success: true,
        chatId: data.chat_id || data.id,
        messageId: data.message_id,
        recipientId: profile.provider_id,
        recipientName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.public_identifier,
      };
    } catch (err: any) {
      this.logger.error(`Failed sending message: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches recent chats for the connected LinkedIn account.
   */
  async getChats(accountId?: string, limit = 20, apiKey?: string): Promise<any[]> {
    const dsn = this.getDsn();
    const key = this.getApiKey(apiKey);
    const targetAccountId = this.getDefaultAccountId(accountId);

    if (!key || !targetAccountId) return [];

    try {
      const res = await fetch(
        `${dsn}/api/v1/chats?account_id=${encodeURIComponent(targetAccountId)}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "X-API-KEY": key,
            accept: "application/json",
          },
        },
      );

      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (err: any) {
      this.logger.error(`Failed getting chats: ${err.message}`);
      return [];
    }
  }

  /**
   * Publishes an announcement / post to the user's connected LinkedIn account via Unipile.
   */
  async createLinkedInPost(options: CreateLinkedInPostOptions): Promise<CreateLinkedInPostResult> {
    const dsn = this.getDsn();
    const key = this.getApiKey(options.apiKey);
    let targetAccountId = this.getDefaultAccountId(options.accountId);

    if (!key) {
      this.logger.warn("Unipile API key is not configured.");
      return { success: false, error: "Unipile API key is not configured" };
    }

    if (!targetAccountId) {
      const connected = await this.getConnectedAccount(undefined, key);
      if (connected?.id) {
        targetAccountId = connected.id;
      }
    }

    if (!targetAccountId) {
      return { success: false, error: "No connected LinkedIn account ID found in Unipile." };
    }

    try {
      const form = new FormData();
      form.append("account_id", targetAccountId);
      form.append("text", options.text.trim());
      if (options.externalLink) {
        const trimmed = options.externalLink.trim();
        // Guard: LinkedIn API rejects localhost or non-routable URLs in external_link preview cards
        if (!trimmed.includes("localhost") && !trimmed.includes("127.0.0.1")) {
          form.append("external_link", trimmed);
        }
      }

      const res = await fetch(`${dsn}/api/v1/posts`, {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "accept": "application/json",
        },
        body: form,
      });

      let data = await res.json().catch(() => ({}));

      // Fallback: If external_link card preview fails (e.g. crawler rejection),
      // retry without external_link so the post publishes with the apply link in the text body
      if (!res.ok && options.externalLink) {
        this.logger.warn(`Unipile external_link post returned HTTP ${res.status}. Retrying without preview card...`);
        const fallbackForm = new FormData();
        fallbackForm.append("account_id", targetAccountId);
        fallbackForm.append("text", options.text.trim());
        const retryRes = await fetch(`${dsn}/api/v1/posts`, {
          method: "POST",
          headers: {
            "X-API-KEY": key,
            "accept": "application/json",
          },
          body: fallbackForm,
        });
        if (retryRes.ok) {
          data = await retryRes.json().catch(() => ({}));
          const postId = String(data.post_id || data.id || "");
          const postUrl = postId
            ? `https://www.linkedin.com/feed/update/urn:li:activity:${postId}/`
            : "https://www.linkedin.com/";
          this.logger.log(`Successfully published post to LinkedIn via text fallback (Post ID: ${postId})`);
          return {
            success: true,
            postId,
            postUrl,
          };
        }
      }

      if (!res.ok) {
        const errorMsg =
          data?.detail ||
          data?.message ||
          data?.error ||
          data?.title ||
          (typeof data === "string" ? data : `HTTP ${res.status}`);
        this.logger.error(`Unipile create post failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const postId = String(data.post_id || data.id || "");
      const postUrl = postId
        ? `https://www.linkedin.com/feed/update/urn:li:activity:${postId}/`
        : "https://www.linkedin.com/";

      this.logger.log(`Successfully published post to LinkedIn via Unipile (Post ID: ${postId})`);
      return {
        success: true,
        postId,
        postUrl,
      };
    } catch (err: any) {
      this.logger.error(`Failed to publish LinkedIn post: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Creates an official LinkedIn Job Posting (and attempts to publish it via FREE mode) via Unipile.
   */
  async createLinkedInJobPosting(
    options: CreateLinkedInJobPostingOptions,
  ): Promise<CreateLinkedInJobPostingResult> {
    const dsn = this.getDsn();
    const key = this.getApiKey(options.apiKey);
    let targetAccountId = this.getDefaultAccountId(options.accountId);

    if (!key) {
      return { success: false, error: "Unipile API key is not configured" };
    }

    if (!targetAccountId) {
      const connected = await this.getConnectedAccount(undefined, key);
      if (connected?.id) {
        targetAccountId = connected.id;
      }
    }

    if (!targetAccountId) {
      return { success: false, error: "No connected LinkedIn account ID found in Unipile." };
    }

    try {
      // 1. Resolve Location ID from LinkedIn
      let locationId = "90000084"; // Fallback: San Francisco Bay Area
      try {
        const locSearch = await fetch(
          `${dsn}/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(
            targetAccountId,
          )}&type=LOCATION&value=${encodeURIComponent(options.location || "United States")}`,
          {
            headers: { "X-API-KEY": key, accept: "application/json" },
          },
        );
        if (locSearch.ok) {
          const locData = await locSearch.json().catch(() => ({}));
          if (locData?.items?.[0]?.id) {
            locationId = String(locData.items[0].id);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed resolving location parameter ID: ${err.message}`);
      }

      // 2. Create Job Posting Draft on LinkedIn
      const workplaceType =
        options.workplace === "ON_SITE" || options.workplace === "HYBRID"
          ? options.workplace
          : "REMOTE";

      const createDraftRes = await fetch(`${dsn}/api/v1/linkedin/jobs`, {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          account_id: targetAccountId,
          job_title: { text: options.title.trim() },
          company: { text: (options.companyName || "Venus Consultancy").trim() },
          workplace: workplaceType,
          location: locationId,
          description: options.descriptionHtml,
        }),
      });

      const draftData = await createDraftRes.json().catch(() => ({}));
      if (!createDraftRes.ok || !draftData.job_id) {
        const errorMsg =
          draftData?.detail || draftData?.message || `HTTP ${createDraftRes.status}`;
        this.logger.error(`Failed creating LinkedIn job draft: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const jobId = String(draftData.job_id);
      const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;

      // 3. Publish the Draft in FREE mode
      const publishRes = await fetch(`${dsn}/api/v1/linkedin/jobs/${jobId}/publish`, {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          account_id: targetAccountId,
          mode: "FREE",
          bypass_email_verification: true,
        }),
      });

      const publishData = await publishRes.json().catch(() => ({}));

      if (publishRes.ok) {
        this.logger.log(`LinkedIn Job Posting ${jobId} published successfully live!`);
        return {
          success: true,
          jobId,
          jobUrl,
          isDraft: false,
        };
      }

      // LinkedIn requires 1-time government ID verification for free posting
      const verificationUrl =
        typeof publishData?.detail === "string" &&
        publishData.detail.includes("linkedin.com")
          ? publishData.detail
          : undefined;

      this.logger.warn(
        `LinkedIn Job ${jobId} created as Draft. Action required to go live: ${publishData?.detail || publishRes.status}`,
      );

      return {
        success: true,
        jobId,
        jobUrl,
        isDraft: true,
        verificationRequired: Boolean(verificationUrl),
        verificationUrl,
      };
    } catch (err: any) {
      this.logger.error(`Error in createLinkedInJobPosting: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}


