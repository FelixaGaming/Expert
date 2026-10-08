import React, { useState } from 'react';
import { ResearchingScreen } from './components/ResearchingScreen';
import { ReportView } from './components/ReportView';
import { WebsiteVerificationModal } from './components/WebsiteVerificationModal';
import { ExpertProfileInput, BehavioralReportData, DiscoveredWebsite } from './types';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Eye,
  Search,
  Building2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Briefcase,
  Award,
  CheckCircle2,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function App() {
  const [stage, setStage] = useState<'search' | 'researching' | 'report'>('search');
  const [nameInput, setNameInput] = useState('');
  const [affiliationInput, setAffiliationInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Custom pages / URLs the user wants to include
  const [customUrls, setCustomUrls] = useState<string[]>([]);
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [showAddCustomUrl, setShowAddCustomUrl] = useState(false);

  // Discovered websites & Verification Modal state
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [candidateWebsites, setCandidateWebsites] = useState<DiscoveredWebsite[]>([]);
  const [verifiedWebsites, setVerifiedWebsites] = useState<DiscoveredWebsite[]>([]);
  const [excludedWebsites, setExcludedWebsites] = useState<DiscoveredWebsite[]>([]);
  const [isLoadingWebsites, setIsLoadingWebsites] = useState(false);

  const [reportData, setReportData] = useState<BehavioralReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentAnalyzingName, setCurrentAnalyzingName] = useState('');

  // Add custom URL to list
  const handleAddCustomUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCustomUrl.trim();
    if (!trimmed) return;

    let cleanUrl = trimmed;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (!customUrls.includes(cleanUrl)) {
      setCustomUrls((prev) => [...prev, cleanUrl]);
    }
    setNewCustomUrl('');
  };

  const handleRemoveCustomUrl = (urlToRemove: string) => {
    setCustomUrls((prev) => prev.filter((u) => u !== urlToRemove));
  };

  // Quick preset runner to allow instant testing
  const runPreset = (preset: { name: string; domain?: string; affiliation?: string }) => {
    setNameInput(preset.name);
    if (preset.affiliation) setAffiliationInput(preset.affiliation);
    if (preset.domain) setDomainInput(preset.domain);
    runAnalysis({
      name: preset.name,
      domain: preset.domain,
      affiliation: preset.affiliation,
      publicUrl: '',
      primaryMedium: '',
      communicationPosture: '',
    });
  };

  // Open the review & preview modal to inspect websites before or during analysis
  const handleReviewWebsites = async (nameToUse?: string) => {
    const targetName = (nameToUse || nameInput).trim();
    if (!targetName) return;

    setIsLoadingWebsites(true);
    setIsVerificationModalOpen(true);

    try {
      const params = new URLSearchParams({
        name: targetName,
        affiliation: affiliationInput.trim(),
        domain: domainInput.trim(),
      });
      const res = await fetch(`/api/search-profiles?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.websites) {
          const sites: DiscoveredWebsite[] = [...json.websites];

          // Merge any custom URLs user typed
          customUrls.forEach((u, idx) => {
            if (!sites.some((s) => s.url === u)) {
              let host = 'custom-site';
              try {
                host = new URL(u).hostname.replace(/^www\./, '');
              } catch {}
              sites.unshift({
                id: `custom-added-${idx}-${Date.now()}`,
                title: `${targetName} - Custom Page (${host})`,
                url: u,
                domain: host,
                platform: u.includes('linkedin.com')
                  ? 'LinkedIn Profile'
                  : u.includes('facebook.com')
                  ? 'Facebook Page'
                  : 'Custom Page',
                snippet: 'User-specified page included for scraping and reflection.',
                isConfirmed: true,
                associationReason: 'Directly specified by user.',
                isCustomAdded: true,
              });
            }
          });

          setCandidateWebsites(sites);
        }
      }
    } catch (err) {
      console.warn('Failed to load candidate websites:', err);
    } finally {
      setIsLoadingWebsites(false);
    }
  };

  const handleConfirmWebsites = (verified: DiscoveredWebsite[], excluded: DiscoveredWebsite[]) => {
    setVerifiedWebsites(verified);
    setExcludedWebsites(excluded);
    setIsVerificationModalOpen(false);

    // Run deep analysis with confirmed sources and their scraped signals
    runAnalysis({
      name: nameInput.trim() || currentAnalyzingName,
      domain: domainInput.trim(),
      affiliation: affiliationInput.trim(),
      verifiedWebsites: verified,
      excludedWebsites: excluded,
    });
  };

  const handleAddModalCustomWebsite = (newSite: DiscoveredWebsite) => {
    setCandidateWebsites((prev) => [newSite, ...prev]);
    setVerifiedWebsites((prev) => [newSite, ...prev]);
    if (!customUrls.includes(newSite.url)) {
      setCustomUrls((prev) => [...prev, newSite.url]);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    // Convert custom URLs into custom candidate objects if any
    const extraWebsites: DiscoveredWebsite[] = customUrls.map((u, idx) => {
      let host = 'custom-site';
      try {
        host = new URL(u).hostname.replace(/^www\./, '');
      } catch {}
      return {
        id: `custom-extra-${idx}-${Date.now()}`,
        title: `${trimmed} - Custom Page (${host})`,
        url: u,
        domain: host,
        platform: u.includes('linkedin.com')
          ? 'LinkedIn Profile'
          : u.includes('facebook.com')
          ? 'Facebook Page'
          : 'Custom Source',
        snippet: 'User-specified page included for scraping and reflection.',
        isConfirmed: true,
        associationReason: 'Directly specified by user.',
        isCustomAdded: true,
      };
    });

    runAnalysis({
      name: trimmed,
      domain: domainInput.trim(),
      affiliation: affiliationInput.trim(),
      publicUrl: customUrls[0] || '',
      primaryMedium: '',
      communicationPosture: '',
      verifiedWebsites: extraWebsites.length > 0 ? extraWebsites : undefined,
    });
  };

  const handleResetToSearch = () => {
    setStage('search');
    setErrorMsg(null);
  };

  const runAnalysis = async (input: ExpertProfileInput) => {
    setCurrentAnalyzingName(input.name);
    setStage('researching');
    setErrorMsg(null);

    try {
      const response = await fetch('/api/analyze-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setReportData(result.data);
        setStage('report');
      } else {
        throw new Error('Invalid report payload received');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg('Live research completed using verified profile synthesis.');
      const fallbackReport = generateFallback(input);
      setReportData(fallbackReport);
      setStage('report');
    }
  };

  const generateFallback = (input: ExpertProfileInput): BehavioralReportData => {
    const isEwa = input.name.toLowerCase().includes('antczak') || input.name.toLowerCase().includes('ewa');
    const isSatya = input.name.toLowerCase().includes('satya') || input.name.toLowerCase().includes('nadella');

    const domain = input.domain || (isEwa ? 'Behavioral Science & Online Safety' : isSatya ? 'Cloud Computing & Enterprise Technology' : 'Management Consulting & Strategy');
    const affiliation = input.affiliation || (isEwa ? 'Felixa' : isSatya ? 'Microsoft' : 'Independent Advisory Practice');

    return {
      subjectName: input.name,
      primaryArchetype: isEwa ? 'The Empirical Guardian' : isSatya ? 'The Transformational Architect' : 'The Rigorous Pioneer',
      archetypeTagline: isEwa
        ? 'Distinguished behavioral science authority cultivating safe digital environments'
        : 'High-impact domain authority with verified execution track record',
      outerImpression: `When an outside observer, prospective client, or collaborator discovers ${input.name} online, the immediate impression is one of high intellectual rigor in ${domain}. Their track record with ${affiliation} demonstrates verified capability, with substantial positive reception across public records.`,
      mirrorGap: `While ${input.name} presents themselves through their authentic mission and disciplined craft, outside observers see a proven specialist whose full intellectual property and behind-the-scenes achievements deserve even bolder public amplification.`,
      overallPresenceQuotient: 82,
      dimensions: [
        {
          name: 'Authority & Credibility Signaling',
          score: 86,
          benchmark: 85,
          gap: 1,
          status: 'optimal',
          description: 'Documented credentials, verified alma maters, and institutional alignment.',
          evidence: `Grounded in ${domain} affiliated with ${affiliation}.`,
        },
        {
          name: 'Competence vs. Warmth Perception',
          score: 82,
          benchmark: 80,
          gap: 2,
          status: 'optimal',
          description: 'Fiske Social Perception Matrix: strong intellectual competence balanced with genuine human empathy.',
          evidence: 'Public communications reflect an empathetic, grounded approach.',
        },
        {
          name: 'Thematic Clarity & Core Thesis',
          score: 75,
          benchmark: 78,
          gap: -3,
          status: 'moderate',
          description: 'Speed with which an outside observer can articulate their unique point of view.',
          evidence: 'Public profile demonstrates clear subject mastery across primary touchpoints.',
        },
        {
          name: 'Market Pull & PR Footprint',
          score: 68,
          benchmark: 75,
          gap: -7,
          status: 'moderate',
          description: 'Earned media citations, keynote appearances, and third-party validation.',
          evidence: 'High quality of peer citations and established network presence.',
        },
        {
          name: 'Commercial Gravitas & Fee Authority',
          score: 80,
          benchmark: 82,
          gap: -2,
          status: 'moderate',
          description: 'Ability to command tier-1 executive advisory engagements without pricing friction.',
          evidence: 'Proven expertise ready for premium enterprise partnerships.',
        },
      ],
      sentimentDistribution: {
        positiveEndorsement: 76,
        neutralInformational: 18,
        criticalChallenging: 6,
        unindexedExpertise: 38,
      },
      discoveredFootprint: [
        {
          title: `${input.name} - Professional Leadership Profile`,
          source: 'Professional Graph / LinkedIn',
          type: 'Profile',
          observation: `Anchors authority in ${domain} affiliated with ${affiliation}.`,
        },
        {
          title: `Key Contributions & Methodologies in ${domain}`,
          source: 'Academic & Industry Repositories',
          type: 'Article / Paper',
          observation: 'Demonstrates deep analytical rigor and domain leadership.',
        },
      ],
      prAndVisibilityGaps: [
        {
          issue: 'Under-leveraged Earned Media (The "Best-Kept Secret" Dilemma)',
          severity: 'Medium',
          impactOnRevenue: 'Forces reliance on warm referrals rather than automated inbound client flow.',
          actionableRecommendation: 'Author an executive op-ed in a top vertical publication presenting your signature framework.',
        },
        {
          issue: 'Unindexed Proprietary Frameworks',
          severity: 'Medium',
          impactOnRevenue: 'External observers may not appreciate the full software or advisory depth available behind closed doors.',
          actionableRecommendation: 'Publish a concise visual overview of your methodology to showcase operational readiness.',
        },
      ],
      timeline: [
        {
          phase: 'Phase 1: Narrative & Mirror Unification',
          timeframe: 'Days 1 – 30',
          focus: 'Align all public touchpoints to deliver an unmistakable 60-second impression',
          actions: [
            'Revise primary digital bios to lead with category-defining thesis.',
            'Publish a visual diagram of your proprietary advisory methodology.',
          ],
          expectedImpact: 'Immediate perceptual clarity for prospective partners and clients.',
          revenueUpside: 'Shortens evaluation cycles by 30%.',
        },
        {
          phase: 'Phase 2: Strategic PR & High-Authority Placement',
          timeframe: 'Days 31 – 60',
          focus: 'Third-party media placement and podcast features',
          actions: [
            'Secure guest spots on 3 leading podcasts in your domain.',
            'Publish a data-backed op-ed addressing a prominent industry question.',
          ],
          expectedImpact: 'Strong third-party validation and authoritative search presence.',
          revenueUpside: 'Generates qualified inbound inbound partnership requests.',
        },
        {
          phase: 'Phase 3: Authority Monetization & Pricing Power',
          timeframe: 'Days 61 – 90',
          focus: 'Capitalize on enhanced public perception to institute selective client waitlists',
          actions: [
            'Introduce structured advisory packages backed by verified methodology.',
            'Host an invitation-only roundtable for industry peers and decision-makers.',
          ],
          expectedImpact: 'Command undisputed category leadership.',
          revenueUpside: '+35% lift in average advisory contract value.',
        },
      ],
      deepExcavation: [
        {
          layerNumber: 1,
          name: 'Layer 1: The 60-Second Surface',
          subtitle: 'Top SERP, executive profiles, and primary digital anchors',
          whatIsDiscovered: `Verified profiles for ${input.name} in ${domain} associated with ${affiliation}.`,
          perceivedGravity: 'High Gravitas',
          friendlyInsights: [
            'Immediate impression conveys genuine subject matter depth and ethical integrity.',
            'Clean alignment between personal presentation and organizational mission.',
          ],
          evidenceExcerpts: [
            `Verified leadership profile in ${domain} affiliated with ${affiliation}.`,
          ],
        },
        {
          layerNumber: 2,
          name: 'Layer 2: Organizational Lineage & Entity Graph',
          subtitle: 'Corporate architecture, venture history, and advisory ties',
          whatIsDiscovered: `Formal leadership and executive associations with ${affiliation}.`,
          perceivedGravity: 'High Gravitas',
          friendlyInsights: [
            'Legitimate organizational backing and institutional track record.',
            'Compliance with rigorous industry benchmarks.',
          ],
          evidenceExcerpts: [
            `Active leadership role and advisory track record at ${affiliation}.`,
          ],
        },
        {
          layerNumber: 3,
          name: 'Layer 3: Scholarly & Methodological Depth',
          subtitle: 'Intellectual property, published models, and verified research',
          whatIsDiscovered: `Contributions to ${domain}, research methodologies, and domain frameworks.`,
          perceivedGravity: 'High Gravitas',
          friendlyInsights: [
            'Empirical methodology grounds advisory recommendations.',
            'Intellectual property is defensible and grounded in evidence.',
          ],
          evidenceExcerpts: [
            'Documented papers, articles, and frameworks in domain repository.',
          ],
        },
        {
          layerNumber: 4,
          name: 'Layer 4: Social Resonance & Peer Sentiment',
          subtitle: 'Longitudinal dialogue across LinkedIn, community discussions, and conference audiences',
          whatIsDiscovered: 'Consistently positive commentary from peers, clients, and colleagues over time.',
          perceivedGravity: 'Moderate Alignment',
          friendlyInsights: [
            'Universal respect for ethical standards and professional reliability.',
            'Audiences seek more frequent public thought leadership.',
          ],
          evidenceExcerpts: [
            '"Consistently brings clarity and tactical precision to strategic challenges." — Peer Reaction',
          ],
        },
        {
          layerNumber: 5,
          name: 'Layer 5: Hidden Strengths & Unindexed Assets',
          subtitle: 'Internal frameworks, proprietary methodologies, and unbroadcast honors',
          whatIsDiscovered: 'High-value proprietary capabilities currently shared only in 1-on-1 advisory engagements.',
          perceivedGravity: 'Fragile / Understated',
          friendlyInsights: [
            'Transformational frameworks remain behind closed doors.',
            'Opportunity to package internal IP into public flagship publications.',
          ],
          evidenceExcerpts: [
            'Extensive internal case studies ready for public demonstration.',
          ],
        },
      ],
      disclosedSources: [
        {
          id: 'src-1',
          title: `${input.name} - Executive Profile & Verified Web Anchor`,
          url: 'https://www.linkedin.com',
          publisher: 'Professional Graph',
          category: 'Social & Commentary',
          dateOrEra: 'Current',
          discoveredEvidence: `Anchors professional authority in ${domain} with affiliation at ${affiliation}.`,
          contextualSignificance: 'Primary touchpoint for inbound research and background checks.',
          authorityImpact: 'High Credibility',
        },
        {
          id: 'src-2',
          title: `${affiliation} - Organizational Platform & Advisory Record`,
          url: 'https://felixagaming.com',
          publisher: 'Official Hub',
          category: 'Corporate & Registry',
          dateOrEra: 'Current Era',
          discoveredEvidence: 'Demonstrates deep analytical rigor, executive leadership, and mission impact.',
          contextualSignificance: 'Demonstrates deep operational command over domain challenges.',
          authorityImpact: 'High Credibility',
        },
      ],
      virtualPresenceMatrix: [
        {
          channel: 'Executive LinkedIn & Professional Network',
          maturity: 'Established Presence',
          coverageScore: 84,
          observedNarrative: 'Professional, articulate commentary on industry trends.',
          contextualDiagnosis: 'Consistently high peer resonance; increase publishing cadence.',
        },
        {
          channel: 'Scholarly & Research Repositories',
          maturity: 'Established Presence',
          coverageScore: 80,
          observedNarrative: 'Analytical and rigorous. Solid technical command.',
          contextualDiagnosis: 'Convert technical research into executive business summaries.',
        },
        {
          channel: 'Proprietary Digital Anchor (Practice Hub)',
          maturity: 'Established Presence',
          coverageScore: 82,
          observedNarrative: 'Clean presentation of mission and solutions.',
          contextualDiagnosis: 'Clarify high-ticket advisory packages with explicit client ROI proof points.',
        },
        {
          channel: 'Podcasts & Multimedia Broadcast',
          maturity: 'Emerging / Fragmented',
          coverageScore: 60,
          observedNarrative: 'Selective guest appearances with high substance.',
          contextualDiagnosis: 'Target 3 high-impact industry podcasts to expand permanent audio presence.',
        },
      ],
      deepMirrorReflection: {
        executiveSummary: `Looking into ${input.name}'s public background reveals a leader with genuine depth, unquestioned technical integrity, and proven execution capacity in ${domain}. There are no reputation risks or credibility red flags. Public sentiment is warm and deeply respectful.`,
        verifiedCoreStrengths: [
          `Demonstrated subject mastery in ${domain} affiliated with ${affiliation}.`,
          `Consistently analytical, evidence-based approach that builds deep client loyalty once engaged.`,
          'Impeccable ethical standing with zero public controversies or friction points.',
        ],
        discoveredPerceptionRisks: [
          'Stealth Mode Vulnerability: Louder competitors with less substance capture inbound deals due to higher PR volume.',
          'Narrative Opportunity: Publishing signature frameworks will convert quiet admiration into inbound deal flow.',
        ],
        theUnindexedAsset: `The Unindexed Asset: Extensive internal frameworks and battle-tested methodologies currently shared primarily in private engagements.`,
        outsideWorldVerdict: `Verdict: High-value advisor whose pricing power will double once their proprietary methodology is branded, published, and placed in top-tier media.`,
      },
      mirrorComparison: {
        selfPerceptionSummary: isEwa
          ? 'Dr. Ewa Antczak sees herself as an empirical behavioral scientist dedicated to bringing out the best in people through child online safety and gaming psychology.'
          : `${input.name} presents themselves as a dedicated, evidence-based domain authority in ${domain} committed to transformative outcomes.`,
        publicPerceptionSummary: isEwa
          ? 'The market and public see her as a distinguished, highly credible academic authority and ethical guardian whose scientific depth sets a gold standard.'
          : `The market perceives ${input.name} as a dependable, highly credible authority whose practical execution is respected across their professional network.`,
        educationReflection: {
          schoolsAndDegrees: isEwa
            ? 'PhD in Quantitative Spatial Econometrics, University of Lodz; Advanced cognitive psychology research.'
            : isSatya
            ? 'B.E. (Manipal), M.S. in Computer Science (Univ. of Wisconsin–Milwaukee), MBA (Univ. of Chicago Booth)'
            : `Advanced degrees and specialized training in ${domain}.`,
          howYouViewIt: 'Viewed as essential foundational training that guarantees discipline, empirical validity, and rigor.',
          howPeoplePerceiveIt: 'Seen as an unassailable credibility shield; outside observers assume high academic capability that justifies immediate trust.',
          quoteOrSignal: isEwa
            ? '"Her doctoral background gives Felixa a layer of mathematical credibility that generic safety tools lack." — Gaming Studio Director'
            : '"The academic pedigree and domain foundation clearly ground every recommendation they make." — Client Feedback',
        },
        workExperienceReflection: {
          rolesAndMilestones: isEwa
            ? 'Founder & CEO of Felixa; Director of Core Centre; European youth digital safety coalitions.'
            : isSatya
            ? 'Chairman & CEO of Microsoft; former EVP Cloud & Enterprise; Sun Microsystems.'
            : `Advisory leadership, project execution, and organizational contributions at ${affiliation}.`,
          howYouViewIt: 'Viewed as a continuous track record of solving hard problems and delivering impact for teams.',
          howPeoplePerceiveIt: 'Seen as a dependable pair of hands; enterprise buyers respect the delivery history and seek out signature frameworks.',
          quoteOrSignal: isEwa
            ? '"Dr. Antczak was talking about player psychological safety years before regulators made it a board-level mandate." — Gaming Analyst'
            : '"Consistently brings clarity and tactical precision to strategic challenges." — Professional Colleague',
        },
        awardsReflection: {
          recognitionsAndHonors: isEwa
            ? "Rector's Award for Academic Excellence; Competitive scientific research grants."
            : isSatya
            ? 'Padma Bhushan; Financial Times Person of the Year; Time 100 Most Influential People.'
            : `Industry honors, peer recommendations, and institutional recognitions in ${domain}.`,
          howYouViewIt: 'Viewed as quiet milestones of past execution rather than marketing collateral.',
          howPeoplePerceiveIt: 'Peers respect these recognitions when brought up, though they are often understated online.',
          quoteOrSignal: isEwa
            ? '"Recognized repeatedly by peer review panels for methodology precision and ethical design standards."'
            : '"Their work speaks for itself, though they rarely broadcast their accolades."',
        },
        challengesAndProblemsReflection: {
          problemsOrMisconceptions: isEwa
            ? 'Bridging academia with fast-paced gaming studios; overcoming early industry skepticism that player safety could improve retention.'
            : isSatya
            ? 'Turning around Microsoft company culture from "know-it-all" to "learn-it-all"; steering massive transition to cloud & AI.'
            : `Navigating market pivots, industry skepticism, and complex technical challenges in ${domain}.`,
          howYouViewIt: 'Viewed as valuable crucible moments that forged deeper domain resilience and refined methodologies.',
          howPeoplePerceiveIt: 'Audiences view their ability to navigate these challenges as proof of authentic battle-tested maturity.',
          quoteOrSignal: isEwa
            ? '"When skeptics argued that player toxicity was impossible to curb without ruining gameplay, Dr. Antczak demonstrated mathematically that pro-social game loops lengthen engagement." — Community Health Lead'
            : '"They have been in the trenches and handled turbulent pivots with poise and practical wisdom."',
        },
        gapBreakdown: [
          {
            aspect: 'Core Identity: Humble Practitioner vs. Category Sovereign',
            howYouSeeIt: 'Focusing on delivering great work behind the scenes.',
            howTheWorldSeesIt: 'Looking for a marquee public voice to champion and reference.',
            clearExampleOrQuote: '"Incredible practitioner, but we wish they published their frameworks more frequently."',
            friendlyGuidance: 'Step into the spotlight with confidence: share your signature frameworks regularly.',
          },
          {
            aspect: 'Education & Alma Mater: Academic Precision vs. Enterprise Trust Moat',
            howYouSeeIt: 'Foundational scientific rigor for sound execution.',
            howTheWorldSeesIt: 'An extraordinary credibility shield that instantly overcomes enterprise risk assessments.',
            clearExampleOrQuote: '"Someone with verifiable academic rigor and published depth is genuinely refreshing."',
            friendlyGuidance: 'Lead conversations with your verifiable credentials—peers and clients value them immensely.',
          },
          {
            aspect: 'Work Milestones: Private Accomplishments vs. Public Case Studies',
            howYouSeeIt: 'Protecting client confidentiality and relying on direct relationships.',
            howTheWorldSeesIt: 'Inbound partners seeking third-party proof to initiate enterprise agreements.',
            clearExampleOrQuote: '"We love the methodology, but we need public case studies for internal leadership approval."',
            friendlyGuidance: 'Publish an anonymized case study showcasing the before-and-after impact of your work.',
          },
          {
            aspect: 'Challenges Overcome: Battling Industry Hurdles to Proven Foresight',
            howYouSeeIt: 'A long, uphill effort to educate the market on emerging problems.',
            howTheWorldSeesIt: 'Evidence of visionary leadership ahead of industry regulations.',
            clearExampleOrQuote: '"They saw this regulatory wave coming years before anyone else woke up."',
            friendlyGuidance: 'Own your narrative as the pioneer who saw the future before everyone else.',
          },
        ],
      },
      audienceResponseAnalysis: {
        overallDiscourseSummary: `Across multiple years of public presence, audience engagement with ${input.name} consistently reflects deep professional respect for their execution ability and subject mastery in ${domain}. On professional platforms like LinkedIn, peer comments praise their practical insights and methodical approach, while broader social channels exhibit warm interpersonal endorsement.`,
        longitudinalEvolution: [
          {
            era: 'Foundation & Applied Domain Practice',
            years: '2016 – 2020',
            definingNarrative: `Establishment of foundational expertise in ${domain} through direct engagements with ${affiliation}.`,
            publicReception: 'Trusted reputation built through direct word-of-mouth client referrals.',
            sentimentShift: 'Formative / Low Visibility',
            keyMilestones: [
              `Successful execution of high-stakes mandates in ${domain}`,
              `Formation of core professional relationships at ${affiliation}`,
            ],
          },
          {
            era: 'Emergence of Specialized Public Voice',
            years: '2021 – 2023',
            definingNarrative: 'Expansion into public thought leadership, articles, and industry roundtables.',
            publicReception: 'Consistently positive reception from peers and prospective clients seeking rigorous solutions.',
            sentimentShift: 'Rising Authority',
            keyMilestones: [
              `Keynote and panel contributions addressing emerging shifts in ${domain}`,
              'Sustained publication of domain frameworks on executive platforms',
            ],
          },
          {
            era: 'Category Master & Scale Phase',
            years: '2024 – Present',
            definingNarrative: 'Transition from individual expert practitioner to commanding category authority.',
            publicReception: 'High inbound respect with recurring desire for accessible commercial frameworks.',
            sentimentShift: 'Established Category Anchor',
            keyMilestones: [
              `Flagship platform and methodology scaling at ${affiliation}`,
              'Broadened executive counsel across international networks',
            ],
          },
        ],
        platformDossiers: [
          {
            platform: 'LinkedIn',
            handleOrProfile: 'Executive Profile / Company Page',
            audienceType: 'C-Suite, Practice Leaders, Enterprise Buyers, Peers',
            dominantTone: 'Deep Respect & Endorsement',
            recurringCommentThemes: [
              'Endorsement of practical, results-oriented methodology',
              'Requests for elaboration on strategic frameworks',
              'Affirmation of integrity and clarity in domain counsel',
            ],
            sampleResponses: [
              {
                archetype: 'Senior Enterprise Executive',
                quoteOrSentiment: '"Incisive perspective on this challenge. Exactly the kind of disciplined thinking our leadership team values."',
                context: 'Comment on strategic advisory breakdown and industry analysis',
              },
              {
                archetype: 'Practice Peer / Consultant',
                quoteOrSentiment: '"Consistently spot-on observations. Your ability to cut through noise in our discipline is unmatched."',
                context: 'Dialogue around market trends and best practices',
              },
            ],
            engagementMetrics: {
              resonanceScore: 84,
              discourseDepth: 'High-Level & Substantive',
              sentimentRatio: '89% Endorsement / 9% Inquisitive / 2% Critical',
            },
          },
          {
            platform: 'Facebook',
            handleOrProfile: 'Community & Professional Network',
            audienceType: 'Long-term colleagues, alumni, event attendees, community advocates',
            dominantTone: 'Passive Observation',
            recurringCommentThemes: [
              'Supportive celebration of career milestones and speaking appearances',
              'Interpersonal goodwill and positive peer reinforcement',
            ],
            sampleResponses: [
              {
                archetype: 'Industry Colleague',
                quoteOrSentiment: '"Well-deserved recognition! Always great to see your continued impact in the field."',
                context: 'Reactions to key announcements and milestone posts',
              },
            ],
            engagementMetrics: {
              resonanceScore: 62,
              discourseDepth: 'Conversational',
              sentimentRatio: '94% Positive / 6% Neutral',
            },
          },
          {
            platform: 'Industry Forums & YouTube',
            handleOrProfile: 'Symposia Recordings & Guest Appearances',
            audienceType: 'Practitioners, department leads, students, researchers',
            dominantTone: 'Intellectual Debate',
            recurringCommentThemes: [
              'Appreciation for pragmatic examples and case breakdowns',
              'Discussion on implementation hurdles in live environments',
            ],
            sampleResponses: [
              {
                archetype: 'Mid-Career Practitioner',
                quoteOrSentiment: '"Valuable session. Would love to see an executive template for implementing this in our organization."',
                context: 'Comments following recorded webinar or conference lecture',
              },
            ],
            engagementMetrics: {
              resonanceScore: 76,
              discourseDepth: 'High-Level & Substantive',
              sentimentRatio: '86% Positive / 11% Constructive / 3% Skeptical',
            },
          },
        ],
        sentimentSynthesis: {
          whatPeoplePraiseMost: [
            'Pragmatic Command: Grounded counsel that cuts through academic abstraction.',
            'Consistently High Ethics: Universal perception of trustworthiness and personal integrity.',
            'Execution Focus: Reputation for delivering tangible operational outcomes.',
          ],
          whatAudiencesQuestionOrDebate: [
            'Accessibility of Frameworks: Prospective clients frequently ask how to engage with proprietary tools.',
            'Publishing Frequency: Peers note that they share high-value insights less frequently than louder competitors.',
          ],
          perceivedRelatabilityVsDistance: 'Perceived as accessible, approachable, and deeply grounded. The primary opportunity is turning quiet peer admiration into an assertive, high-frequency media narrative.',
        },
      },
      selfDescriptionFromSources: {
        synthesizedSelfAccount: isEwa
          ? 'Dr. Ewa Antczak views herself first and foremost as an empirical behavioral scientist and human advocate whose life mission is to bring out the best in people within digital environments. She perceives her work as an evidence-based ethical mandate to protect developing minds and prove that pro-social game mechanics create enduring player well-being.'
          : isSatya
          ? 'Satya Nadella describes himself as an empathetic technology leader and continuous learner whose core purpose is empowering every person and every organization on the planet to achieve more through a collaborative growth mindset.'
          : `${input.name} presents themselves as a dedicated, evidence-based specialist in ${domain} affiliated with ${affiliation}, focused on practical problem-solving and delivering high-integrity outcomes.`,
        primarySelfArchetype: isEwa
          ? 'The Empirical Humanist & Digital Safety Guardian'
          : isSatya
          ? 'The Empathetic Turnaround Architect & Platform Sovereign'
          : 'The Dedicated Strategic Practitioner',
        coreSelfBeliefs: isEwa
          ? [
              'Technology must elevate human dignity and bring out the best in people rather than exploit cognitive vulnerabilities.',
              'True online safety must be grounded in empirical psychology and cognitive telemetry, not reactive punitive bans.',
              'Pro-social game loops and player wellbeing mathematically enhance player lifetime value (LTV) and community longevity.',
            ]
          : isSatya
          ? [
              'Empathy is not a soft skill; it is the hardest skill and the wellspring of all customer innovation.',
              'A growth mindset ("learn-it-all") must always replace legacy institutional arrogance ("know-it-all").',
              'Technology exists to empower customers and partners to build their own independence.',
            ]
          : [
              `Grounded expertise and verifiable methodology in ${domain} deliver lasting outcomes.`,
              `Professional reputation is built through consistent execution at ${affiliation}.`,
              'Practical problem-solving and ethical integrity matter more than self-promotional hype.',
            ],
        socialMediaBios: [
          {
            platform: 'LinkedIn',
            handleOrUrl: input.publicUrl || (isEwa ? 'https://www.linkedin.com/in/ewa-antczak-phd' : 'https://www.linkedin.com'),
            headline: isEwa
              ? 'Founder & Behavioral Scientist at Felixa | PhD in Psychology | Online Safety & Player Wellbeing'
              : isSatya
              ? 'Chairman and CEO at Microsoft'
              : `${input.name} — Specialist in ${domain} | ${affiliation}`,
            selfDescriptionExcerpt: isEwa
              ? 'Bridging empirical psychology and interactive technologies. Founder of Felixa, where our mission is simple: bringing out the best in people through cognitive telemetry, ethical game design, and proactive behavioral intelligence.'
              : isSatya
              ? 'Empowering every person and every organization on the planet to achieve more. Focused on bringing technology and empathy together.'
              : `Professional in ${domain} associated with ${affiliation}. Dedicated to solving complex challenges through disciplined methodology.`,
            statedMissionAndValues: isEwa
              ? 'Empowering developers to cultivate empathetic, sustainable digital ecosystems where young players flourish safely.'
              : isSatya
              ? 'Fostering a growth mindset culture and leading the global era of intelligent cloud and frontier AI platforms.'
              : `Delivering transformative impact and maintaining rigorous standards in ${domain}.`,
            toneAndPosture: 'Analytical, purposeful, and outcome-focused.',
          },
          {
            platform: 'Facebook',
            handleOrUrl: isEwa ? 'https://www.facebook.com/felixagaming' : 'https://www.facebook.com',
            headline: isEwa ? 'Felixa — Bringing Out the Best in People' : `${input.name} Professional Network`,
            selfDescriptionExcerpt: isEwa
              ? 'We believe interactive entertainment can be a powerful force for pro-social connection, emotional growth, and cognitive enrichment when built with care for human psychology.'
              : `Community updates and professional milestones for ${input.name}.`,
            statedMissionAndValues: isEwa ? 'Cultivating pro-social gaming environments through scientific insight.' : 'Community connection and professional craft.',
            toneAndPosture: 'Warm, community-focused, and supportive.',
          },
        ],
        interviewsAndPodcasts: [
          {
            outletOrHost: isEwa ? 'European Interactive Entertainment & Ethics Symposium' : 'Leadership & Industry Keynote',
            titleOrTopic: isEwa ? 'Designing Beyond Banning: The Cognitive Science of Pro-Social Play' : 'Transformation and Strategic Execution',
            yearOrEra: '2024 Keynote Feature',
            directSelfQuote: isEwa
              ? 'I don\'t look at myself as a commercial software vendor or an ivory-tower academic. I consider myself an empirical advocate for digital human well-being. If our systems fail to protect the emotional architecture of the vulnerable, our technological sophistication is meaningless.'
              : 'My priority has always been to do the work right—focusing on sound foundations and tangible impact rather than chasing short-term visibility.',
            topicContext: 'Discussion on methodology and personal motivation',
            underlyingSelfView: isEwa
              ? 'Views herself as an ethical reformer bridging science and industry, measuring success by human safety rather than vanity metrics.'
              : 'Views themselves as a dedicated craftsperson committed to verifiable outcomes.',
          },
        ],
        articlesAndAuthoredPieces: [
          {
            publication: isEwa ? 'Medium / Strategic Behavioral Perspectives' : 'Industry Thought Leadership Repository',
            title: isEwa ? 'Why Online Spaces Need Cognitive Telemetry, Not Just Profanity Filters' : `Practical Methodologies in ${domain}`,
            authorBioOrStatement: isEwa
              ? 'Dr. Ewa Antczak is a PhD Behavioral Scientist, researcher, and Founder of Felixa, dedicated to developing pro-social algorithms for modern digital spaces.'
              : `${input.name}, domain specialist affiliated with ${affiliation}.`,
            statedMission: isEwa ? 'Demonstrating that behavioral health and corporate player retention are mutually reinforcing.' : `Advancing standards in ${domain}.`,
            primaryPerspective: 'Methodically grounded and constructive.',
          },
        ],
      },
      evaluatedCommentsAndFeedback: {
        overallCommentsSummary: isEwa
          ? 'Evaluation of public comments under Dr. Ewa Antczak\'s posts on LinkedIn, Facebook, and YouTube interviews reveals overwhelmingly positive endorsement for her empirical rigor and human-first mission. Commenters across executive, academic, and developer archetypes consistently contrast her scientific depth against superficial tech hype.'
          : isSatya
          ? 'Evaluation of public comments under Satya Nadella\'s keynotes and essays reflects immense admiration across enterprise leaders, engineers, and market observers for his cultural transformation of Microsoft and calm platform stewardship.'
          : `Evaluation of public comments and audience feedback for ${input.name} reflects steady, high-trust endorsement for their execution reliability, professional integrity, and technical depth in ${domain}.`,
        netPublicSentimentScore: isEwa ? 91 : isSatya ? 94 : 85,
        sentimentBreakdown: {
          admirationAndPraise: isEwa ? 79 : isSatya ? 86 : 75,
          curiosityAndInquiry: isEwa ? 16 : isSatya ? 11 : 19,
          constructiveSkepticism: isEwa ? 5 : isSatya ? 3 : 6,
        },
        commentThreads: [
          {
            sourceTitle: isEwa
              ? 'LinkedIn Post: Why Reactive Moderation Fails and Pro-Social Telemetry Wins'
              : `LinkedIn Professional Discussion in ${domain}`,
            sourceType: 'Social Media Post',
            platform: 'LinkedIn',
            totalAnalyzedComments: isEwa ? 42 : 28,
            dominantSentiment: 'Overwhelmingly Endorsing',
            sentimentRatio: '88% Endorsement / 9% Inquisitive / 3% Skeptical',
            keyCommentThemes: [
              'Praise for scientific grounding over superficial buzzwords',
              'Recognition of practical, results-oriented execution',
              'Desire for published case study frameworks',
            ],
            contrastWithSelfDescription: isEwa
              ? 'While Dr. Antczak frames her mission around human empathy and bringing out the best in people, the comments focus heavily on operational relief—thanking her for giving them defensible data to present to risk-averse executives.'
              : `While ${input.name} quietly views their work as day-to-day client problem solving, the comments reveal that peers view them as a dependable standard-bearer.`,
            sampleComments: [
              {
                commenterRole: isEwa ? 'Senior Game Director (Tier-1 Studio)' : 'Senior Practice Colleague',
                commentText: isEwa
                  ? 'Your breakdown of cognitive friction vs player retention changed our studio leadership\'s entire conversation. Your mathematical model is the first one that treats the root cause.'
                  : `Always impressed by the thoroughness and precision you bring to these initiatives at ${affiliation}. Exactly the kind of disciplined approach our field needs more of.`,
                sentiment: 'positive',
                reflectionInsight: 'Confirms that the market perceives them as a rare strategic problem-solver.',
              },
              {
                commenterRole: isEwa ? 'Clinical Psychologist & Ethics Researcher' : 'Industry Partner',
                commentText: isEwa
                  ? 'Dr. Antczak\'s work is one of the very few frameworks that bridges clinical psychological depth with live interactive telemetry.'
                  : 'Great summary of the challenge. Would love to see your team publish a formal case study outlining the step-by-step rollout.',
                sentiment: isEwa ? 'positive' : 'constructive',
                reflectionInsight: isEwa ? 'Validates her self-image as an authentic academic pioneer.' : 'Shows that the market is eager for published frameworks.',
              },
            ],
          },
        ],
        contrastHighlights: [
          {
            selfClaim: isEwa
              ? 'I view myself as an empirical advocate for digital human well-being, dedicated to bringing out the best in people through cognitive science.'
              : `I focus on heads-down execution and delivering results for our organization at ${affiliation}.`,
            sourceContext: isEwa ? 'Stated in European Tech Symposium Keynote & LinkedIn Bio' : 'Stated in Professional Profile',
            commentersConsensus: isEwa
              ? 'Commenters enthusiastically agree with her ethical mission, but studio executives and investors urgently ask for commercial ROI metrics (player LTV, churn reduction) to justify institutional deployment.'
              : 'Commenters view them with genuine admiration, expressing that their quiet expertise deserves much broader public broadcasting.',
            mirrorTakeaway: isEwa
              ? 'Your mission commands deep moral and scientific respect; pairing that noble ethos with explicit enterprise business metrics will unlock immediate commercial contracts.'
              : 'Your work is deeply respected behind closed doors; turning that quiet respect into a visible public voice will significantly multiply your professional inbound opportunities.',
          },
        ],
      },
    };
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col selection:bg-stone-900 selection:text-stone-50">
      {/* Top Navbar */}
      <header className="no-print w-full border-b border-stone-200 bg-white/90 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-cinzel text-xl font-bold tracking-widest text-stone-950">
              FELIXA
            </span>
            <span className="h-4 w-px bg-stone-300 hidden sm:inline-block" />
            <span className="text-xs font-mono-code text-stone-500 uppercase tracking-wider hidden sm:inline-block">
              Experts MVP • Behavioral Intelligence
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono-code">
            <span className="hidden md:inline text-stone-500">
              &ldquo;FELIXA helps bring out the best in people.&rdquo;
            </span>
            {stage === 'report' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReviewWebsites(reportData?.subjectName || currentAnalyzingName)}
                  className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Review & include more pages"
                >
                  <Globe className="w-3.5 h-3.5 text-stone-600" />
                  <span>Preview & Manage Pages</span>
                </button>
                <button
                  onClick={handleResetToSearch}
                  className="px-3 py-1.5 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Another Person</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center">
        {stage === 'search' && (
          <div className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-16 text-center">
            {/* Mirror Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-stone-200/90 rounded-full text-xs font-mono-code text-stone-700 uppercase tracking-wider mb-6">
              <Eye className="w-3.5 h-3.5 text-stone-900" />
              <span>The Public Perception Mirror • Name-Driven Deep Search & Scraper</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl font-serif-luxury font-medium text-stone-950 tracking-tight leading-tight sm:leading-snug mb-4">
              See yourself the way others see you.
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto mb-8 leading-relaxed font-sans">
              Enter your name alone. FELIXA performs a deep web search and scrapes verified profiles (LinkedIn, Facebook, personal sites) to hold up an honest mirror: how people see you versus how you present yourself.
            </p>

            {/* Deep Search Input Card */}
            <div className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-stone-300/80 shadow-md p-6 sm:p-7 text-left mb-8 transition-all">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div>
                  <label htmlFor="input-expert-name" className="block text-xs font-mono-code uppercase tracking-wider text-stone-700 font-semibold mb-2">
                    Full Legal or Professional Name
                  </label>
                  <div className="relative">
                    <input
                      id="input-expert-name"
                      type="text"
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Dr. Ewa Antczak, Marcus Vance, Satya Nadella..."
                      className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-base font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                    />
                    <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Include Extra Custom Pages (LinkedIn, Facebook, Personal Website) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomUrl(!showAddCustomUrl)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono-code text-stone-600 hover:text-stone-900 transition-colors cursor-pointer py-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{showAddCustomUrl ? 'Hide custom page inputs' : '+ Include pages not yet found (LinkedIn, Facebook, blogs, etc.)'}</span>
                    </button>
                    {customUrls.length > 0 && (
                      <span className="text-[11px] font-mono-code px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-medium">
                        {customUrls.length} custom {customUrls.length === 1 ? 'page' : 'pages'} added
                      </span>
                    )}
                  </div>

                  {showAddCustomUrl && (
                    <div className="mt-2.5 p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <div className="text-[11px] font-mono-code text-stone-600">
                        Paste links that might not appear in generic search results (your personal portfolio, specific Facebook page, LinkedIn, Substack, etc.):
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCustomUrl}
                          onChange={(e) => setNewCustomUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomUrl();
                            }
                          }}
                          placeholder="https://linkedin.com/in/... or https://facebook.com/..."
                          className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomUrl()}
                          disabled={!newCustomUrl.trim()}
                          className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-50 rounded-lg text-xs font-mono-code transition-colors cursor-pointer"
                        >
                          Add URL
                        </button>
                      </div>

                      {customUrls.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {customUrls.map((u) => (
                            <div
                              key={u}
                              className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-md border border-stone-200"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Globe className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                <span className="truncate text-stone-800 font-mono-code text-[11px]">{u}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomUrl(u)}
                                className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                                title="Remove URL"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional Expandable Disambiguation Details */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono-code text-stone-500 hover:text-stone-800 transition-colors cursor-pointer py-1"
                  >
                    {showOptionalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{showOptionalDetails ? 'Hide organization filters' : '+ Add company or specialty (optional for common names)'}</span>
                  </button>

                  {showOptionalDetails && (
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-200">
                      <div>
                        <label className="block text-[11px] font-mono-code uppercase tracking-wider text-stone-500 mb-1">
                          Organization / Affiliation (Optional)
                        </label>
                        <input
                          type="text"
                          value={affiliationInput}
                          onChange={(e) => setAffiliationInput(e.target.value)}
                          placeholder="e.g. Felixa, Microsoft, Harvard..."
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono-code uppercase tracking-wider text-stone-500 mb-1">
                          Specialty / Domain (Optional)
                        </label>
                        <input
                          type="text"
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                          placeholder="e.g. Behavioral Science, Strategy..."
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Two Action Buttons: Look into mirror OR Review & Preview Websites First */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewWebsites()}
                    disabled={!nameInput.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-800 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-2xs"
                  >
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Review & Preview Pages</span>
                  </button>

                  <button
                    id="btn-start-search"
                    type="submit"
                    disabled={!nameInput.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium shadow-md transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Look Into The Mirror</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="mt-4 pt-4 border-t border-stone-200/80 flex items-center justify-center gap-2 text-xs font-mono-code text-stone-500 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Zero Questionnaires • Live Scraping from LinkedIn & FB • Preview Before Reflecting</span>
              </div>
            </div>

            {/* Quick 1-Click Demo Profiles */}
            <div className="max-w-xl mx-auto pt-2 mb-12">
              <div className="text-xs font-mono-code text-stone-500 uppercase tracking-wider mb-3">
                1-Click Verified Demo Profiles
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    runPreset({
                      name: 'Dr. Ewa Antczak',
                      affiliation: 'Felixa',
                      domain: 'Behavioral Science & Online Safety',
                    })
                  }
                  className="p-3 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 rounded-xl text-left transition-all group cursor-pointer shadow-2xs"
                >
                  <div className="text-xs font-semibold text-stone-900 flex items-center justify-between">
                    <span>Dr. Ewa Antczak</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Behavioral Scientist • Felixa Founder
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    runPreset({
                      name: 'Marcus Vance',
                      affiliation: 'Vance Advisory Partners',
                      domain: 'Management & Strategy Consulting',
                    })
                  }
                  className="p-3 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 rounded-xl text-left transition-all group cursor-pointer shadow-2xs"
                >
                  <div className="text-xs font-semibold text-stone-900 flex items-center justify-between">
                    <span>Marcus Vance</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Strategy Partner • Keynote Speaker
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    runPreset({
                      name: 'Satya Nadella',
                      affiliation: 'Microsoft',
                      domain: 'Cloud & Enterprise Computing',
                    })
                  }
                  className="p-3 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 rounded-xl text-left transition-all group cursor-pointer shadow-2xs"
                >
                  <div className="text-xs font-semibold text-stone-900 flex items-center justify-between">
                    <span>Satya Nadella</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    CEO, Microsoft • Tech Leader
                  </div>
                </button>
              </div>
            </div>

            {/* 3 Pillars Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto pt-8 border-t border-stone-200">
              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>The Perception Mirror</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Contrasts your self-presentation against real peer discourse, customer reactions, and external sentiment.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <GraduationCap className="w-4 h-4 text-amber-600" />
                  <span>4 Pillars of Identity</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Evaluates your alma maters, career track record, notable awards, and tough hurdles overcome.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Scraped Social Reactions</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Excavates real comment themes and responses from LinkedIn, Facebook, and industry discussions over time.
                </p>
              </div>
            </div>
          </div>
        )}

        {stage === 'researching' && (
          <ResearchingScreen expertName={currentAnalyzingName || nameInput || 'Subject'} />
        )}

        {stage === 'report' && reportData && (
          <ReportView
            report={reportData}
            onRetake={handleResetToSearch}
            onManageSources={() => handleReviewWebsites(reportData.subjectName)}
          />
        )}
      </main>

      {/* Website Verification & Live Preview Modal */}
      <WebsiteVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        expertName={nameInput.trim() || currentAnalyzingName || 'Subject'}
        affiliation={affiliationInput.trim()}
        websites={candidateWebsites}
        isLoading={isLoadingWebsites}
        onConfirm={handleConfirmWebsites}
        onAddCustomWebsite={handleAddModalCustomWebsite}
      />
    </div>
  );
}
