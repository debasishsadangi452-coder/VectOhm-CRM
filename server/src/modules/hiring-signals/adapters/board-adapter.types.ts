// Shared shape every board adapter normalizes into -- one row per open
// posting found for a given company/board.
export interface DiscoveredJobPosting {
  externalJobId: string;
  title: string;
  url: string;
}
