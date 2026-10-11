import React, { useState } from 'react';
import { ResearchingScreen } from './components/ResearchingScreen';
import { ReportView } from './components/ReportView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Disclaimer } from './components/Disclaimer';
import { PathToTopModal } from './components/PathToTopModal';
import { GrowthPlanView } from './components/GrowthPlanView';
import type { GrowthPlan, PlanAnswers } from '../growth';
import { SettingsModal } from './components/SettingsModal';
import { aiHeaders, getSettings, AiSettings, PROVIDERS } from './ai-settings';
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
  KeyRound,
} from 'lucide-react';

export default function App() {
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(getSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchRun, setSearchRun] = useState(0);
  const [planData, setPlanData] = useState<GrowthPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [stage, setStage] = useState<'search' | 'researching' | 'report' | 'planning' | 'plan'>('search');
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
      const res = await fetch(`/api/search-profiles?${params.toString()}`, { headers: aiHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || `Profile search failed (${res.status})`);
        setIsVerificationModalOpen(false);
        return;
      }
      {
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
      setErrorMsg('Could not reach the server. Please try again.');
      setIsVerificationModalOpen(false);
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

  // Wipes everything about the previous person so nothing carries over into the next search
  const handleResetToSearch = () => {
    setStage('search');
    setErrorMsg(null);
    setReportData(null);
    setCandidateWebsites([]);
    setVerifiedWebsites([]);
    setExcludedWebsites([]);
    setCustomUrls([]);
    setNewCustomUrl('');
    setShowAddCustomUrl(false);
    setNameInput('');
    setAffiliationInput('');
    setDomainInput('');
    setShowOptionalDetails(false);
    setCurrentAnalyzingName('');
    setIsVerificationModalOpen(false);
    setPlanData(null);
    setPlanError(null);
    setIsPlanModalOpen(false);
    setSearchRun((n) => n + 1);
  };

  // "Path to the top": a plan built from the report, with real opportunities and a budget
  const handleCreatePlan = async (answers: PlanAnswers) => {
    if (!reportData) return;
    setIsPlanModalOpen(false);
    setPlanError(null);
    setStage('planning');
    try {
      const response = await fetch('/api/growth-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ subject: reportData.subjectName, report: reportData, answers }),
      });
      const result = await response.json().catch(() => null);
      if (result === null) throw new Error('The connection was interrupted before your plan was ready. Your report is safe. Please press "Path to the top" again.');
      if (!response.ok || result.error) throw new Error(result.error || `Server returned ${response.status}`);
      if (!result.success || !result.data) throw new Error('The plan came back incomplete. Please try again.');
      setPlanData(result.data);
      setStage('plan');
    } catch (err: any) {
      setPlanError(err?.message || 'The plan could not be created. Please try again.');
      setStage('report');
    }
  };

  const runAnalysis = async (input: ExpertProfileInput) => {
    setCurrentAnalyzingName(input.name);
    setStage('researching');
    setErrorMsg(null);

    try {
      const response = await fetch('/api/analyze-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify(input),
      });

      const result = await response.json().catch(() => null);
      // An empty or cut-off reply means the connection dropped (for example the server restarted) before the report was ready
      if (result === null) {
        throw new Error('The connection was interrupted before your report was ready. Nothing was lost on your side. Please press "Create my report" again.');
      }
      if (!response.ok || result.error) {
        throw new Error(result.error || `Server returned ${response.status}`);
      }

      if (result.success && result.data) {
        setReportData(result.data);
        setStage('report');
      } else {
        throw new Error('The report came back incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err?.message || 'Analysis failed. Please try again.');
      setStage('search');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col selection:bg-stone-900 selection:text-stone-50">
      {/* Top Navbar */}
      <header className="no-print w-full border-b border-stone-200 bg-white/90 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-cinzel text-xl font-bold tracking-widest text-stone-950">
              ExpertScan
            </span>
            <span className="h-4 w-px bg-stone-300 hidden sm:inline-block" />
            <span className="text-xs font-mono-code text-stone-500 uppercase tracking-wider hidden sm:inline-block">
              Public perception for experts
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono-code">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              title="Optional: use your own AI key"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-600" />
              <span>{aiSettings ? PROVIDERS[aiSettings.provider].label : 'AI'}</span>
            </button>
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
              <span>See what the internet says about you</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl font-serif-luxury font-medium text-stone-950 tracking-tight leading-tight sm:leading-snug mb-4">
              See yourself the way others see you.
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto mb-8 leading-relaxed font-sans">
              Type your name. ExpertScan searches the public web, finds pages that may be yours (LinkedIn, Facebook, YouTube, your own website and more), and shows you how others may see you compared with how you see yourself.
            </p>

            {/* Deep Search Input Card */}
            <div className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-stone-300/80 shadow-md p-6 sm:p-7 text-left mb-8 transition-all">
              {errorMsg && (
                <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div>
                  <label htmlFor="input-expert-name" className="block text-xs font-mono-code uppercase tracking-wider text-stone-700 font-semibold mb-2">
                    Your full name
                  </label>
                  <div className="relative">
                    <input
                      id="input-expert-name"
                      type="text"
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your full name"
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
                          placeholder="e.g. Microsoft, Harvard..."
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
                    <span>Check pages first</span>
                  </button>

                  <button
                    id="btn-start-search"
                    type="submit"
                    disabled={!nameInput.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium shadow-md transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Create my report</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="mt-4 pt-4 border-t border-stone-200/80 flex items-center justify-center gap-2 text-xs font-mono-code text-stone-500 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>No questions to answer • You check the pages before we write the report</span>
              </div>
            </div>

            <div className="max-w-xl mx-auto mb-8 -mt-2 px-2">
              <Disclaimer variant="short" />
            </div>

            {/* 3 Pillars Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto pt-8 border-t border-stone-200">
              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>You vs. the public</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Compares how you describe yourself with what peers, clients and the press say.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <GraduationCap className="w-4 h-4 text-amber-600" />
                  <span>Your story</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Looks at your schools, work history, awards and the challenges you overcame.
                </p>
              </div>

              <div className="p-4 bg-white/70 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2 mb-2 text-stone-900 font-medium text-xs font-mono-code uppercase tracking-wide">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Public reactions</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Looks for comments and reactions about you that are public. Some sites block us, so this part may be limited.
                </p>
              </div>
            </div>
          </div>
        )}

        {stage === 'researching' && (
          <ResearchingScreen expertName={currentAnalyzingName || nameInput || 'Subject'} />
        )}

        {stage === 'report' && reportData && (
          <ErrorBoundary onReset={handleResetToSearch}>
            <ReportView
              report={reportData}
              onRetake={handleResetToSearch}
              onManageSources={() => handleReviewWebsites(reportData.subjectName)}
              onCreatePlan={() => { setPlanError(null); setIsPlanModalOpen(true); }}
              planError={planError}
            />
          </ErrorBoundary>
        )}

        {stage === 'planning' && <ResearchingScreen expertName={reportData?.subjectName || 'Subject'} variant="plan" />}

        {stage === 'plan' && planData && (
          <ErrorBoundary onReset={() => setStage('report')}>
            <GrowthPlanView plan={planData} onBack={() => setStage('report')} />
          </ErrorBoundary>
        )}
      </main>

      <PathToTopModal isOpen={isPlanModalOpen} subjectName={reportData?.subjectName || ''} onClose={() => setIsPlanModalOpen(false)} onCreate={handleCreatePlan} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSaved={setAiSettings} />

      {/* Website Verification & Live Preview Modal */}
      <WebsiteVerificationModal
        key={searchRun}
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
