export interface BehavioralDimension {
  name: string;
  score: number; // 0-100
  benchmark: number;
  gap: number;
  status: 'optimal' | 'moderate' | 'critical';
  description: string;
  evidence: string;
}

export interface WebFootprintItem {
  title: string;
  source: string;
  type: string;
  observation: string;
}

export interface PRGapItem {
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
  impactOnRevenue: string;
  actionableRecommendation: string;
}

export interface BehavioralTimelineItem {
  phase: string;
  timeframe: string;
  focus: string;
  actions: string[];
  expectedImpact: string;
  revenueUpside: string;
}

export interface WebSource {
  title: string;
  url: string;
}

export interface DisclosedSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  category: 'Academic & Scholarly' | 'Corporate & Registry' | 'Media & Press' | 'Speaking & Audio' | 'Social & Commentary' | 'Interviews & Podcasts' | 'Authored Articles' | 'Digital Archive';
  dateOrEra?: string;
  discoveredEvidence: string;
  contextualSignificance: string;
  authorityImpact: 'High Credibility' | 'Moderate Signal' | 'Friction / Outdated' | 'Untapped Asset';
}

export interface PublicDiscoveryLayer {
  layerNumber: number;
  name: string;
  subtitle: string;
  whatIsDiscovered: string;
  perceivedGravity: 'High Gravitas' | 'Moderate Alignment' | 'Fragile / Understated' | 'Missing';
  friendlyInsights: string[];
  forensicInsights?: string[]; // Kept for backwards compatibility
  evidenceExcerpts: string[];
}

export type DeepExcavationLayer = PublicDiscoveryLayer;

export interface VirtualPresenceChannel {
  channel: string;
  maturity: 'Category Leader' | 'Established Presence' | 'Emerging / Fragmented' | 'Dormant / Stealth';
  coverageScore: number; // 0-100
  observedNarrative: string;
  contextualDiagnosis: string;
}

export interface DeepMirrorReflection {
  executiveSummary: string;
  verifiedCoreStrengths: string[];
  discoveredPerceptionRisks: string[];
  theUnindexedAsset: string;
  outsideWorldVerdict: string;
  investorOrBuyerVerdict?: string; // Kept for backwards compatibility
}

export type ForensicDueDiligence = DeepMirrorReflection;

// Mirror Comparison: Who You Think You Are vs. How People Actually See You
export interface MirrorGapAspect {
  aspect: string; // e.g., "Education & Alma Mater", "Career & Work Experience", "Awards & Accolades", "Obstacles & Problems Faced", "Core Essence"
  howYouSeeIt: string;
  howTheWorldSeesIt: string;
  clearExampleOrQuote: string;
  friendlyGuidance: string;
}

export interface MirrorComparison {
  selfPerceptionSummary: string; // Who you think you are
  publicPerceptionSummary: string; // What people actually think of you
  educationReflection: {
    schoolsAndDegrees: string;
    howYouViewIt: string;
    howPeoplePerceiveIt: string;
    quoteOrSignal: string;
  };
  workExperienceReflection: {
    rolesAndMilestones: string;
    howYouViewIt: string;
    howPeoplePerceiveIt: string;
    quoteOrSignal: string;
  };
  awardsReflection: {
    recognitionsAndHonors: string;
    howYouViewIt: string;
    howPeoplePerceiveIt: string;
    quoteOrSignal: string;
  };
  challengesAndProblemsReflection: {
    problemsOrMisconceptions: string;
    howYouViewIt: string;
    howPeoplePerceiveIt: string;
    quoteOrSignal: string;
  };
  gapBreakdown: MirrorGapAspect[];
}

// Longitudinal Perception: How they are seen across the years
export interface LongitudinalEra {
  era: string; // e.g. "Early Career / Academic Foundation (2014-2018)"
  years: string;
  definingNarrative: string;
  publicReception: string;
  sentimentShift: 'Formative / Low Visibility' | 'Rising Authority' | 'Established Category Anchor' | 'Pivoting / Broadening';
  keyMilestones: string[];
}

// Public & Social Audience Discourse: LinkedIn, Facebook, Forums, Comments, Talks
export interface SocialPlatformDossier {
  platform: 'LinkedIn' | 'Facebook' | 'Industry Forums & YouTube' | 'Scholarly & Professional Communities';
  handleOrProfile: string;
  audienceType: string; // e.g. "C-Suite, Founders, VP of Product", "Broader community & enthusiasts"
  dominantTone: 'Deep Respect & Endorsement' | 'Intellectual Debate' | 'Passive Observation' | 'Mixed Engagement';
  recurringCommentThemes: string[];
  sampleResponses: {
    archetype: string; // e.g. "Enterprise Executive", "Peer Academic", "Industry Skeptic", "Junior Practitioner"
    quoteOrSentiment: string;
    context: string;
  }[];
  engagementMetrics: {
    resonanceScore: number; // 0-100
    discourseDepth: 'High-Level & Substantive' | 'Transactional' | 'Conversational' | 'Quiet / Under-leveraged';
    sentimentRatio: string; // e.g. "88% Positive / 10% Inquisitive / 2% Critical"
  };
}

export interface AudienceResponseAnalysis {
  overallDiscourseSummary: string;
  longitudinalEvolution: LongitudinalEra[];
  platformDossiers: SocialPlatformDossier[];
  sentimentSynthesis: {
    whatPeoplePraiseMost: string[];
    whatAudiencesQuestionOrDebate: string[];
    perceivedRelatabilityVsDistance: string;
  };
}

// 1. How the person describes herself in social media, interviews, articles (Self-Account)
export interface SocialMediaBioSource {
  platform: 'LinkedIn' | 'Facebook' | 'Twitter / X' | 'Instagram' | 'Personal Bio' | 'Substack';
  handleOrUrl?: string;
  headline: string;
  selfDescriptionExcerpt: string;
  statedMissionAndValues: string;
  toneAndPosture: string;
}

export interface InterviewSelfAccount {
  outletOrHost: string;
  titleOrTopic: string;
  yearOrEra?: string;
  directSelfQuote: string;
  topicContext: string;
  underlyingSelfView: string;
}

export interface ArticleAuthorStatement {
  publication: string;
  title: string;
  authorBioOrStatement: string;
  statedMission: string;
  primaryPerspective: string;
}

export interface SelfDescriptionFromSources {
  synthesizedSelfAccount: string; // What this person thinks of themselves, synthesized from their own public words
  primarySelfArchetype: string; // How they conceptualize their role
  coreSelfBeliefs: string[];
  socialMediaBios: SocialMediaBioSource[];
  interviewsAndPodcasts: InterviewSelfAccount[];
  articlesAndAuthoredPieces: ArticleAuthorStatement[];
}

// 2. Evaluation of comments under posts, articles, and interviews
export interface EvaluatedCommentItem {
  commenterRole: string; // e.g. "Senior Game Director", "Peer Clinical Psychologist", "Parent Advocate"
  commentText: string;
  sentiment: 'positive' | 'constructive' | 'skeptical';
  reflectionInsight: string; // What this reveals about perception vs how they described themselves
}

export interface EvaluatedCommentThread {
  sourceTitle: string;
  sourceType: 'Social Media Post' | 'Article & Op-Ed' | 'Interview & Podcast' | 'Conference & Keynote';
  platform: 'LinkedIn' | 'Facebook' | 'YouTube' | 'Industry Press' | 'Forum & Community';
  totalAnalyzedComments?: number;
  dominantSentiment: 'Overwhelmingly Endorsing' | 'Inquisitive & Probing' | 'Constructive Debate' | 'Critical / Skeptical' | 'Warm Peer Support';
  sentimentRatio: string;
  sampleComments: EvaluatedCommentItem[];
  keyCommentThemes: string[];
  contrastWithSelfDescription: string;
}

export interface ContrastHighlight {
  selfClaim: string;
  sourceContext: string;
  commentersConsensus: string;
  mirrorTakeaway: string;
}

export interface EvaluatedCommentsAndFeedback {
  overallCommentsSummary: string; // Comprehensive evaluation of comments under posts, articles, interviews
  commentThreads: EvaluatedCommentThread[];
  contrastHighlights: ContrastHighlight[];
  netPublicSentimentScore: number; // 0-100
  sentimentBreakdown: {
    admirationAndPraise: number; // %
    curiosityAndInquiry: number; // %
    constructiveSkepticism: number; // %
  };
}

export interface BehavioralReportData {
  subjectName: string;
  primaryArchetype: string;
  archetypeTagline: string;
  outerImpression: string;
  mirrorGap: string;
  overallPresenceQuotient: number;
  dimensions: BehavioralDimension[];
  sentimentDistribution: {
    positiveEndorsement: number;
    neutralInformational: number;
    criticalChallenging: number;
    unindexedExpertise: number;
  };
  discoveredFootprint: WebFootprintItem[];
  prAndVisibilityGaps: PRGapItem[];
  timeline: BehavioralTimelineItem[];
  webSources?: WebSource[];

  // Deep Analytics & Perception Mirror Extensions
  deepExcavation: PublicDiscoveryLayer[];
  disclosedSources: DisclosedSource[];
  virtualPresenceMatrix: VirtualPresenceChannel[];
  deepMirrorReflection: DeepMirrorReflection;
  forensicDueDiligence?: DeepMirrorReflection; // Backwards compatibility

  // Mirror Comparison: Self-View vs Public Reality (Education, Work, Awards, Problems)
  mirrorComparison?: MirrorComparison;

  // Longitudinal & Social Audience Discourse Analytics
  audienceResponseAnalysis?: AudienceResponseAnalysis;
  verifiedWebsitesCount?: number;
  excludedWebsitesCount?: number;

  // Self-Account from Social Media, Interviews, Articles
  selfDescriptionFromSources?: SelfDescriptionFromSources;

  // Audience Comments Evaluation (under posts, articles, interviews)
  evaluatedCommentsAndFeedback?: EvaluatedCommentsAndFeedback;
}

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

export interface CandidateDiscoveryDossier {
  subjectName: string;
  affiliation?: string;
  domain?: string;
  websites: DiscoveredWebsite[];
  credentials: DiscoveredFactItem[];
  education: DiscoveredFactItem[];
  awards: DiscoveredFactItem[];
  publications: DiscoveredFactItem[];
  interviews: DiscoveredFactItem[];
  articles: DiscoveredFactItem[];
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

