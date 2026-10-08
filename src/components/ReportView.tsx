import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Printer,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Download,
  Eye,
  Layers,
  Globe,
  FileText,
  Search,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Filter,
  MessageSquare,
  History,
  Heart,
  ThumbsUp,
  MessageCircle,
  TrendingUp,
  Brain,
  GraduationCap,
  Briefcase,
  Award,
  Sparkles,
  Compass,
  Quote,
  Plus,
  Mic,
  Share2,
  BookOpen,
  Users,
} from 'lucide-react';
import { BehavioralReportData, DisclosedSource } from '../types';
import { MethodologyModal } from './MethodologyModal';

interface ReportViewProps {
  report: BehavioralReportData;
  onRetake: () => void;
  onManageSources?: () => void;
}

type TabType = 'all' | 'mirror' | 'self-account' | 'comments' | 'reflection' | 'discourse' | 'presence' | 'sources' | 'dimensions' | 'roadmap';

export const ReportView: React.FC<ReportViewProps> = ({ report, onRetake, onManageSources }) => {
  const [showMethodology, setShowMethodology] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedSourceCategory, setSelectedSourceCategory] = useState<string>('all');

  // Format data for Dimension bar chart
  const dimensionChartData = report.dimensions.map((d) => ({
    name: d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name,
    fullName: d.name,
    Current: d.score,
    Benchmark: d.benchmark,
  }));

  // Sentiment Distribution
  const sentimentChartData = [
    { name: 'Positive Endorsement', value: report.sentimentDistribution.positiveEndorsement, color: '#1c1917' },
    { name: 'Neutral Informational', value: report.sentimentDistribution.neutralInformational, color: '#78716c' },
    { name: 'Critical / Challenging', value: report.sentimentDistribution.criticalChallenging, color: '#e11d48' },
    { name: 'Unindexed Expertise', value: report.sentimentDistribution.unindexedExpertise, color: '#d6d3d1' },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `FELIXA_Perception_Mirror_Report_${report.subjectName.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter sources
  const disclosedSources = report.disclosedSources || [];
  const filteredSources = selectedSourceCategory === 'all'
    ? disclosedSources
    : disclosedSources.filter((s) => s.category.toLowerCase().includes(selectedSourceCategory.toLowerCase()));

  const categories = ['all', 'Academic & Scholarly', 'Corporate & Registry', 'Media & Press', 'Speaking & Audio', 'Social & Commentary', 'Interviews & Podcasts', 'Authored Articles'];

  return (
    <div id="report-view-root" className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="no-print pb-6 mb-6 border-b border-stone-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-xs font-mono-code uppercase tracking-wider text-stone-600">
              The Public Perception Mirror • 100% Verified Presence Analysis
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-view-methodology"
              onClick={() => setShowMethodology(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono-code text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-stone-900" />
              <span>Perception Framework</span>
            </button>

            <button
              id="btn-download-audit"
              onClick={handleDownloadJSON}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono-code text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              title="Download JSON record"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">JSON Record</span>
            </button>

            <button
              id="btn-print-report"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export / Print PDF</span>
            </button>

            <button
              id="btn-retake"
              onClick={onRetake}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-stone-500 hover:text-stone-900 rounded-lg transition-colors cursor-pointer"
              title="Analyze another profile"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          </div>
        </div>

        {/* Section View Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono-code">
          <span className="text-stone-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Focus View:
          </span>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Sections (Complete Reflection)
          </button>
          <button
            id="tab-btn-mirror"
            onClick={() => setActiveTab('mirror')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'mirror'
                ? 'bg-amber-900 text-amber-50 font-medium shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>The Perception Mirror (Self vs. World)</span>
          </button>
          <button
            id="tab-btn-self-account"
            onClick={() => setActiveTab('self-account')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'self-account'
                ? 'bg-amber-900 text-amber-50 font-medium shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-amber-600" />
            <span>Self-Account (Interviews & Social)</span>
          </button>
          <button
            id="tab-btn-comments"
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'bg-blue-900 text-blue-50 font-medium shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Comments & Feedback Evaluation</span>
          </button>
          <button
            onClick={() => setActiveTab('reflection')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'reflection'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Deep Insight Synthesis
          </button>
          <button
            id="tab-btn-discourse"
            onClick={() => setActiveTab('discourse')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'discourse'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Social Feedback & Evolution
          </button>
          <button
            onClick={() => setActiveTab('presence')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'presence'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Virtual Presence Matrix
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'sources'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Disclosed Sources ({disclosedSources.length})
          </button>
          <button
            onClick={() => setActiveTab('dimensions')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'dimensions'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Perception Dimensions
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'bg-stone-900 text-stone-50 font-medium'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            90-Day Presence Growth Plan
          </button>
        </div>
      </div>

      {/* Main Executive Document */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-10 text-stone-900">
        {/* Document Header */}
        <header className="border-b border-stone-200 pb-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="text-xs font-cinzel font-bold tracking-widest text-stone-500 uppercase mb-1.5">
                FELIXA • The Public Perception Mirror & Behavioral Intelligence Profile
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif-luxury font-semibold text-stone-950 tracking-tight">
                {report.subjectName}
              </h1>
              <p className="text-sm text-stone-600 mt-1 font-sans">
                A friendly, comprehensive mirror comparing how you perceive yourself with how people actually see you throughout the years across LinkedIn, Facebook, and the web.
              </p>
            </div>

            <div className="text-left sm:text-right font-mono-code text-xs text-stone-500 shrink-0">
              <div>Reflection Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>Mirror ID: PM-REFLECT-{Math.abs(report.overallPresenceQuotient * 137 + 419)}</div>
              <div className="text-emerald-700 font-semibold mt-1">Status: 100% Verified Profile</div>
            </div>
          </div>
        </header>

        {/* Executive Summary Card: The Outer Impression & Mirror Gap */}
        <section className="mb-10 p-6 sm:p-8 bg-stone-50 rounded-xl border border-stone-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Presence Score */}
            <div className="flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-stone-200 pb-6 md:pb-0 md:pr-6">
              <div className="text-xs font-mono-code text-stone-500 uppercase tracking-wider mb-2">
                Market Perception Readiness
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-serif-luxury font-bold text-stone-900">
                  {report.overallPresenceQuotient}
                </span>
                <span className="text-sm font-mono-code text-stone-400">/ 100</span>
              </div>
              <div className="text-xs text-stone-600 mt-2 font-medium">
                {report.overallPresenceQuotient >= 80
                  ? 'High Category Gravity'
                  : report.overallPresenceQuotient >= 65
                  ? 'Substantive Expertise / Under-leveraged PR'
                  : 'Stealth Footprint / Significant Invisibility'}
              </div>
            </div>

            {/* Archetype & The Mirror Gap */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono-code uppercase px-2.5 py-1 bg-stone-900 text-stone-50 rounded-md font-medium">
                  Public Archetype
                </span>
                <span className="text-lg font-serif-luxury font-semibold text-stone-900">
                  {report.primaryArchetype}
                </span>
              </div>

              <div className="text-xs font-mono-code text-stone-500 italic">
                "{report.archetypeTagline}"
              </div>

              <div className="pt-2 border-t border-stone-200/80">
                <div className="text-xs font-semibold uppercase tracking-wider font-mono-code text-stone-700 mb-1 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-stone-900" />
                  <span>The Way Others See You (Outer 60-Second Impression)</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  {report.outerImpression}
                </p>
              </div>

              <div className="pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider font-mono-code text-stone-700 mb-1">
                  The Mirror Gap (Self-Image vs. Market Perception)
                </div>
                <p className="text-xs text-stone-600 leading-relaxed bg-white p-3 rounded-lg border border-stone-200/80">
                  {report.mirrorGap}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: THE PERCEPTION MIRROR (Self-Perception vs. Public Perception) */}
        {(activeTab === 'all' || activeTab === 'mirror') && report.mirrorComparison && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-amber-900 bg-amber-100/90 inline-block px-3 py-1 rounded-md mb-2 border border-amber-200">
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-700" />
                The Perception Mirror
              </div>
              <h2 className="text-2xl font-serif-luxury font-semibold text-stone-900">
                Who You Think You Are vs. How People Actually See You
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-sans mt-1 max-w-3xl leading-relaxed">
                Like holding up a friendly, honest mirror: this brings together how you perceive your own life and work with how others genuinely see and respond to you across social media comments, peer feedback, education, career history, and public records.
              </p>
            </div>

            {/* Split Comparison Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {/* Inner Self-View Card */}
              <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200/90 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-amber-200/80">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-amber-900 font-semibold">
                      <Brain className="w-4 h-4 text-amber-700" />
                      <span>Inner Self-View (Who You Think You Are)</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 font-medium">
                      Self-Image
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-serif-luxury text-stone-900 mt-4 leading-relaxed italic">
                    "{report.mirrorComparison.selfPerceptionSummary}"
                  </p>
                </div>
                <div className="pt-3 border-t border-amber-200/70 text-xs text-amber-900/80 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                  <span>Rooted in your personal intentions, private standards, and lived experiences.</span>
                </div>
              </div>

              {/* Outer Mirror Card */}
              <div className="p-6 rounded-xl bg-stone-900 text-stone-100 border border-stone-800 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-emerald-400 font-semibold">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span>The Outer Mirror (What People Actually Think of You)</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-medium">
                      Market Reality
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-serif-luxury text-stone-100 mt-4 leading-relaxed">
                    "{report.mirrorComparison.publicPerceptionSummary}"
                  </p>
                </div>
                <div className="pt-3 border-t border-stone-800 text-xs text-stone-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Derived from visible work artifacts, peer discourse, testimonials, and public signals.</span>
                </div>
              </div>
            </div>

            {/* 4 Pillars of Your Reputation */}
            <div className="mb-8">
              <h3 className="text-base font-serif-luxury font-semibold text-stone-900 mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-stone-700" />
                <span>The 4 Pillars: Education, Experience, Awards & Challenges</span>
              </h3>
              <p className="text-xs text-stone-500 mb-4">
                How specific facets of your background translate from your internal perspective into public perception.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Education & Schools */}
                <div className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-800 font-semibold">
                      <GraduationCap className="w-4 h-4 text-stone-800" />
                      <span>Education & Schools</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 bg-stone-200 text-stone-700 rounded">
                      Credentials
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    <strong className="text-stone-900">Background:</strong> {report.mirrorComparison.educationReflection.schoolsAndDegrees}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                      <span className="block font-mono-code text-[10px] text-amber-800 uppercase font-semibold mb-0.5">How You View It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.educationReflection.howYouViewIt}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                      <span className="block font-mono-code text-[10px] text-stone-600 uppercase font-semibold mb-0.5">How People Perceive It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.educationReflection.howPeoplePerceiveIt}</p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-stone-100/90 rounded-lg text-xs text-stone-700 italic border border-stone-200/80 flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{report.mirrorComparison.educationReflection.quoteOrSignal}</span>
                  </div>
                </div>

                {/* 2. Work Experience */}
                <div className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-800 font-semibold">
                      <Briefcase className="w-4 h-4 text-stone-800" />
                      <span>Work Experience & Career Track</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 bg-stone-200 text-stone-700 rounded">
                      Milestones
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    <strong className="text-stone-900">Background:</strong> {report.mirrorComparison.workExperienceReflection.rolesAndMilestones}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                      <span className="block font-mono-code text-[10px] text-amber-800 uppercase font-semibold mb-0.5">How You View It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.workExperienceReflection.howYouViewIt}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                      <span className="block font-mono-code text-[10px] text-stone-600 uppercase font-semibold mb-0.5">How People Perceive It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.workExperienceReflection.howPeoplePerceiveIt}</p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-stone-100/90 rounded-lg text-xs text-stone-700 italic border border-stone-200/80 flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{report.mirrorComparison.workExperienceReflection.quoteOrSignal}</span>
                  </div>
                </div>

                {/* 3. Awards & Recognitions */}
                <div className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-800 font-semibold">
                      <Award className="w-4 h-4 text-stone-800" />
                      <span>Awards & Recognitions</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 bg-stone-200 text-stone-700 rounded">
                      Honors
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    <strong className="text-stone-900">Background:</strong> {report.mirrorComparison.awardsReflection.recognitionsAndHonors}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                      <span className="block font-mono-code text-[10px] text-amber-800 uppercase font-semibold mb-0.5">How You View It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.awardsReflection.howYouViewIt}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                      <span className="block font-mono-code text-[10px] text-stone-600 uppercase font-semibold mb-0.5">How People Perceive It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.awardsReflection.howPeoplePerceiveIt}</p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-stone-100/90 rounded-lg text-xs text-stone-700 italic border border-stone-200/80 flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{report.mirrorComparison.awardsReflection.quoteOrSignal}</span>
                  </div>
                </div>

                {/* 4. Challenges & Problems Faced */}
                <div className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-800 font-semibold">
                      <Compass className="w-4 h-4 text-stone-800" />
                      <span>Challenges & Tough Problems Solved</span>
                    </div>
                    <span className="text-[11px] font-mono-code px-2 py-0.5 bg-stone-200 text-stone-700 rounded">
                      Resilience
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    <strong className="text-stone-900">Background:</strong> {report.mirrorComparison.challengesAndProblemsReflection.problemsOrMisconceptions}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                      <span className="block font-mono-code text-[10px] text-amber-800 uppercase font-semibold mb-0.5">How You View It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.challengesAndProblemsReflection.howYouViewIt}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                      <span className="block font-mono-code text-[10px] text-stone-600 uppercase font-semibold mb-0.5">How People Perceive It</span>
                      <p className="text-stone-700 leading-snug">{report.mirrorComparison.challengesAndProblemsReflection.howPeoplePerceiveIt}</p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-stone-100/90 rounded-lg text-xs text-stone-700 italic border border-stone-200/80 flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{report.mirrorComparison.challengesAndProblemsReflection.quoteOrSignal}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gap Breakdown with Clear Examples, Quotes & Friendly Guidance */}
            {report.mirrorComparison.gapBreakdown && report.mirrorComparison.gapBreakdown.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-serif-luxury font-semibold text-stone-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-stone-700" />
                    <span>Clear Examples & Guidance to Align Your Mirror</span>
                  </h3>
                  <span className="text-xs font-mono-code text-stone-500">Self-Reflection & Guidance</span>
                </div>

                <div className="space-y-3">
                  {report.mirrorComparison.gapBreakdown.map((gap, gIdx) => (
                    <div
                      key={gIdx}
                      className="p-5 bg-white rounded-xl border border-stone-200 shadow-xs space-y-3 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <span className="text-xs font-mono-code font-semibold text-stone-800 uppercase tracking-wide">
                          {gap.aspect}
                        </span>
                        <span className="text-[11px] font-mono-code text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Perception Nuance #{gIdx + 1}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-stone-50 rounded-lg">
                          <strong className="text-stone-900 block mb-1 font-sans">How You Experience It:</strong>
                          <span className="text-stone-700 leading-relaxed">{gap.howYouSeeIt}</span>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-lg">
                          <strong className="text-stone-900 block mb-1 font-sans">How the Outside World Sees It:</strong>
                          <span className="text-stone-700 leading-relaxed">{gap.howTheWorldSeesIt}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/70 text-xs text-amber-950 flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-medium font-sans">Representative Quote or Public Signal: </strong>
                          <span className="italic">{gap.clearExampleOrQuote}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/70 text-xs text-emerald-950 flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-medium font-sans">Friendly Guidance: </strong>
                          <span>{gap.friendlyGuidance}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 1.5: HOW YOU DESCRIBE YOURSELF ONLINE (Social Media, Interviews & Articles) */}
        {(activeTab === 'all' || activeTab === 'self-account') && report.selfDescriptionFromSources && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-amber-900 bg-amber-100/90 inline-block px-3 py-1 rounded-md mb-2 border border-amber-200">
                <Mic className="w-3.5 h-3.5 inline mr-1 text-amber-700" />
                Primary Sources • What You Think of Yourself
              </div>
              <h2 className="text-2xl font-serif-luxury font-semibold text-stone-900">
                How You Describe Yourself Online
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-sans mt-1 max-w-3xl leading-relaxed">
                Synthesized directly from your own public words across LinkedIn and Facebook bios, podcast dialogues, keynote transcripts, and authored articles.
              </p>
            </div>

            {/* Unified Self-Account Hero Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-stone-50 border border-amber-200 shadow-xs mb-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-900 text-amber-50 flex items-center justify-center font-bold text-xs">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-mono-code uppercase tracking-wider text-amber-900 font-bold block">
                      Synthesized Self-Account & Inner North Star
                    </span>
                    <span className="text-xs text-stone-500 font-sans">
                      Who you believe you are, derived purely from your self-authored statements
                    </span>
                  </div>
                </div>

                <div className="self-start sm:self-auto">
                  <span className="text-xs font-mono-code px-3 py-1 bg-amber-200/80 text-amber-950 rounded-full font-medium border border-amber-300">
                    {report.selfDescriptionFromSources.primarySelfArchetype}
                  </span>
                </div>
              </div>

              <blockquote className="text-base sm:text-lg font-serif-luxury text-stone-900 leading-relaxed italic border-l-2 border-amber-600 pl-4 py-1">
                &ldquo;{report.selfDescriptionFromSources.synthesizedSelfAccount}&rdquo;
              </blockquote>

              {/* Core Self-Beliefs */}
              {report.selfDescriptionFromSources.coreSelfBeliefs && report.selfDescriptionFromSources.coreSelfBeliefs.length > 0 && (
                <div className="pt-3 border-t border-amber-200/60">
                  <span className="text-xs font-mono-code uppercase tracking-wider text-stone-500 block mb-2 font-semibold">
                    Core Stated Beliefs & Principles (In Your Own Words):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {report.selfDescriptionFromSources.coreSelfBeliefs.map((belief, bIdx) => (
                      <div
                        key={bIdx}
                        className="p-3 bg-white/90 rounded-xl border border-stone-200/80 text-xs text-stone-800 flex items-start gap-2.5 shadow-2xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{belief}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3 Pillars of Self-Description: Social Media, Interviews, Articles */}
            <div className="space-y-6">
              {/* 1. Social Media Bios */}
              {report.selfDescriptionFromSources.socialMediaBios && report.selfDescriptionFromSources.socialMediaBios.length > 0 && (
                <div className="p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-stone-800" />
                      <h3 className="text-sm sm:text-base font-serif-luxury font-semibold text-stone-950">
                        Self-Descriptions on Social Media (LinkedIn, Facebook, X)
                      </h3>
                    </div>
                    <span className="text-xs font-mono-code text-stone-500">
                      Profile Bios & Headlines
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.selfDescriptionFromSources.socialMediaBios.map((bio, bioIdx) => (
                      <div
                        key={bioIdx}
                        className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono-code font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200">
                            {bio.platform}
                          </span>
                          <span className="text-[11px] font-mono-code text-stone-500">
                            Posture: <strong className="text-stone-800">{bio.toneAndPosture}</strong>
                          </span>
                        </div>

                        <div>
                          <span className="text-xs font-semibold text-stone-900 block font-sans">
                            {bio.headline}
                          </span>
                        </div>

                        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/70 text-xs text-stone-700 leading-relaxed italic">
                          &ldquo;{bio.selfDescriptionExcerpt}&rdquo;
                        </div>

                        {bio.statedMissionAndValues && (
                          <div className="text-xs text-stone-600 flex items-start gap-1.5 pt-1">
                            <strong className="text-stone-900 shrink-0 font-medium font-sans">Stated Mission:</strong>
                            <span>{bio.statedMissionAndValues}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Interviews & Podcasts */}
              {report.selfDescriptionFromSources.interviewsAndPodcasts && report.selfDescriptionFromSources.interviewsAndPodcasts.length > 0 && (
                <div className="p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-stone-800" />
                      <h3 className="text-sm sm:text-base font-serif-luxury font-semibold text-stone-950">
                        Spoken Philosophy: Quotes from Interviews & Podcasts
                      </h3>
                    </div>
                    <span className="text-xs font-mono-code text-stone-500">
                      Recorded Dialogue & Q&A
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {report.selfDescriptionFromSources.interviewsAndPodcasts.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="p-5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-stone-100">
                          <div>
                            <span className="text-xs font-semibold text-stone-900 font-sans block">
                              {item.titleOrTopic}
                            </span>
                            <span className="text-xs font-mono-code text-stone-500">
                              {item.outletOrHost} {item.yearOrEra ? `• ${item.yearOrEra}` : ''}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 self-start sm:self-auto">
                            Direct Spoken Quote
                          </span>
                        </div>

                        <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 text-xs sm:text-sm text-stone-900 italic leading-relaxed flex items-start gap-3">
                          <Quote className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <span>&ldquo;{item.directSelfQuote}&rdquo;</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700 pt-1">
                          <div className="p-2.5 bg-stone-50 rounded-lg">
                            <strong className="text-stone-900 block font-sans mb-0.5">Topic Context:</strong>
                            <span>{item.topicContext}</span>
                          </div>
                          <div className="p-2.5 bg-stone-50 rounded-lg">
                            <strong className="text-stone-900 block font-sans mb-0.5">What This Reveals About Self-View:</strong>
                            <span>{item.underlyingSelfView}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Authored Articles & Op-Eds */}
              {report.selfDescriptionFromSources.articlesAndAuthoredPieces && report.selfDescriptionFromSources.articlesAndAuthoredPieces.length > 0 && (
                <div className="p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-stone-800" />
                      <h3 className="text-sm sm:text-base font-serif-luxury font-semibold text-stone-950">
                        Authored Articles, Op-Eds & Written Thought Leadership
                      </h3>
                    </div>
                    <span className="text-xs font-mono-code text-stone-500">
                      Author Notes & Stated Missions
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.selfDescriptionFromSources.articlesAndAuthoredPieces.map((art, aIdx) => (
                      <div
                        key={aIdx}
                        className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono-code text-stone-500 font-medium">
                            {art.publication}
                          </span>
                          <span className="text-[10px] font-mono-code uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                            {art.primaryPerspective}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-stone-900 leading-snug font-sans">
                          {art.title}
                        </h4>

                        <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/70 text-xs text-stone-700 leading-relaxed">
                          <strong className="text-stone-900 block font-sans text-[11px] uppercase mb-0.5 font-mono-code text-stone-500">
                            Author Statement:
                          </strong>
                          {art.authorBioOrStatement}
                        </div>

                        <div className="text-xs text-stone-600">
                          <strong className="text-stone-900 font-sans">Stated Mission: </strong>
                          <span>{art.statedMission}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECTION 1.6: AUDIENCE COMMENTS & FEEDBACK EVALUATION */}
        {(activeTab === 'all' || activeTab === 'comments') && report.evaluatedCommentsAndFeedback && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-blue-900 bg-blue-100/90 inline-block px-3 py-1 rounded-md mb-2 border border-blue-200">
                <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-blue-700" />
                Audience Discourse Audit • Comments Under Posts & Articles
              </div>
              <h2 className="text-2xl font-serif-luxury font-semibold text-stone-900">
                How People Respond: Evaluated Comments & Feedback
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-sans mt-1 max-w-3xl leading-relaxed">
                Empirical evaluation of comments and reactions left under your LinkedIn and Facebook posts, YouTube conference videos, and published articles.
              </p>
            </div>

            {/* Overall Evaluation Card with Score & Sentiment Bar */}
            <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm mb-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
                <div>
                  <span className="text-xs font-mono-code uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                    Audience Comment Sentiment Synthesis
                  </span>
                  <h3 className="text-base sm:text-lg font-serif-luxury font-semibold text-stone-950">
                    Net Public Sentiment & Commentary Reception
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] font-mono-code text-stone-400 uppercase block">
                      Net Sentiment Score
                    </span>
                    <span className="text-2xl font-mono-code font-bold text-stone-950">
                      {report.evaluatedCommentsAndFeedback.netPublicSentimentScore} / 100
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-lg font-mono-code border border-emerald-200">
                    {report.evaluatedCommentsAndFeedback.netPublicSentimentScore}%
                  </div>
                </div>
              </div>

              {/* Sentiment Ratio Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono-code">
                  <span className="text-emerald-700 font-medium">
                    ● Admiration & Praise: {report.evaluatedCommentsAndFeedback.sentimentBreakdown.admirationAndPraise}%
                  </span>
                  <span className="text-amber-700 font-medium">
                    ● Curiosity & Inquiry: {report.evaluatedCommentsAndFeedback.sentimentBreakdown.curiosityAndInquiry}%
                  </span>
                  <span className="text-rose-700 font-medium">
                    ● Constructive Skepticism: {report.evaluatedCommentsAndFeedback.sentimentBreakdown.constructiveSkepticism}%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-stone-100 flex overflow-hidden border border-stone-200">
                  <div
                    style={{ width: `${report.evaluatedCommentsAndFeedback.sentimentBreakdown.admirationAndPraise}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Admiration: ${report.evaluatedCommentsAndFeedback.sentimentBreakdown.admirationAndPraise}%`}
                  />
                  <div
                    style={{ width: `${report.evaluatedCommentsAndFeedback.sentimentBreakdown.curiosityAndInquiry}%` }}
                    className="bg-amber-400 h-full"
                    title={`Curiosity: ${report.evaluatedCommentsAndFeedback.sentimentBreakdown.curiosityAndInquiry}%`}
                  />
                  <div
                    style={{ width: `${report.evaluatedCommentsAndFeedback.sentimentBreakdown.constructiveSkepticism}%` }}
                    className="bg-rose-400 h-full"
                    title={`Skepticism: ${report.evaluatedCommentsAndFeedback.sentimentBreakdown.constructiveSkepticism}%`}
                  />
                </div>
              </div>

              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-sans pt-1">
                {report.evaluatedCommentsAndFeedback.overallCommentsSummary}
              </p>
            </div>

            {/* Reality Contrast: What You Stated vs What Comments Underneath Say */}
            {report.evaluatedCommentsAndFeedback.contrastHighlights && report.evaluatedCommentsAndFeedback.contrastHighlights.length > 0 && (
              <div className="mb-8 space-y-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-stone-800" />
                  <h3 className="text-base font-serif-luxury font-semibold text-stone-950">
                    The Reality Contrast: Self-Claims vs. Audience Comments
                  </h3>
                </div>
                <p className="text-xs text-stone-500">
                  Direct side-by-side contrast between what was claimed in posts/interviews and what commenters underneath actually responded with.
                </p>

                <div className="space-y-4">
                  {report.evaluatedCommentsAndFeedback.contrastHighlights.map((contrast, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200 text-xs font-mono-code">
                        <span className="font-semibold text-stone-800 uppercase tracking-wider">
                          Perception Dynamic #{cIdx + 1}
                        </span>
                        <span className="text-stone-500">{contrast.sourceContext}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* What You Claimed */}
                        <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-mono-code uppercase tracking-wider text-amber-900 font-bold">
                            <Quote className="w-3.5 h-3.5 text-amber-700" />
                            <span>What You Claimed (In Post / Interview):</span>
                          </div>
                          <p className="text-xs sm:text-sm text-stone-900 italic leading-relaxed">
                            &ldquo;{contrast.selfClaim}&rdquo;
                          </p>
                        </div>

                        {/* What Comments Underneath Say */}
                        <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-mono-code uppercase tracking-wider text-blue-900 font-bold">
                            <MessageCircle className="w-3.5 h-3.5 text-blue-700" />
                            <span>What Audience Comments Actually Say:</span>
                          </div>
                          <p className="text-xs sm:text-sm text-stone-900 leading-relaxed">
                            {contrast.commentersConsensus}
                          </p>
                        </div>
                      </div>

                      {/* Mirror Takeaway */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold font-sans">Friendly Mirror Takeaway: </strong>
                          <span>{contrast.mirrorTakeaway}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluated Comment Threads */}
            {report.evaluatedCommentsAndFeedback.commentThreads && report.evaluatedCommentsAndFeedback.commentThreads.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-stone-800" />
                  <h3 className="text-base font-serif-luxury font-semibold text-stone-950">
                    Thread-by-Thread Comment Evaluation
                  </h3>
                </div>

                <div className="space-y-5">
                  {report.evaluatedCommentsAndFeedback.commentThreads.map((thread, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-5 sm:p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-4"
                    >
                      {/* Thread Title & Metas */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono-code font-bold uppercase px-2 py-0.5 rounded bg-stone-900 text-stone-50">
                              {thread.platform}
                            </span>
                            <span className="text-[10px] font-mono-code uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              {thread.sourceType}
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-semibold text-stone-950 font-sans">
                            {thread.sourceTitle}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="text-xs font-mono-code px-2.5 py-1 rounded bg-stone-100 text-stone-800 border border-stone-200 font-medium">
                            {thread.dominantSentiment}
                          </span>
                          <span className="text-xs font-mono-code text-emerald-700 font-medium">
                            {thread.sentimentRatio}
                          </span>
                        </div>
                      </div>

                      {/* Contrast with Self-Description */}
                      {thread.contrastWithSelfDescription && (
                        <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-700 flex items-start gap-2 border border-stone-200/70">
                          <Brain className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-stone-900 font-medium font-sans">Perceptual Contrast: </strong>
                            <span>{thread.contrastWithSelfDescription}</span>
                          </div>
                        </div>
                      )}

                      {/* Recurring Themes */}
                      {thread.keyCommentThemes && thread.keyCommentThemes.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono-code text-stone-500 uppercase tracking-wider font-semibold">
                            Recurring Comment Themes:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {thread.keyCommentThemes.map((theme, thIdx) => (
                              <span
                                key={thIdx}
                                className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-800 text-xs font-sans"
                              >
                                • {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evaluated Sample Comments */}
                      {thread.sampleComments && thread.sampleComments.length > 0 && (
                        <div className="space-y-2.5 pt-2">
                          <span className="text-[11px] font-mono-code text-stone-500 uppercase tracking-wider font-semibold">
                            Representative Evaluated Comments & Reflections:
                          </span>
                          <div className="space-y-2.5">
                            {thread.sampleComments.map((cItem, cItemIdx) => {
                              const sentimentColor =
                                cItem.sentiment === 'positive'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : cItem.sentiment === 'constructive'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200';

                              return (
                                <div
                                  key={cItemIdx}
                                  className="p-4 bg-stone-50/70 rounded-xl border border-stone-200 space-y-2"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-stone-900 font-sans flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-stone-600" />
                                      <span>{cItem.commenterRole}</span>
                                    </span>
                                    <span className={`text-[10px] font-mono-code uppercase px-2 py-0.5 rounded border font-medium ${sentimentColor}`}>
                                      {cItem.sentiment}
                                    </span>
                                  </div>

                                  <p className="text-xs text-stone-800 leading-relaxed italic bg-white p-3 rounded-lg border border-stone-200/70">
                                    &ldquo;{cItem.commentText}&rdquo;
                                  </p>

                                  <div className="text-[11px] text-stone-600 flex items-start gap-1.5 pt-0.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                      <strong className="text-stone-900 font-medium">Perception Insight: </strong>
                                      <span>{cItem.reflectionInsight}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION A: DEEP MULTI-LAYER REFLECTION ("What You Learn When You Go Really Deep") */}
        {(activeTab === 'all' || activeTab === 'reflection') && (report.deepMirrorReflection || report.forensicDueDiligence) && (() => {
          const reflection = report.deepMirrorReflection || report.forensicDueDiligence!;
          return (
            <section className="mb-12 page-break-inside-avoid">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-700 bg-stone-100 inline-block px-2.5 py-1 rounded-md mb-2 border border-stone-200">
                  <Search className="w-3.5 h-3.5 inline mr-1" />
                  Deep Discovery Synthesis
                </div>
                <h2 className="text-2xl font-serif-luxury font-semibold text-stone-900">
                  Deep Insight Synthesis: What You Learn When You Go Really Deep
                </h2>
                <p className="text-xs text-stone-600 font-sans mt-1">
                  The objective intelligence uncovered when prospective partners, tier-1 clients, executive boards, or journalists explore your full footprint.
                </p>
              </div>

              <div className="bg-stone-900 text-stone-100 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
                <div>
                  <div className="text-xs font-mono-code uppercase tracking-wider text-stone-400 mb-2">
                    Executive Briefing Dossier
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-stone-200 font-sans">
                    {reflection.executiveSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-stone-800">
                  {/* Verified Core Strengths */}
                  <div className="bg-stone-800/80 p-4 sm:p-5 rounded-lg border border-stone-700 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Verified Core Strengths Uncovered at Depth</span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-stone-300">
                      {reflection.verifiedCoreStrengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Discovered Perception Risks & Friction */}
                  <div className="bg-stone-800/80 p-4 sm:p-5 rounded-lg border border-stone-700 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-amber-400 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Discovered Perception Nuances & Blind Spots</span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-stone-300">
                      {reflection.discoveredPerceptionRisks.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* The Stealth Unindexed Asset */}
                <div className="bg-stone-800/90 p-4 sm:p-5 rounded-lg border border-stone-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-sky-400 font-semibold">
                    <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>The Stealth Unindexed Asset (Hidden Intellectual Property)</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
                    {reflection.theUnindexedAsset}
                  </p>
                </div>

                {/* Definitive Commercial Verdict */}
                <div className="pt-2 border-t border-stone-800">
                  <div className="text-xs font-mono-code uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                    Outside World & Strategic Collaborator Verdict
                  </div>
                  <p className="text-xs sm:text-sm text-stone-200 italic font-serif-luxury">
                    "{reflection.outsideWorldVerdict || reflection.investorOrBuyerVerdict}"
                  </p>
                </div>
              </div>
            </section>
          );
        })()}

        {/* SECTION B: THE 5-LAYER PUBLIC DISCOVERY MODEL */}
        {(activeTab === 'all' || activeTab === 'reflection') && report.deepExcavation && report.deepExcavation.length > 0 && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-serif-luxury font-semibold text-stone-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-stone-800" />
                  <span>The 5-Layer Public Discovery Model</span>
                </h2>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  Chronological depth modeling: what people discover at each layer of online presence and exploration.
                </p>
              </div>
              <span className="text-xs font-mono-code text-stone-400">Layer 1 → Layer 5</span>
            </div>

            <div className="space-y-4">
              {report.deepExcavation.map((layer) => {
                const gravityColor =
                  layer.perceivedGravity === 'High Gravitas'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : layer.perceivedGravity === 'Moderate Alignment'
                    ? 'bg-stone-200 text-stone-800 border-stone-300'
                    : 'bg-amber-100 text-amber-800 border-amber-200';

                const layerInsights = layer.friendlyInsights || layer.forensicInsights || [];

                return (
                  <div
                    key={layer.layerNumber}
                    className="p-5 sm:p-6 bg-stone-50 rounded-xl border border-stone-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-200">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-stone-900 text-stone-50 font-mono-code font-bold text-xs flex items-center justify-center shrink-0">
                          L{layer.layerNumber}
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-serif-luxury font-semibold text-stone-950">
                            {layer.name}
                          </h3>
                          <span className="text-xs font-mono-code text-stone-500">
                            {layer.subtitle}
                          </span>
                        </div>
                      </div>

                      <span className={`text-xs font-mono-code px-2.5 py-1 rounded-md border font-medium self-start sm:self-auto ${gravityColor}`}>
                        {layer.perceivedGravity}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                      <strong className="text-stone-900">What is Discovered:</strong> {layer.whatIsDiscovered}
                    </div>

                    {/* Discovery Signals */}
                    {layerInsights.length > 0 && (
                      <div className="bg-white p-3.5 rounded-lg border border-stone-200/80 space-y-1.5">
                        <div className="text-xs font-mono-code uppercase tracking-wider text-stone-500 font-semibold">
                          Deep Discovery Signals:
                        </div>
                        <ul className="space-y-1 text-xs text-stone-700">
                          {layerInsights.map((insight, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-700 shrink-0 mt-1.5" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Verifiable Excerpts */}
                    {layer.evidenceExcerpts && layer.evidenceExcerpts.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs font-mono-code text-stone-600 pt-1">
                        <span className="text-stone-400">Verifiable Excerpts:</span>
                        {layer.evidenceExcerpts.map((exc, ei) => (
                          <span key={ei} className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 italic">
                            {exc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION C: CONTEXTUAL VIRTUAL PRESENCE CHANNEL MATRIX */}
        {(activeTab === 'all' || activeTab === 'presence') && report.virtualPresenceMatrix && report.virtualPresenceMatrix.length > 0 && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-1">
                <Globe className="w-3.5 h-3.5 inline text-stone-900" />
                Cross-Channel Evaluation
              </div>
              <h2 className="text-xl font-serif-luxury font-semibold text-stone-900">
                Contextual Virtual Presence Matrix
              </h2>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Channel-by-channel maturity, coverage scores, and contextual PR diagnosis across major digital touchpoints.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.virtualPresenceMatrix.map((item, idx) => {
                const maturityBadge =
                  item.maturity === 'Category Leader'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.maturity === 'Established Presence'
                    ? 'bg-stone-200 text-stone-800'
                    : item.maturity === 'Emerging / Fragmented'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-100 text-stone-500';

                return (
                  <div
                    key={idx}
                    className="p-5 bg-stone-50 rounded-xl border border-stone-200 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-stone-950 font-serif-luxury">
                          {item.channel}
                        </h3>
                        <span className={`text-[11px] font-mono-code font-medium px-2 py-0.5 rounded ${maturityBadge}`}>
                          {item.maturity}
                        </span>
                      </div>

                      {/* Coverage Bar */}
                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-xs font-mono-code text-stone-500">
                          <span>Presence Coverage</span>
                          <span className="font-semibold text-stone-800">{item.coverageScore}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-stone-900 rounded-full"
                            style={{ width: `${item.coverageScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-xs text-stone-700 mb-2">
                        <strong className="text-stone-900">Observed Public Narrative:</strong> {item.observedNarrative}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200/80 text-xs text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200/60">
                      <strong className="text-stone-900">Contextual Diagnosis & PR Remedy:</strong> {item.contextualDiagnosis}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION D: DISCLOSED SOURCES DOSSIER */}
        {(activeTab === 'all' || activeTab === 'sources') && disclosedSources.length > 0 && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-xl font-serif-luxury font-semibold text-stone-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-stone-800" />
                  <span>Disclosed Sources Dossier & Evidence Transparency</span>
                </h2>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  Full disclosure of verified web anchors, publications, archives, and profiles discovered during deep crawling.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onManageSources && (
                  <button
                    type="button"
                    onClick={onManageSources}
                    className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-50 rounded-lg text-xs font-mono-code transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Include Extra Pages / Preview Sources</span>
                  </button>
                )}
                <span className="text-xs font-mono-code text-stone-400 hidden sm:inline">Zero Hallucination Grounding</span>
              </div>
            </div>

            {/* Identity Disambiguation & Verification Notice */}
            {(report.excludedWebsitesCount !== undefined || report.verifiedWebsitesCount !== undefined) && (
              <div className="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Identity Disambiguation Active:</strong> {report.verifiedWebsitesCount || disclosedSources.length} authentic web destinations verified for deep analysis.
                    {report.excludedWebsitesCount ? ` ${report.excludedWebsitesCount} candidate links were unchecked & excluded as someone else with a similar name.` : ''}
                  </span>
                </div>
                <span className="font-mono-code text-[11px] text-emerald-800 shrink-0 font-medium">
                  Zero Namesake Data Leakage
                </span>
              </div>
            )}

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 text-xs font-mono-code">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedSourceCategory(cat)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    selectedSourceCategory === cat
                      ? 'bg-stone-900 text-stone-50 font-medium'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat === 'all' ? 'All Sources' : cat}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredSources.map((source: DisclosedSource) => {
                const impactBadge =
                  source.authorityImpact === 'High Credibility'
                    ? 'bg-emerald-100 text-emerald-800'
                    : source.authorityImpact === 'Untapped Asset'
                    ? 'bg-sky-100 text-sky-800'
                    : source.authorityImpact === 'Friction / Outdated'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-stone-200 text-stone-800';

                return (
                  <div
                    key={source.id}
                    className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2 border-b border-stone-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-serif-luxury font-semibold text-sm sm:text-base text-stone-950 hover:underline inline-flex items-center gap-1.5"
                          >
                            <span>{source.title}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-stone-500" />
                          </a>
                        </div>
                        <div className="text-xs font-mono-code text-stone-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>Publisher: <strong>{source.publisher}</strong></span>
                          <span>•</span>
                          <span>Category: {source.category}</span>
                          {source.dateOrEra && (
                            <>
                              <span>•</span>
                              <span>Era: {source.dateOrEra}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span className={`text-[11px] font-mono-code font-medium px-2.5 py-1 rounded shrink-0 self-start ${impactBadge}`}>
                        {source.authorityImpact}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-stone-700">
                      <strong className="text-stone-900">Discovered Evidence / Excerpt:</strong> {source.discoveredEvidence}
                    </div>

                    <div className="text-xs text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200/70">
                      <strong className="text-stone-900">Contextual Significance:</strong> {source.contextualSignificance}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION E: SOCIAL MEDIA AUDIENCE DISCOURSE & LONGITUDINAL EVOLUTION */}
        {(activeTab === 'all' || activeTab === 'discourse') && report.audienceResponseAnalysis && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="text-xl font-serif-luxury font-semibold text-stone-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-stone-800" />
                  <span>Public & Social Audience Discourse: How People Respond</span>
                </h2>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  Longitudinal perception analysis across the years and synthesized audience commentary across LinkedIn, Facebook, and professional communities.
                </p>
              </div>
              <span className="text-xs font-mono-code text-stone-400">Audience Sentiment & Commentary Audit</span>
            </div>

            {/* Discourse Synthesis Card */}
            <div className="p-6 bg-stone-50 rounded-xl border border-stone-200 mb-8 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-stone-500 font-semibold">
                <Brain className="w-4 h-4 text-stone-800" />
                <span>Executive Discourse Summary:</span>
              </div>
              <p className="text-sm text-stone-800 leading-relaxed font-sans">
                {report.audienceResponseAnalysis.overallDiscourseSummary}
              </p>

              {/* What people praise vs what they debate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-stone-200/80">
                <div className="bg-white p-4 rounded-lg border border-emerald-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono-code text-emerald-800 font-semibold">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>What People Praise Most in Comments & Feedback:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {report.audienceResponseAnalysis.sentimentSynthesis.whatPeoplePraiseMost.map((praise, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                        <span>{praise}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-lg border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono-code text-amber-800 font-semibold">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>What Audiences Question, Debate or Inquire About:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {report.audienceResponseAnalysis.sentimentSynthesis.whatAudiencesQuestionOrDebate.map((debt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                        <span>{debt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Relatability vs Distance */}
              <div className="bg-white p-3.5 rounded-lg border border-stone-200/80 text-xs text-stone-700 flex items-start gap-2.5">
                <Heart className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-stone-900 font-medium">Relatability vs. Authority Distance: </strong>
                  <span>{report.audienceResponseAnalysis.sentimentSynthesis.perceivedRelatabilityVsDistance}</span>
                </div>
              </div>
            </div>

            {/* Longitudinal Perception: How They Are Seen Throughout the Years */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-stone-700" />
                <h3 className="text-base font-serif-luxury font-semibold text-stone-950">
                  Longitudinal Perception: Evolution Throughout the Years
                </h3>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                Tracking how public narrative, market reception, and authority depth have transitioned across career epochs.
              </p>

              <div className="space-y-4">
                {report.audienceResponseAnalysis.longitudinalEvolution.map((epoch, idx) => {
                  const shiftBadge =
                    epoch.sentimentShift === 'Established Category Anchor'
                      ? 'bg-emerald-100 text-emerald-800'
                      : epoch.sentimentShift === 'Rising Authority'
                      ? 'bg-sky-100 text-sky-800'
                      : epoch.sentimentShift === 'Pivoting / Broadening'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-stone-200 text-stone-700';

                  return (
                    <div
                      key={idx}
                      className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-200">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-stone-900 text-stone-50 text-xs font-mono-code font-semibold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm sm:text-base font-serif-luxury font-semibold text-stone-950">
                              {epoch.era}
                            </h4>
                            <span className="text-xs font-mono-code text-stone-500">{epoch.years}</span>
                          </div>
                        </div>

                        <span className={`text-[11px] font-mono-code font-medium px-2.5 py-1 rounded self-start sm:self-auto ${shiftBadge}`}>
                          {epoch.sentimentShift}
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm text-stone-800">
                        <strong className="text-stone-950">Defining Public Narrative:</strong> {epoch.definingNarrative}
                      </div>

                      <div className="text-xs text-stone-700 bg-white p-3 rounded-lg border border-stone-200/80">
                        <strong className="text-stone-900">Market & Audience Reception:</strong> {epoch.publicReception}
                      </div>

                      {epoch.keyMilestones && epoch.keyMilestones.length > 0 && (
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-2 pt-1">
                          <span className="font-mono-code text-stone-400">Verifiable Anchors:</span>
                          {epoch.keyMilestones.map((m, mi) => (
                            <span key={mi} className="px-2 py-0.5 rounded bg-stone-200/70 text-stone-800 font-mono-code text-[11px]">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Social Platform Response Dossiers (LinkedIn, Facebook, Forums) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-stone-700" />
                <h3 className="text-base font-serif-luxury font-semibold text-stone-950">
                  Platform-by-Platform Response & Comment Analysis
                </h3>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                Specific archetypes, comment dynamics, engagement resonance, and dialogue depth observed on LinkedIn, Facebook, and industry channels.
              </p>

              <div className="grid grid-cols-1 gap-6">
                {report.audienceResponseAnalysis.platformDossiers.map((pDossier, pIdx) => {
                  return (
                    <div
                      key={pIdx}
                      className="p-5 sm:p-6 bg-stone-50 rounded-xl border border-stone-200 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-stone-900 text-stone-50 flex items-center justify-center font-bold font-serif-luxury text-sm">
                            {pDossier.platform.substring(0, 2)}
                          </div>
                          <div>
                            <h4 className="text-base font-serif-luxury font-semibold text-stone-950">
                              {pDossier.platform} Audience Response
                            </h4>
                            <span className="text-xs font-mono-code text-stone-500">
                              Audience: {pDossier.audienceType}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono-code px-2.5 py-1 rounded bg-stone-200/80 text-stone-800">
                            Tone: <strong>{pDossier.dominantTone}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Engagement Metrics Banner */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-lg border border-stone-200/80 text-xs">
                        <div>
                          <span className="text-stone-400 block font-mono-code text-[11px]">Resonance Score</span>
                          <span className="text-base font-mono-code font-bold text-stone-900">
                            {pDossier.engagementMetrics.resonanceScore} / 100
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-mono-code text-[11px]">Discourse Depth</span>
                          <span className="font-semibold text-stone-900">
                            {pDossier.engagementMetrics.discourseDepth}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-mono-code text-[11px]">Sentiment Ratio</span>
                          <span className="font-mono-code font-medium text-emerald-800">
                            {pDossier.engagementMetrics.sentimentRatio}
                          </span>
                        </div>
                      </div>

                      {/* Recurring Themes */}
                      {pDossier.recurringCommentThemes && pDossier.recurringCommentThemes.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono-code text-stone-500 uppercase tracking-wider font-semibold">
                            Recurring Comment Themes:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {pDossier.recurringCommentThemes.map((theme, ti) => (
                              <span
                                key={ti}
                                className="px-2.5 py-1 rounded-md bg-stone-200/70 text-stone-800 text-xs font-sans"
                              >
                                • {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sample Representative Responses */}
                      {pDossier.sampleResponses && pDossier.sampleResponses.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-mono-code text-stone-500 uppercase tracking-wider font-semibold">
                            Representative Audience Feedback & Archetypes:
                          </span>
                          <div className="space-y-2">
                            {pDossier.sampleResponses.map((sample, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-3 bg-white rounded-lg border border-stone-200/70 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono-code text-stone-500">
                                  <span className="font-semibold text-stone-800">{sample.archetype}</span>
                                  <span>{sample.context}</span>
                                </div>
                                <p className="text-xs text-stone-800 italic">
                                  {sample.quoteOrSentiment}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* SECTION F: BEHAVIORAL PERCEPTION DIMENSIONS & BENCHMARKS */}
        {(activeTab === 'all' || activeTab === 'dimensions') && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-serif-luxury font-semibold text-stone-900">
                  Behavioral Perception Dimensions & Market Benchmarks
                </h2>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  Grounded in psychological perception modeling (Fiske Stereotype Content Model: Competence vs. Warmth).
                </p>
              </div>
              <span className="text-xs font-mono-code text-stone-400">Peer 75th %tile</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Graph A: 5 Dimensions Bar Chart */}
              <div className="bg-stone-50/70 p-5 rounded-xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-stone-900">
                      Public Perception Coordinates vs. Industry Benchmark
                    </h3>
                    <span className="text-xs font-mono-code text-stone-500">0–100 Scale</span>
                  </div>
                  <p className="text-xs text-stone-500 mb-4">
                    Scores calculated from documented third-party authority signals, clarity, and PR presence.
                  </p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dimensionChartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                      <XAxis type="number" domain={[0, 100]} stroke="#a8a29e" fontSize={11} />
                      <YAxis dataKey="name" type="category" width={110} stroke="#78716c" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1c1917', color: '#f5f5f4', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                        formatter={(val: any) => [`${val ?? 0} pts`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="Current" fill="#1c1917" radius={[0, 4, 4, 0]} name="Your Public Signal" />
                      <Bar dataKey="Benchmark" fill="#a8a29e" radius={[0, 4, 4, 0]} name="Top Authority Baseline" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graph B: Sentiment & Public Footprint Distribution */}
              <div className="bg-stone-50/70 p-5 rounded-xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-stone-900">
                      Public Reception & Unindexed Expertise
                    </h3>
                    <span className="text-xs font-mono-code px-2 py-0.5 rounded font-medium bg-stone-200 text-stone-800">
                      Market Distribution
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mb-2">
                    Distribution of visible public sentiment alongside estimated <strong>unindexed value</strong> (depth not yet captured in public PR).
                  </p>
                </div>

                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                        label={(entry) => `${entry.value}%`}
                      >
                        {sentimentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1c1917', color: '#f5f5f4', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                        formatter={(val: any) => [`${val ?? 0}%`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Dimension Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 font-mono-code uppercase tracking-wider text-xs border-b border-stone-200">
                    <th className="p-3.5 font-semibold">Dimension</th>
                    <th className="p-3.5 font-semibold">Score</th>
                    <th className="p-3.5 font-semibold">Benchmark</th>
                    <th className="p-3.5 font-semibold">Gap</th>
                    <th className="p-3.5 font-semibold">Empirical Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {report.dimensions.map((dim, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-3.5 font-medium text-stone-900 font-serif-luxury">
                        {dim.name}
                      </td>
                      <td className="p-3.5 font-mono-code font-semibold text-stone-950">
                        {dim.score}
                      </td>
                      <td className="p-3.5 font-mono-code text-stone-500">
                        {dim.benchmark}
                      </td>
                      <td className="p-3.5 font-mono-code">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          dim.gap >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {dim.gap >= 0 ? `+${dim.gap}` : dim.gap}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-stone-700">
                        {dim.evidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* SECTION F: PR & VISIBILITY GAPS (REVENUE INHIBITORS) */}
        {(activeTab === 'all' || activeTab === 'roadmap') && (
          <section className="mb-12 page-break-inside-avoid">
            <div className="mb-4">
              <h2 className="text-xl font-serif-luxury font-semibold text-stone-900">
                Visibility & PR Friction Points Holding Back Revenue
              </h2>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Specific perceptual blind spots that suppress inbound deal flow and prevent commanding top-tier advisory fees.
              </p>
            </div>

            <div className="space-y-4">
              {report.prAndVisibilityGaps.map((gap, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200/70">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-sm text-stone-900">
                        {gap.issue}
                      </span>
                    </div>
                    <span className={`text-xs font-mono-code font-semibold px-2 py-0.5 rounded ${
                      gap.severity === 'High'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {gap.severity} Severity
                    </span>
                  </div>

                  <div className="text-xs text-stone-700">
                    <strong className="text-stone-900">Impact on Revenue:</strong> {gap.impactOnRevenue}
                  </div>

                  <div className="text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/60 font-medium">
                    <strong className="text-emerald-950">Actionable PR Remedy:</strong> {gap.actionableRecommendation}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION G: STRATEGIC 90-DAY PRESENCE & PR ROADMAP */}
        {(activeTab === 'all' || activeTab === 'roadmap') && (
          <section className="mb-10 page-break-inside-avoid">
            <div className="mb-6">
              <h2 className="text-xl font-serif-luxury font-semibold text-stone-900">
                Strategic 90-Day Presence & PR Roadmap
              </h2>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Structured sequence to elevate public authority, attract tier-1 press/podcasts, and translate visibility into premium advisory revenue.
              </p>
            </div>

            <div className="space-y-6">
              {report.timeline.map((item, idx) => (
                <div
                  key={item.phase}
                  className="p-5 sm:p-6 bg-stone-50 rounded-xl border border-stone-200 relative"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-200/80">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-stone-50 text-xs font-mono-code font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="text-base font-serif-luxury font-semibold text-stone-900">
                        {item.phase}
                      </h3>
                    </div>
                    <span className="text-xs font-mono-code font-semibold px-2.5 py-1 bg-stone-200/70 text-stone-800 rounded-md shrink-0">
                      {item.timeframe}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-stone-700 mb-3">
                    <strong>Strategic Focus:</strong> {item.focus}
                  </p>

                  <div className="space-y-2 mb-4">
                    {item.actions.map((act, actIdx) => (
                      <div key={actIdx} className="flex items-start gap-2 text-xs sm:text-sm text-stone-700">
                        <CheckCircle className="w-4 h-4 text-stone-900 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="text-stone-600">
                      <strong className="text-stone-900">Perceptual Shift:</strong> {item.expectedImpact}
                    </div>
                    <div className="text-emerald-700 font-medium">
                      <strong className="text-stone-900">Revenue Impact:</strong> {item.revenueUpside}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Web Grounding References (if present) */}
        {report.webSources && report.webSources.length > 0 && (
          <section className="mb-8 pt-4 border-t border-stone-200/80">
            <div className="text-xs font-mono-code text-stone-500 uppercase tracking-wider mb-2">
              Verified Web Grounding Citations
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {report.webSources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors font-mono-code"
                >
                  <span>{src.title}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Document Footer */}
        <footer className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs font-mono-code text-stone-500 gap-3">
          <div>
            FELIXA EXPERTS • The Public Perception Mirror & Behavioral Intelligence Profile
          </div>
          <div>
            FELIXA helps bring out the best in people.
          </div>
        </footer>
      </div>

      {/* Methodology Modal */}
      <MethodologyModal
        isOpen={showMethodology}
        onClose={() => setShowMethodology(false)}
      />
    </div>
  );
};
