// Shapes used by the profile search and the page-check window. The report itself is in report-types.ts.

export interface ScrapedWebsiteData {
  url: string;
  domain: string;
  platform: string;
  title: string;
  snippet: string;
  headings?: string[];
  bodySnippets?: string[];
  extractedQuotes?: string[];
  audienceReactions?: string[];
  keySignals?: string[];
  isSocialNetwork?: boolean;
  scrapedAt?: string;
}

export interface DiscoveredWebsite {
  id: string;
  title: string;
  url: string;
  platform: string; // e.g. "Official Platform", "LinkedIn", "Facebook", "Google Scholar", "Research / Publication", "Social & Community", "Press & Media", "Corporate Registry", "Possible Namesake"
  domain: string;
  snippet: string;
  isConfirmed: boolean;
  associationReason: string;
  isPotentialCollision?: boolean;
  needsReview?: boolean; // found automatically on a social platform: the user should check it is really them
  isCustomAdded?: boolean;
  scrapedData?: ScrapedWebsiteData;
}

export type DiscoveryCategory =
  | 'websites'
  | 'credentials'
  | 'education'
  | 'awards'
  | 'publications'
  | 'interviews'
  | 'articles';

export interface DiscoveredFactItem {
  id: string;
  category: DiscoveryCategory;
  title: string; // e.g. "PhD in Cognitive Psychology", "Rector's Award for Scientific Excellence"
  subtitle?: string; // e.g. "University of Lodz", "HarperCollins", "Axel Springer Keynote"
  description?: string;
  url?: string;
  dateOrYear?: string;
  isConfirmed: boolean;
  isPotentialCollision?: boolean;
  isCustomAdded?: boolean;
  sourceOrigin?: string; // e.g. "Verified Institutional Registry", "User Added", "Academic Index"
  websiteData?: DiscoveredWebsite;
}

export interface ExpertProfileInput {
  name: string;
  selfPerception?: string;
  domain?: string;
  educationSchools?: string;
  workExperience?: string;
  awardsAccolades?: string;
  problemsChallenges?: string;
  publicUrl?: string;
  primaryMedium?: string;
  affiliation?: string;
  communicationPosture?: string;
  verifiedWebsites?: DiscoveredWebsite[];
  excludedWebsites?: DiscoveredWebsite[];
  confirmedItems?: {
    websites?: DiscoveredWebsite[];
    credentials?: DiscoveredFactItem[];
    education?: DiscoveredFactItem[];
    awards?: DiscoveredFactItem[];
    publications?: DiscoveredFactItem[];
    interviews?: DiscoveredFactItem[];
    articles?: DiscoveredFactItem[];
  };
}
