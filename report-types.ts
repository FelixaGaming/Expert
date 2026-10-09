// Report format shared by the server (which builds and checks it) and the page (which shows it).

export type EvidenceStatus =
  | 'verified' // supported by a directly accessible, reliable source
  | 'self-reported' // stated by the person on their own site or profile
  | 'observed' // an actual public reaction, comment, testimonial or interaction
  | 'inference' // interpretation derived from identifiable evidence
  | 'hypothesis' // possible explanation without enough evidence
  | 'unknown'; // unavailable or not supported well enough

export interface SourceRecord {
  id: string; // S1, S2...
  url: string;
  title: string;
  kind: string; // search result, news, scholarly record, page, social profile, encyclopedia, your confirmed page...
  selfAuthored: boolean; // probably written by the person or their organization
  accessedAt: string; // ISO date
  published?: string; // date when the source states one
  excerpt: string; // what we read from it
  flags: string[]; // plain-language warnings: "Probably written by the subject", "Date unknown", "Only a search snippet"...
}

export interface Finding {
  text: string;
  status: EvidenceStatus;
  sources: string[]; // SourceRecord ids that were checked and exist
  reasoning?: string; // required for inference and hypothesis
  excerpt?: string; // exact words from the first source
  excerptVerified?: boolean; // true when the excerpt was found in the source
  note?: string; // why the server changed the status
}

export type RecognitionKind = 'invited' | 'delivered' | 'appointed' | 'contributed' | 'mentioned';

export interface RecognitionItem {
  kind: RecognitionKind;
  text: string;
  sources: string[];
}

export type CommentAuthor = 'third-party' | 'subject' | 'organization';

export interface PublicComment {
  text: string; // exact words
  sourceId: string;
  url: string;
  platform: string;
  date?: string;
  context: string;
  author: CommentAuthor; // independent third parties are kept apart from promotional text
  tone: 'positive' | 'neutral' | 'critical' | 'mixed';
}

export type IndicatorRating = 'strong' | 'partial' | 'none_found' | 'unknown';

export interface Indicator {
  key: string;
  label: string;
  weight: number;
  rating: IndicatorRating;
  sources: string[];
  note?: string;
}

export interface DimensionScore {
  key: string;
  label: string;
  question: string; // what this dimension measures
  score: number | null; // null = not enough evidence to score
  coverage: number; // 0..1 share of the weight that could be judged
  indicators: Indicator[];
  limitations: string;
}

export interface Gap {
  title: string;
  intended: string; // what the person's own channels say
  observed: string; // what independent sources show
  status: EvidenceStatus;
  confirmWith: string; // what evidence would settle it
  sources: string[];
}

export interface Peer {
  name: string;
  whyComparable: string;
  strongerThanSubject: string[];
  moreVisibleIn: string[];
  sources: string[];
}

export interface Recommendation {
  title: string;
  why: string;
  importance: 'high' | 'medium' | 'low';
  benefit: string;
  effort: 'low' | 'medium' | 'high';
  successMeasure: string;
  sources: string[];
}

export interface ReportCoverage {
  sourcesUsed: number;
  pagesRead: number;
  platformsFound: string[];
  platformsNotFound: string[];
  searchLimited: boolean;
}

export interface SelfAssessmentAnswer {
  question: string;
  answer: string;
}

export interface ReportV2 {
  version: 2;
  subjectName: string;
  generatedAt: string;
  provisional: boolean; // true when the research is too thin to be firm
  provisionalReasons: string[];
  coverage: ReportCoverage;

  // 1. Executive assessment
  executive: {
    headline: string;
    findings: Finding[];
    confidence: 'low' | 'medium' | 'high';
    confidenceWhy: string;
    limitations: string[];
  };

  // 2. Verified professional profile
  profile: {
    education: Finding[];
    experience: Finding[];
    research: Finding[];
    business: Finding[];
    awards: Finding[];
    speakingMedia: Finding[];
    collaborations: Finding[];
    achievements: Finding[];
    notFound: string[]; // "No public evidence found for ..." (not proof it does not exist)
  };

  // 3. Public discoverability
  discoverability: {
    findings: Finding[];
  };

  // 4. External reputation
  reputation: {
    comments: PublicComment[];
    droppedComments: number; // claimed comments that could not be found in the sources
    sentiment: { status: 'scored' | 'insufficient'; counts?: Record<string, number>; total: number; note: string };
    recognition: RecognitionItem[];
    criticism: Finding[];
  };

  // 5. Perception alignment
  perception: {
    selfPerception: Finding[]; // only from the person's own answers
    selfAssessmentGiven: boolean;
    intendedIdentity: Finding[];
    observedExternal: Finding[];
    gaps: Gap[];
  };

  // 6. Competitive positioning
  competitive: {
    field: string;
    peers: Peer[];
    gapsWorthAddressing: Finding[];
    note: string;
  };

  // 7. Gaps and risks
  risks: {
    missingEvidence: string[];
    inconsistencies: Finding[];
    outdated: Finding[];
    duplicateIdentities: Finding[];
  };

  // 8. Strategic recommendations
  recommendations: Recommendation[];

  // 9. Evidence appendix
  scores: DimensionScore[];
  sources: SourceRecord[];
  methodology: string[];
}
