import { LinkedInAdapter } from "./linkedin.adapter";
import type { UnipileService } from "../../linkedin-connection/unipile.service";
import type { JobBoardPostInput } from "../job-board.types";

describe("LinkedInAdapter", () => {
  let unipile: {
    isConfigured: jest.Mock;
    createLinkedInPost: jest.Mock;
  };
  let adapter: LinkedInAdapter;

  const mockJob: JobBoardPostInput = {
    id: "job-101",
    jobCode: "REQ-2026-042",
    title: "Senior Full Stack Engineer",
    description: "Build scalable web applications and distributed architectures.",
    location: "San Francisco, CA",
    employmentType: "FULL_TIME",
    skillsRequired: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    budgetMin: 140000,
    budgetMax: 180000,
    currency: "USD",
  };

  beforeEach(() => {
    unipile = {
      isConfigured: jest.fn(),
      createLinkedInPost: jest.fn(),
    };
    adapter = new LinkedInAdapter(unipile as unknown as UnipileService);
  });

  it("reports simulated=true and returns simulated listing when Unipile is unconfigured", async () => {
    unipile.isConfigured.mockReturnValue(false);

    expect(adapter.simulated).toBe(true);

    const result = await adapter.post(mockJob);
    expect(result.externalUrl).toContain("/careers/job-101?source=linkedin");
    expect(unipile.createLinkedInPost).not.toHaveBeenCalled();
  });

  it("automatically posts live announcement to connected LinkedIn profile via Unipile when configured", async () => {
    unipile.isConfigured.mockReturnValue(true);
    unipile.createLinkedInPost.mockResolvedValue({
      success: true,
      postId: "7519406233548939265",
      postUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7519406233548939265/",
    });

    expect(adapter.simulated).toBe(false);

    const result = await adapter.post(mockJob);

    expect(unipile.createLinkedInPost).toHaveBeenCalledTimes(1);
    const postArgs = unipile.createLinkedInPost.mock.calls[0][0];

    expect(postArgs.text).toContain("SENIOR FULL STACK ENGINEER");
    expect(postArgs.text).toContain("San Francisco, CA");
    expect(postArgs.text).toContain("React");
    expect(postArgs.text).toContain("TypeScript");
    expect(postArgs.text).toContain("/careers/job-101?source=linkedin");
    expect(postArgs.externalLink).toContain("/careers/job-101?source=linkedin");

    expect(result).toEqual({
      externalId: "7519406233548939265",
      externalUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7519406233548939265/",
    });
  });

  it("throws when Unipile post creation fails so syndication status is marked as FAILED", async () => {
    unipile.isConfigured.mockReturnValue(true);
    unipile.createLinkedInPost.mockResolvedValue({
      success: false,
      error: "LinkedIn session expired. Reconnection required.",
    });

    await expect(adapter.post(mockJob)).rejects.toThrow(
      "LinkedIn session expired. Reconnection required.",
    );
  });
});
