import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Search,
  Globe,
  ExternalLink,
  AlertTriangle,
  Plus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  MessageCircle,
  Quote,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { DiscoveredWebsite, ScrapedWebsiteData } from '../types';

interface WebsiteVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  expertName: string;
  affiliation?: string;
  websites: DiscoveredWebsite[];
  isLoading: boolean;
  onConfirm: (verified: DiscoveredWebsite[], excluded: DiscoveredWebsite[]) => void;
  onAddCustomWebsite: (website: DiscoveredWebsite) => void;
}

export const WebsiteVerificationModal: React.FC<WebsiteVerificationModalProps> = ({
  isOpen,
  onClose,
  expertName,
  affiliation,
  websites,
  isLoading,
  onConfirm,
  onAddCustomWebsite,
}) => {
  // Local selection state (id -> isConfirmed)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    websites.forEach((w) => {
      map[w.id] = w.isConfirmed !== undefined ? w.isConfirmed : !w.isPotentialCollision;
    });
    return map;
  });

  // Filter text
  const [filterText, setFilterText] = useState('');

  // Add custom URL inline form
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customPlatform, setCustomPlatform] = useState('Personal / Practice Site');
  const [isScrapingCustom, setIsScrapingCustom] = useState(false);

  // Preview Drawer/Modal State
  const [previewingSite, setPreviewingSite] = useState<DiscoveredWebsite | null>(null);
  const [previewScrapedData, setPreviewScrapedData] = useState<ScrapedWebsiteData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [scrapedCache, setScrapedCache] = useState<Record<string, ScrapedWebsiteData>>({});

  // Sync state whenever websites change
  useEffect(() => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      websites.forEach((w) => {
        if (next[w.id] === undefined) {
          next[w.id] = w.isConfirmed !== undefined ? w.isConfirmed : !w.isPotentialCollision;
        }
      });
      return next;
    });
  }, [websites]);

  if (!isOpen) return null;

  const toggleWebsite = (id: string) => {
    setSelectedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    websites.forEach((w) => {
      next[w.id] = true;
    });
    setSelectedMap(next);
  };

  const handleDeselectAll = () => {
    const next: Record<string, boolean> = {};
    websites.forEach((w) => {
      next[w.id] = false;
    });
    setSelectedMap(next);
  };

  // Open Preview and trigger live scraper
  const handleOpenPreview = async (site: DiscoveredWebsite, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewingSite(site);

    // If cached or already has scrapedData, use it
    if (scrapedCache[site.id]) {
      setPreviewScrapedData(scrapedCache[site.id]);
      return;
    }
    if (site.scrapedData) {
      setPreviewScrapedData(site.scrapedData);
      setScrapedCache((prev) => ({ ...prev, [site.id]: site.scrapedData! }));
      return;
    }

    // Otherwise fetch live scrape from server
    setIsLoadingPreview(true);
    setPreviewScrapedData(null);
    try {
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: site.url, name: expertName }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPreviewScrapedData(json.data);
          setScrapedCache((prev) => ({ ...prev, [site.id]: json.data }));
        }
      }
    } catch (err) {
      console.warn('Scraping error:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleNavigatePreview = (direction: 'next' | 'prev') => {
    if (!previewingSite) return;
    const currentIndex = websites.findIndex((w) => w.id === previewingSite.id);
    if (currentIndex === -1) return;

    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % websites.length
        : (currentIndex - 1 + websites.length) % websites.length;

    handleOpenPreview(websites[nextIndex]);
  };

  // Add custom URL with optional auto-scrape
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    let cleanUrl = customUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    let parsedDomain = 'custom-web';
    try {
      parsedDomain = new URL(cleanUrl).hostname.replace(/^www\./, '');
    } catch {
      parsedDomain = cleanUrl.replace(/^https?:\/\//, '').split('/')[0] || 'custom-web';
    }

    setIsScrapingCustom(true);

    let scrapedResult: ScrapedWebsiteData | undefined = undefined;
    try {
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, name: expertName }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          scrapedResult = json.data;
        }
      }
    } catch (err) {
      console.warn('Custom site scrape error:', err);
    } finally {
      setIsScrapingCustom(false);
    }

    const detectedPlatform =
      scrapedResult?.platform ||
      (cleanUrl.includes('linkedin.com')
        ? 'LinkedIn Profile'
        : cleanUrl.includes('facebook.com')
        ? 'Facebook Page'
        : cleanUrl.includes('scholar.google')
        ? 'Google Scholar'
        : customPlatform);

    const newSite: DiscoveredWebsite = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || scrapedResult?.title || `${expertName} - Verified Link (${parsedDomain})`,
      url: cleanUrl,
      domain: parsedDomain,
      platform: detectedPlatform,
      snippet: scrapedResult?.snippet || 'User-specified verified web footprint anchor.',
      isConfirmed: true,
      associationReason: 'Directly verified and submitted by user.',
      isPotentialCollision: false,
      isCustomAdded: true,
      scrapedData: scrapedResult,
    };

    onAddCustomWebsite(newSite);
    setSelectedMap((prev) => ({ ...prev, [newSite.id]: true }));
    if (scrapedResult) {
      setScrapedCache((prev) => ({ ...prev, [newSite.id]: scrapedResult! }));
    }
    setCustomTitle('');
    setCustomUrl('');
    setIsAddingCustom(false);
  };

  const confirmedCount = Object.values(selectedMap).filter(Boolean).length;
  const excludedCount = websites.length - confirmedCount;
  const potentialCollisionCount = websites.filter((w) => w.isPotentialCollision).length;

  const filteredWebsites = websites.filter((w) => {
    if (!filterText.trim()) return true;
    const term = filterText.toLowerCase();
    return (
      w.title.toLowerCase().includes(term) ||
      w.url.toLowerCase().includes(term) ||
      w.domain.toLowerCase().includes(term) ||
      w.platform.toLowerCase().includes(term) ||
      w.snippet.toLowerCase().includes(term)
    );
  });

  const handleConfirmAndSave = () => {
    const verifiedList: DiscoveredWebsite[] = [];
    const excludedList: DiscoveredWebsite[] = [];

    websites.forEach((w) => {
      const isChecked = selectedMap[w.id] ?? false;
      const cached = scrapedCache[w.id];
      const updatedSite = { ...w, isConfirmed: isChecked, ...(cached ? { scrapedData: cached } : {}) };
      if (isChecked) {
        verifiedList.push(updatedSite);
      } else {
        excludedList.push(updatedSite);
      }
    });

    onConfirm(verifiedList, excludedList);
    onClose();
  };

  return (
    <div
      id="website-verification-modal-overlay"
      className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-200 bg-stone-50/90 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-code text-stone-600 uppercase tracking-wider mb-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Web Discovery & Source Verification</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif-luxury font-medium text-stone-900 leading-tight">
              Review, Preview & Add Discovered Sources for {expertName || 'Subject'}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl leading-relaxed">
              Preview candidate websites to verify they truly belong to you. Uncheck namesakes or add extra links (LinkedIn, Facebook, personal sites) so only 100% authentic data is scraped.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Filter Toolbar */}
        <div className="px-5 py-3.5 bg-stone-100/70 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-code">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 rounded-md font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              {confirmedCount} Verified to Scrape
            </span>
            {excludedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-200 text-stone-700 border border-stone-300 rounded-md">
                <XCircle className="w-3.5 h-3.5 text-stone-500" />
                {excludedCount} Excluded
              </span>
            )}
            {potentialCollisionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                {potentialCollisionCount} Needs Review
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-mono-code uppercase px-2.5 py-1 bg-white hover:bg-stone-200 border border-stone-300 rounded text-stone-700 transition-colors cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-[11px] font-mono-code uppercase px-2.5 py-1 bg-white hover:bg-stone-200 border border-stone-300 rounded text-stone-700 transition-colors cursor-pointer"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="text-[11px] font-mono-code uppercase px-3 py-1 bg-stone-900 hover:bg-stone-800 text-stone-50 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Include Extra Page</span>
            </button>
          </div>
        </div>

        {/* Quick Search filter bar */}
        <div className="px-5 py-2.5 border-b border-stone-200/80 bg-white flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search discovered websites by title, domain, or platform (e.g. LinkedIn, Facebook)..."
            className="w-full text-xs font-sans text-stone-800 placeholder:text-stone-400 bg-transparent focus:outline-hidden"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="text-[11px] text-stone-400 hover:text-stone-600 font-mono-code"
            >
              Clear
            </button>
          )}
        </div>

        {/* Add custom website collapsible form */}
        <AnimatePresence>
          {isAddingCustom && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddSubmit}
              className="p-5 bg-amber-50/60 border-b border-amber-200 shrink-0 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono-code uppercase font-semibold text-amber-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-700" />
                  <span>Include A Page That Wasn&apos;t Found (Personal Site, LinkedIn, Facebook, Press, etc.)</span>
                </div>
                <span className="text-[11px] text-amber-800 font-mono-code">
                  We will automatically scrape and extract public information from this link
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono-code text-stone-600 mb-1">
                    Website / Profile URL:
                  </label>
                  <input
                    type="text"
                    required
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/... or https://facebook.com/... or https://mysite.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono-code text-stone-600 mb-1">
                    Display Label / Title (Optional):
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. My Personal Blog, Keynote Video, Specific Press Article"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-mono-code text-stone-500">Category:</label>
                  <select
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                    className="text-xs bg-white border border-stone-300 rounded px-2 py-1 text-stone-800"
                  >
                    <option value="LinkedIn Profile">LinkedIn Profile</option>
                    <option value="Facebook Page">Facebook Page</option>
                    <option value="Official Website">Official Personal / Practice Site</option>
                    <option value="Academic Publications">Google Scholar / Research</option>
                    <option value="Press & Media">Media / Press Article</option>
                    <option value="Social Discourse">Substack / Medium Article</option>
                    <option value="YouTube / Talk">Keynote / YouTube</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(false)}
                    className="px-3 py-1.5 text-xs font-mono-code text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isScrapingCustom || !customUrl.trim()}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-stone-50 rounded-lg text-xs font-mono-code uppercase font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    {isScrapingCustom ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Scraping & Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Scrape & Include Page</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Scrollable Website Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-10 h-10 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-900">
                  Scanning live web for candidate websites...
                </p>
                <p className="text-xs text-stone-500 font-mono-code">
                  Excavating directories, social graphs, and public profiles for &ldquo;{expertName}&rdquo;
                </p>
              </div>
            </div>
          ) : filteredWebsites.length === 0 ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <p className="text-sm font-medium text-stone-700">No websites match your search.</p>
              <p className="text-xs">Try clearing the search filter or click &ldquo;Include Extra Page&rdquo; to add one.</p>
            </div>
          ) : (
            filteredWebsites.map((site) => {
              const isChecked = selectedMap[site.id] ?? false;
              const hasCachedScrape = Boolean(scrapedCache[site.id] || site.scrapedData);

              return (
                <div
                  key={site.id}
                  onClick={() => toggleWebsite(site.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-white border-stone-300 hover:border-stone-500 shadow-2xs'
                      : 'bg-stone-100/70 border-stone-200 opacity-60 hover:opacity-85'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Big Checkbox */}
                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-stone-900 border-stone-900 text-stone-50'
                            : 'bg-white border-stone-300 text-transparent hover:border-stone-400'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </div>

                    {/* Website details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4
                            className={`text-sm font-semibold truncate ${
                              isChecked ? 'text-stone-900' : 'text-stone-600 line-through'
                            }`}
                          >
                            {site.title}
                          </h4>
                          {site.isCustomAdded && (
                            <span className="text-[10px] font-mono-code px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-medium">
                              User Added
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono-code px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded">
                            {site.domain}
                          </span>
                          <span className="text-[10px] font-mono-code uppercase px-2 py-0.5 bg-stone-900/5 text-stone-800 font-medium rounded">
                            {site.platform}
                          </span>
                        </div>
                      </div>

                      {/* URL Display */}
                      <div className="text-[11px] font-mono-code text-stone-500 truncate mb-1.5">
                        {site.url}
                      </div>

                      {/* Snippet / Description */}
                      <p className="text-xs text-stone-600 leading-relaxed mb-2">
                        {site.snippet}
                      </p>

                      {/* Potential Name Collision Warning Banner */}
                      {site.isPotentialCollision && (
                        <div className="p-2.5 bg-amber-50/90 border border-amber-300/80 rounded-lg text-xs text-amber-900 flex items-start gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold uppercase tracking-wider font-mono-code text-[10px] text-amber-800 block">
                              Potential Name Collision Detected:
                            </span>
                            <span>{site.associationReason}</span>
                          </div>
                        </div>
                      )}

                      {/* Bottom action row with Preview button */}
                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-stone-200/50 text-[11px] font-mono-code gap-2">
                        <div className="flex items-center gap-2">
                          {isChecked ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Included in Mirror Search
                            </span>
                          ) : (
                            <span className="text-stone-500 font-medium flex items-center gap-1">
                              <X className="w-3 h-3" />
                              Excluded (Not My Profile)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Live Preview Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenPreview(site, e)}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Preview page & view scraped comments/signals"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-700" />
                            <span>Preview & Scraped Content</span>
                            {hasCachedScrape && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                            )}
                          </button>

                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded transition-colors inline-flex items-center"
                            title="Open in new window"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-600 font-mono-code flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-stone-700 shrink-0" />
            <span>
              {confirmedCount} authentic {confirmedCount === 1 ? 'source' : 'sources'} verified
              {excludedCount > 0 ? ` • ${excludedCount} excluded` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-mono-code uppercase font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={confirmedCount === 0}
              className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-stone-50 text-xs font-mono-code uppercase font-medium rounded-xl transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Scrape Verified Sources ({confirmedCount})</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Interactive Website Preview Overlay / Modal */}
      <AnimatePresence>
        {previewingSite && (
          <div
            id="site-preview-modal-overlay"
            className="fixed inset-0 z-60 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Preview Header */}
              <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNavigatePreview('prev')}
                      className="p-1.5 hover:bg-stone-200 rounded text-stone-600 transition-colors cursor-pointer"
                      title="Previous website"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigatePreview('next')}
                      className="p-1.5 hover:bg-stone-200 rounded text-stone-600 transition-colors cursor-pointer"
                      title="Next website"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono-code uppercase px-2 py-0.5 bg-stone-900 text-stone-50 rounded font-semibold">
                        {previewingSite.platform}
                      </span>
                      <span className="text-xs font-mono-code text-stone-500 truncate">
                        {previewingSite.domain}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-stone-900 truncate mt-0.5">
                      {previewScrapedData?.title || previewingSite.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={previewingSite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-mono-code"
                    title="Open website in new browser tab"
                  >
                    <span>Open External</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setPreviewingSite(null)}
                    className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview Body with Scraped Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {isLoadingPreview ? (
                  <div className="py-20 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-stone-800 mx-auto" />
                    <p className="text-sm font-medium text-stone-900">
                      Scraping live content and audience reactions from {previewingSite.domain}...
                    </p>
                    <p className="text-xs text-stone-500 font-mono-code">
                      Extracting profile bio, headlines, comments, and public engagement signals
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Live Scraped Banner */}
                    <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs font-mono-code text-stone-600">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Scraped Content Preview • Automated Footprint Extraction</span>
                      </div>
                      <span className="text-stone-400 text-[11px]">
                        URL: {previewingSite.url}
                      </span>
                    </div>

                    {/* Summary / Bio */}
                    <div>
                      <h4 className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-1.5 font-semibold">
                        Stated Bio / Profile Excerpt:
                      </h4>
                      <p className="text-sm text-stone-800 bg-stone-50/70 p-3.5 rounded-xl border border-stone-200 leading-relaxed font-sans">
                        {previewScrapedData?.snippet || previewingSite.snippet}
                      </p>
                    </div>

                    {/* Scraped Body / Post Excerpts */}
                    {previewScrapedData?.bodySnippets && previewScrapedData.bodySnippets.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-2 font-semibold">
                          Extracted Post & Content Paragraphs:
                        </h4>
                        <div className="space-y-2">
                          {previewScrapedData.bodySnippets.map((snip, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-stone-700 bg-white p-3 rounded-lg border border-stone-200 leading-relaxed font-sans"
                            >
                              &ldquo;{snip}&rdquo;
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scraped Quotes from Page */}
                    {previewScrapedData?.extractedQuotes && previewScrapedData.extractedQuotes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono-code uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-2 font-semibold">
                          <Quote className="w-3.5 h-3.5 text-amber-700" />
                          <span>Scraped Quotes & Statements:</span>
                        </h4>
                        <div className="space-y-2">
                          {previewScrapedData.extractedQuotes.map((q, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-stone-800 italic bg-amber-50/50 p-3 rounded-lg border border-amber-200/70 leading-relaxed"
                            >
                              {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scraped Audience Reactions & Comments (LinkedIn, Facebook, Forums) */}
                    {previewScrapedData?.audienceReactions && previewScrapedData.audienceReactions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono-code uppercase tracking-wider text-blue-900 flex items-center gap-1.5 mb-2 font-semibold">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-700" />
                          <span>Audience Discourse & Peer Comments (LinkedIn / FB / Community):</span>
                        </h4>
                        <div className="space-y-2">
                          {previewScrapedData.audienceReactions.map((reaction, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-stone-800 bg-blue-50/40 p-3 rounded-lg border border-blue-200/70 leading-relaxed flex items-start gap-2.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                              <span>{reaction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Behavioral Signals */}
                    {previewScrapedData?.keySignals && previewScrapedData.keySignals.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-2 font-semibold">
                          Key Reputation Signals Extracted:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {previewScrapedData.keySignals.map((sig, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2.5 py-1 bg-stone-100 text-stone-800 border border-stone-200 rounded-md font-sans"
                            >
                              ✓ {sig}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safe Iframe Preview Card / Notice */}
                    <div className="pt-2">
                      <div className="p-3.5 bg-stone-100/70 rounded-xl border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
                        <span>
                          Want to view the raw live webpage?
                        </span>
                        <a
                          href={previewingSite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-white hover:bg-stone-200 border border-stone-300 rounded font-mono-code text-[11px] text-stone-800 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>Open in New Tab</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Preview Footer Decision Controls */}
              <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs font-mono-code text-stone-600">
                  Current Status:{' '}
                  {selectedMap[previewingSite.id] ? (
                    <strong className="text-emerald-700 font-semibold">Included in Analysis</strong>
                  ) : (
                    <strong className="text-stone-500 font-semibold">Excluded</strong>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap((prev) => ({ ...prev, [previewingSite.id]: false }));
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-mono-code uppercase font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      !selectedMap[previewingSite.id]
                        ? 'bg-stone-300 text-stone-800'
                        : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Exclude (Not Me)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMap((prev) => ({ ...prev, [previewingSite.id]: true }));
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-mono-code uppercase font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      selectedMap[previewingSite.id]
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-stone-900 text-stone-50 hover:bg-stone-800'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Include in Mirror</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
