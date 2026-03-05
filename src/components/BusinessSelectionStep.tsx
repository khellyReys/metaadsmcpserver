import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Building2, Users, CheckCircle, AlertCircle, FileText, Search, ChevronLeft, ChevronRight, User } from 'lucide-react';
import Spinner from './Spinner';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, promiseWithTimeout } from '../lib/asyncUtils';
import { useVisibilityReset } from '../hooks/useVisibilityReset';

interface BusinessAccount {
  id: string;
  name: string;
  business_role: string;
  status: string;
  adAccountsCount: number;
}

/** Sentinel id for the virtual "Personal Ad Accounts" option (ad accounts not linked to a business). */
const PERSONAL_BUSINESS_ID = '__personal__';

const PERSONAL_BUSINESS_OPTION: BusinessAccount = {
  id: PERSONAL_BUSINESS_ID,
  name: 'Personal Ad Accounts',
  business_role: 'Personal',
  status: 'active',
  adAccountsCount: 0,
};

interface AdAccount {
  id: string;
  name: string;
  account_status: string;
  currency: string;
  timezone_name: string;
  account_role: string;
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  page_role: string;
  picture_url: string;
  cover_url: string;
  is_published: boolean;
  verification_status: string;
  followers_count: number;
  website: string;
  about: string;
}

interface Server {
  id: string;
  name: string;
  access_token: string;
  created_at: string;
  is_active: boolean;
}

interface BusinessSelectionStepProps {
  currentUser: { id: string };
  selectedServer: string;
  servers: Server[];
  businessAccounts: BusinessAccount[];
  selectedBusiness: string;
  facebookAccessToken: string;
  error: string;
  onBusinessSelected: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    userId?: string,
    names?: { businessName: string; adAccountName: string; pageName: string }
  ) => void;
  onSaveServer?: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    userId?: string,
    names?: { businessName: string; adAccountName: string; pageName: string }
  ) => void;
  onBusinessSelectionChange: (businessId: string) => void;
  onBusinessAccountsChange: (accounts: BusinessAccount[]) => void;
  onBackToServers: () => void;
  onBackToBusiness?: () => void;
  onBackToAdAccounts?: () => void;
  onAdvanceToAdAccount?: () => void;
  onAdvanceToPage?: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
  onFetchingProgress?: (progress: number, message: string) => void;
  initialStep?: 'business' | 'adaccount' | 'page';
  initialAdAccountId?: string;
}

const BusinessSelectionStep: React.FC<BusinessSelectionStepProps> = ({
  currentUser,
  selectedServer,
  servers,
  businessAccounts,
  selectedBusiness,
  facebookAccessToken,
  error,
  onBusinessSelected,
  onSaveServer,
  onBusinessSelectionChange,
  onBusinessAccountsChange,
  onBackToServers,
  onBackToBusiness,
  onBackToAdAccounts,
  onAdvanceToAdAccount,
  onAdvanceToPage,
  onClearError: _onClearError,
  supabase,
  onFetchingProgress = () => {},
  initialStep,
  initialAdAccountId,
}) => {
  const [_isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const restoreToPageDone = React.useRef(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [loadingAdAccounts, setLoadingAdAccounts] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    return () => { timerRefs.current.forEach(clearTimeout); };
  }, []);

  const safeTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timerRefs.current = timerRefs.current.filter(t => t !== id);
      fn();
    }, ms);
    timerRefs.current.push(id);
    return id;
  };

  useVisibilityReset(() => {
    setLoadingAdAccounts(false);
    setLoadingPages(false);
    setIsProcessing(false);
    setIsSaving(false);
    setIsRefreshing(false);
  });

  // Updated state for multi-step selection (sync from URL when initialStep changes)
  const [currentStep, setCurrentStep] = useState<'business' | 'adaccount' | 'page'>(initialStep ?? 'business');
  useEffect(() => {
    if (initialStep) setCurrentStep(initialStep);
  }, [initialStep]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>(initialAdAccountId ?? '');
  
  // New state for Facebook page selection
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [hasAttemptedPageLoad, setHasAttemptedPageLoad] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [pagePage, setPagePage] = useState(1);

  const PAGE_SIZE = 6;
  const filteredPages = pageSearchQuery.trim()
    ? facebookPages.filter(
        (p) =>
          p.name?.toLowerCase().includes(pageSearchQuery.toLowerCase()) ||
          p.category?.toLowerCase().includes(pageSearchQuery.toLowerCase()) ||
          (p.about && p.about.toLowerCase().includes(pageSearchQuery.toLowerCase()))
      )
    : facebookPages;
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / PAGE_SIZE));
  const currentPage = Math.min(pagePage, totalPages);
  const paginatedPages = filteredPages.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPagePage(1);
  }, [pageSearchQuery]);

  useEffect(() => {
    if (currentStep === 'page') {
      setPageSearchQuery('');
      setPagePage(1);
    }
  }, [currentStep]);

  // Load business accounts when component mounts
  useEffect(() => {
    if (facebookAccessToken && currentUser && businessAccounts.length === 0) {
      fetchAndSaveBusinessAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAndSaveBusinessAccounts is stable, businessAccounts.length intentionally excluded to avoid re-fetch loops
  }, [facebookAccessToken, currentUser]);

  const fetchAndSaveBusinessAccounts = async () => {
    if (!facebookAccessToken || !currentUser) return;

    try {
      onFetchingProgress?.(10, 'Validating Facebook token...');

      const meResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me?access_token=${facebookAccessToken}`,
        { timeoutMs: 20000 }
      );
      const meData = await meResponse.json();

      if (meData.error) {
        throw new Error(`Facebook token invalid: ${meData.error.message}`);
      }

      onFetchingProgress?.(40, 'Fetching business accounts...');

      const businessResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me/businesses?` +
          `access_token=${facebookAccessToken}&` +
          `fields=id,name,primary_page`,
        { timeoutMs: 20000 }
      );

      const businessData = await businessResponse.json();

      if (businessData.error) {
        throw new Error(`Facebook API error: ${businessData.error.message}`);
      }

      onFetchingProgress?.(70, 'Processing...');

      const businesses: BusinessAccount[] =
        businessData.data && businessData.data.length > 0
          ? businessData.data.map((business: { id: string; name: string; primary_page?: { id: string } }) => ({
              id: business.id,
              name: business.name,
              business_role: 'Admin',
              status: 'active',
              adAccountsCount: 0,
            }))
          : [];

      onFetchingProgress?.(100, 'Complete!');
      onBusinessAccountsChange(businesses);

      // Sync to Supabase in background so slow/expired session doesn't block business list
      if (businessData.data && businessData.data.length > 0) {
        void (async () => {
          for (const business of businessData.data) {
            await supabase
              .from('facebook_business_accounts')
              .upsert({
                id: business.id,
                user_id: currentUser.id,
                name: business.name,
                business_role: 'Admin',
                status: 'active',
                primary_page_id: business.primary_page?.id,
              });
          }
        })().catch(() => {});
      }

      safeTimeout(() => {
        onFetchingProgress?.(0, '');
      }, 1000);
    } catch {
      onFetchingProgress?.(0, '');
    }
  };

  // Fetch ad accounts for selected business from Facebook API (on demand)
  const fetchAdAccountsForBusiness = async (businessId: string) => {
    setLoadingAdAccounts(true);
    try {
      const adAccountsResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me/adaccounts?` +
          `access_token=${facebookAccessToken}&` +
          `fields=account_id,name,account_status,business,currency,timezone_name`,
        { timeoutMs: 20000 }
      );

      const adAccountsData = await adAccountsResponse.json();

      if (adAccountsData.error) {
        throw new Error(adAccountsData.error.message || 'Failed to load ad accounts');
      }

      const allAccounts = adAccountsData.data || [];
      const forBusiness = allAccounts.filter(
        (acc: { business?: { id: string } }) => acc.business?.id === businessId
      );

      const mapped: AdAccount[] = forBusiness.map((acc: {
        account_id: string;
        name: string;
        account_status: string;
        currency: string;
        timezone_name: string;
        business?: { id: string };
      }) => ({
        id: acc.account_id,
        name: acc.name,
        account_status: acc.account_status,
        currency: acc.currency,
        timezone_name: acc.timezone_name,
        account_role: 'USER',
      }));

      setAdAccounts(mapped);

      // Sync to Supabase in background so slow/expired session doesn't block UI or navigation
      void (async () => {
        for (const adAccount of forBusiness) {
          await supabase
            .from('facebook_ad_accounts')
            .upsert({
              id: adAccount.account_id,
              business_account_id: businessId,
              user_id: currentUser.id,
              name: adAccount.name,
              account_status: adAccount.account_status,
              currency: adAccount.currency,
              timezone_name: adAccount.timezone_name,
              account_role: adAccount.business?.id === businessId ? 'ADMIN' : 'USER',
            }, { onConflict: 'id' });
        }
      })().catch(() => {});
    } catch {
      setAdAccounts([]);
    } finally {
      setLoadingAdAccounts(false);
    }
  };

  // Fetch personal ad accounts (not linked to any business) from Facebook API
  const fetchPersonalAdAccounts = async () => {
    setLoadingAdAccounts(true);
    try {
      const adAccountsResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me/adaccounts?` +
          `access_token=${facebookAccessToken}&` +
          `fields=account_id,name,account_status,business,currency,timezone_name`,
        { timeoutMs: 20000 }
      );

      const adAccountsData = await adAccountsResponse.json();

      if (adAccountsData.error) {
        throw new Error(adAccountsData.error.message || 'Failed to load ad accounts');
      }

      const allAccounts = adAccountsData.data || [];
      const personalAccounts = allAccounts.filter(
        (acc: { business?: { id: string } }) => !acc.business?.id
      );

      const mapped: AdAccount[] = personalAccounts.map((acc: {
        account_id: string;
        name: string;
        account_status: string;
        currency: string;
        timezone_name: string;
      }) => ({
        id: acc.account_id,
        name: acc.name,
        account_status: acc.account_status,
        currency: acc.currency,
        timezone_name: acc.timezone_name,
        account_role: 'USER',
      }));

      setAdAccounts(mapped);
    } catch {
      setAdAccounts([]);
    } finally {
      setLoadingAdAccounts(false);
    }
  };

  // Fetch Facebook pages from API when user reaches page step (on demand)
  const fetchFacebookPages = async () => {
    setLoadingPages(true);
    try {
      const pagesResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me/accounts?` +
          `access_token=${facebookAccessToken}&` +
          `fields=id,name,category,access_token,picture,cover,is_published,verification_status,fan_count,website,about`,
        { timeoutMs: 20000 }
      );

      const pagesData = await pagesResponse.json();

      if (pagesData.error) {
        throw new Error(pagesData.error.message || 'Failed to load Facebook pages');
      }

      const rawPages = pagesData.data || [];

      const mapped: FacebookPage[] = rawPages.map((p: {
        id: string;
        name: string;
        category: string;
        picture?: { data?: { url?: string } };
        cover?: { source?: string };
        is_published?: boolean;
        verification_status?: string;
        fan_count?: number;
        website?: string;
        about?: string;
      }) => ({
        id: p.id,
        name: p.name,
        category: p.category ?? '',
        page_role: 'ADMIN',
        picture_url: p.picture?.data?.url ?? '',
        cover_url: p.cover?.source ?? '',
        is_published: p.is_published !== false,
        verification_status: p.verification_status ?? '',
        followers_count: p.fan_count ?? 0,
        website: p.website ?? '',
        about: p.about ?? '',
      }));

      setFacebookPages(mapped);

      // Sync to Supabase in background so slow/expired session doesn't block UI or navigation
      void (async () => {
        for (const page of rawPages) {
          await supabase
            .from('facebook_pages')
            .upsert({
              id: page.id,
              user_id: currentUser.id,
              name: page.name,
              category: page.category,
              access_token: page.access_token,
              page_role: 'ADMIN',
              picture_url: page.picture?.data?.url,
              cover_url: page.cover?.source,
              is_published: page.is_published !== false,
              verification_status: page.verification_status,
              followers_count: page.fan_count,
              website: page.website,
              about: page.about,
            }, { onConflict: 'id' });
        }
      })().catch(() => {});
    } catch {
      setFacebookPages([]);
    } finally {
      setLoadingPages(false);
      setHasAttemptedPageLoad(true);
    }
  };

  // When returning from Tools ("Back to page"), load ad accounts and pages for the pre-selected business/ad account
  useEffect(() => {
    if (
      initialStep !== 'page' ||
      !initialAdAccountId ||
      !selectedBusiness ||
      restoreToPageDone.current
    ) return;
    restoreToPageDone.current = true;
    (async () => {
      if (selectedBusiness === PERSONAL_BUSINESS_ID) {
        await fetchPersonalAdAccounts();
      } else {
        await fetchAdAccountsForBusiness(selectedBusiness);
      }
      await fetchFacebookPages();
    })();
  }, [initialStep, initialAdAccountId, selectedBusiness]);

  const handleBusinessCardClick = (businessId: string) => {
    onBusinessSelectionChange(businessId);
  };

  const resolveNames = () => {
    const allBusinesses = [PERSONAL_BUSINESS_OPTION, ...businessAccounts];
    const businessName = allBusinesses.find(b => b.id === selectedBusiness)?.name || selectedBusiness;
    const adAccountName = adAccounts.find(a => a.id === selectedAdAccount)?.name || selectedAdAccount;
    const pageName = facebookPages.find(p => p.id === selectedPage)?.name || selectedPage;
    return { businessName, adAccountName, pageName };
  };

  const handleContinue = async () => {
    if (currentStep === 'business' && selectedBusiness) {
      try {
        if (selectedBusiness === PERSONAL_BUSINESS_ID) {
          await fetchPersonalAdAccounts();
        } else {
          await fetchAdAccountsForBusiness(selectedBusiness);
        }
        if (onAdvanceToAdAccount) onAdvanceToAdAccount();
        else setCurrentStep('adaccount');
      } finally {
        setLoadingAdAccounts(false);
      }
    } else if (currentStep === 'adaccount' && selectedAdAccount) {
      try {
        await fetchFacebookPages();
        if (onAdvanceToPage) onAdvanceToPage();
        else setCurrentStep('page');
      } finally {
        setLoadingPages(false);
      }
    } else if (currentStep === 'page' && selectedPage) {
      setIsProcessing(true);
      try {
        const pageIdToSend = selectedPage;

        const selectedServerData = servers.find(s => s.id === selectedServer);
        if (!selectedServerData) {
          throw new Error('Server not found');
        }

        await promiseWithTimeout(
          Promise.resolve(
            onBusinessSelected(
              selectedServer,
              selectedBusiness,
              selectedAdAccount,
              pageIdToSend,
              selectedServerData.access_token,
              currentUser.id,
              resolveNames()
            )
          ),
          30000
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to open tools. Please try again.';
        setLocalError(msg);
        safeTimeout(() => setLocalError(''), 6000);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSaveServer = async () => {
    if (!selectedPage || !onSaveServer) return;
    setIsSaving(true);
    try {
      const pageIdToSend = selectedPage;

      const selectedServerData = servers.find(s => s.id === selectedServer);
      if (!selectedServerData) {
        throw new Error('Server not found');
      }

      await promiseWithTimeout(
        Promise.resolve(
          onSaveServer(
            selectedServer,
            selectedBusiness,
            selectedAdAccount,
            pageIdToSend,
            selectedServerData.access_token,
            currentUser.id,
            resolveNames()
          )
        ),
        30000
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save server. Please try again.';
      setLocalError(msg);
      safeTimeout(() => setLocalError(''), 6000);
    } finally {
      setIsSaving(false);
    }
  };

  // Updated back button handlers (use navigate callbacks when provided for URL-driven flow)
  const handleBackToBusiness = () => {
    if (onBackToBusiness) {
      onBackToBusiness();
      return;
    }
    setCurrentStep('business');
    setSelectedAdAccount('');
    setAdAccounts([]);
    setSelectedPage('');
    setFacebookPages([]);
  };

  const handleBackToAdAccounts = () => {
    if (onBackToAdAccounts) {
      onBackToAdAccounts();
      return;
    }
    setCurrentStep('adaccount');
    setSelectedPage('');
    setFacebookPages([]);
  };

  // Helper function to get step title and description
  const getStepInfo = () => {
    switch (currentStep) {
      case 'business':
        return {
          title: 'Select Business Manager Account',
          description: 'Choose the business account you want to manage ads for'
        };
      case 'adaccount':
        return {
          title: 'Select Ad Account',
          description: 'Choose the ad account you want to manage'
        };
      case 'page':
        return {
          title: 'Select Facebook Page',
          description: 'Choose the Facebook page you want to connect'
        };
      default:
        return { title: '', description: '' };
    }
  };

  const stepInfo = getStepInfo();

  // Business list shown in step 1: Personal first, then API businesses
  const displayBusinesses = [PERSONAL_BUSINESS_OPTION, ...businessAccounts];

  // Map API account_status (1/201 = active, string 'ACTIVE', else inactive) to display label
  const getAdAccountStatusLabel = (status: string | number): 'Active' | 'Inactive' => {
    const s = status;
    if (s === 1 || s === 201 || s === '1' || s === '201' || s === 'ACTIVE') return 'Active';
    return 'Inactive';
  };

  const getContinueButtonState = () => {
    if (currentStep === 'business') {
      return {
        isLoading: loadingAdAccounts,
        label: loadingAdAccounts ? 'Loading ad accounts...' : 'Continue to Ad Accounts',
      };
    }
    if (currentStep === 'adaccount') {
      return {
        isLoading: loadingPages,
        label: loadingPages ? 'Loading Facebook pages...' : 'Continue to Pages',
      };
    }
    // currentStep === 'page'
    return {
      isLoading: isProcessing,
      label: isProcessing ? 'Opening tools...' : 'Continue to Tools',
    };
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header: section, title, description */}
        <div className="mb-8">
          {/* Step Progress Indicator: 1 Server → 2 Business → 3 Ad Account → 4 Page → 5 Tools */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 mb-6 text-center">
            {/* 1. Server (completed - already selected to be here) */}
            <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900/40">
                1
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Server</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-600 flex-shrink-0" />
            {/* 2. Business */}
            <div className={`flex items-center space-x-1.5 ${currentStep === 'business' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${currentStep === 'business' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                2
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Business</span>
            </div>
            <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${currentStep === 'adaccount' || currentStep === 'page' ? 'text-green-500 dark:text-green-600' : 'text-gray-300 dark:text-gray-600'}`} />
            {/* 3. Ad Account */}
            <div className={`flex items-center space-x-1.5 ${currentStep === 'adaccount' ? 'text-blue-600 dark:text-blue-400' : currentStep === 'page' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${currentStep === 'adaccount' ? 'bg-blue-100 dark:bg-blue-900/40' : currentStep === 'page' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                3
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Ad Account</span>
            </div>
            <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${currentStep === 'page' ? 'text-green-500 dark:text-green-600' : 'text-gray-300 dark:text-gray-600'}`} />
            {/* 4. Page */}
            <div className={`flex items-center space-x-1.5 ${currentStep === 'page' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${currentStep === 'page' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                4
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Page</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            {/* 5. Tools (upcoming) */}
            <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-700">
                5
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Tools</span>
            </div>
          </div>

          {/* Title, description */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">{stepInfo.title}</h1>
          <p className="text-gray-600 dark:text-gray-300 text-center">{stepInfo.description}</p>

          {/* Back button - uses URL navigation when onBackToBusiness/onBackToAdAccounts provided */}
          <div className="flex flex-wrap items-center justify-center mt-4">
            <button
              onClick={
                currentStep === 'business'
                  ? onBackToServers
                  : currentStep === 'adaccount'
                    ? handleBackToBusiness
                    : handleBackToAdAccounts
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>
                {currentStep === 'business'
                  ? 'Back to Servers'
                  : currentStep === 'adaccount'
                    ? 'Back to Business Selection'
                    : 'Back to Ad Account Selection'}
              </span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {(error || localError) && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-800 dark:text-red-300 text-sm">{error || localError}</p>
            </div>
          </div>
        )}

        {/* Content based on current step */}
        {currentStep === 'business' && displayBusinesses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Loading businesses...</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Fetching your business and personal ad accounts.
            </p>
          </div>
        ) : (
          <>
            {/* Business Cards Grid - Only show on business step (Personal first, then API businesses) */}
            {currentStep === 'business' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {displayBusinesses.map((business) => {
                  const isPersonal = business.id === PERSONAL_BUSINESS_ID;
                  return (
                    <div
                      key={business.id}
                      onClick={() => handleBusinessCardClick(business.id)}
                      className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        selectedBusiness === business.id
                          ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isPersonal
                              ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30'
                              : 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30'
                          }`}>
                            {isPersonal ? (
                              <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{business.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{business.business_role}</p>
                          </div>
                        </div>
                        {selectedBusiness === business.id && (
                          <CheckCircle className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        {isPersonal ? (
                          <span className="text-gray-500 dark:text-gray-400 text-xs">Ad accounts not linked to a business</span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs" title={business.id}>Business ID: {business.id}</span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          business.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {business.status === 'active' ? 'Active' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ad Account Selection - Show when step is 'adaccount' */}
            {currentStep === 'adaccount' && (
              <>
                {loadingAdAccounts ? (
                  <div className="text-center py-12">
                    <Spinner size="lg" className="mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading ad accounts...</p>
                  </div>
                ) : adAccounts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Ad Accounts Found</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      This business doesn't have any ad accounts associated with it.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {adAccounts.map((adAccount) => (
                      <div
                        key={adAccount.id}
                        onClick={() => setSelectedAdAccount(adAccount.id)}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          selectedAdAccount === adAccount.id
                            ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg flex items-center justify-center">
                              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{adAccount.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{adAccount.currency}</p>
                            </div>
                          </div>
                          {selectedAdAccount === adAccount.id && (
                            <CheckCircle className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">Account ID: {adAccount.id}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            getAdAccountStatusLabel(adAccount.account_status) === 'Active'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {getAdAccountStatusLabel(adAccount.account_status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Facebook Page Selection - Show when step is 'page' */}
            {currentStep === 'page' && (
              <>
                {(loadingPages || (facebookPages.length === 0 && !hasAttemptedPageLoad)) ? (
                  <div className="text-center py-12">
                    <Spinner size="sm" className="mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading Facebook pages...</p>
                  </div>
                ) : facebookPages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Facebook Pages Found</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      You don't have access to any Facebook pages.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search pages by name or category..."
                        value={pageSearchQuery}
                        onChange={(e) => setPageSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      {pageSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPageSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {filteredPages.length === 0 ? (
                      <div className="text-center py-12">
                        <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No pages match your search</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Try a different name or category.
                        </p>
                        <button
                          type="button"
                          onClick={() => setPageSearchQuery('')}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          {paginatedPages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() => setSelectedPage(page.id)}
                        className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          selectedPage === page.id
                            ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {/* Cover photo - Facebook-style banner at top */}
                        <div className="relative w-full h-28 sm:h-32 bg-gray-200 dark:bg-gray-700">
                          {page.cover_url ? (
                            <img
                              src={page.cover_url}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover object-center"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700" />
                          )}
                        </div>

                        <div className="p-6 pt-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {page.picture_url ? (
                              <img 
                                src={page.picture_url} 
                                alt={page.name}
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{page.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{page.category}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {page.page_role && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                    {page.page_role}
                                  </span>
                                )}
                                {page.verification_status && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400">{page.verification_status}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedPage === page.id && (
                            <CheckCircle className="w-6 h-6 text-blue-500 dark:text-blue-400 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                              <span className="text-gray-600 dark:text-gray-400">
                                {page.followers_count ? `${page.followers_count.toLocaleString()} followers` : 'No followers data'}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            page.is_published
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {page.is_published ? 'Published' : 'Unpublished'}
                          </span>
                        </div>

                        {/* Additional page info */}
                        {(page.website || page.about) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                            {page.website && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <strong>Website:</strong> {page.website}
                              </p>
                            )}
                            {page.about && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                <strong>About:</strong> {page.about}
                              </p>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                    ))}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                            <button
                              type="button"
                              onClick={() => setPagePage((p) => Math.max(1, p - 1))}
                              disabled={currentPage <= 1}
                              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Page {currentPage} of {totalPages}
                              {filteredPages.length > 0 && (
                                <span className="text-gray-400 dark:text-gray-500 ml-1">
                                  ({filteredPages.length} {filteredPages.length === 1 ? 'page' : 'pages'})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPagePage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage >= totalPages}
                              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Continue / Save Buttons */}
            {((currentStep === 'business' && selectedBusiness) || 
              (currentStep === 'adaccount' && selectedAdAccount) ||
              (currentStep === 'page' && selectedPage)) && (
              <div className="flex flex-col items-center gap-3">
                {currentStep === 'page' && selectedPage ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {onSaveServer && (
                      <button
                        onClick={handleSaveServer}
                        disabled={isSaving || isProcessing}
                        className="order-2 sm:order-1 w-full sm:w-auto bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-8 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 border border-gray-300 dark:border-gray-600"
                      >
                        {isSaving ? (
                          <>
                            <Spinner size="xs" variant="default" />
                            <span>Saving server...</span>
                          </>
                        ) : (
                          <span>Save Server</span>
                        )}
                      </button>
                    )}
                    {(() => {
                      const { isLoading, label } = getContinueButtonState();
                      return (
                        <button
                          onClick={handleContinue}
                          disabled={isLoading || isSaving}
                          className="order-1 sm:order-2 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          {isLoading ? (
                            <>
                              <Spinner size="xs" variant="white" />
                              <span>{label}</span>
                            </>
                          ) : (
                            <>
                              <span>{label}</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                ) : (
                  (() => {
                    const { isLoading, label } = getContinueButtonState();
                    return (
                      <button
                        onClick={handleContinue}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <Spinner size="xs" variant="white" />
                            <span>{label}</span>
                          </>
                        ) : (
                          <>
                            <span>{label}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    );
                  })()
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessSelectionStep;