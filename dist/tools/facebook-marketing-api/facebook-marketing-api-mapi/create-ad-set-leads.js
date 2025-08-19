/**
 * MCP Tool for creating Facebook ad sets - LEADS campaigns only
 * Retained params ONLY:
 * account_id, campaign_id, name, conversion_location, performance_goal, page_id, pixel_id,
 * cost_per_result_goal, bid_strategy, bid_amount, budget_type, daily_budget, lifetime_budget,
 * start_time, end_time, location, age_min, age_max, gender, detailed_targeting,
 * custom_audience_id, custom_event_type, status, application_id
 *
 * Objective is forced to OUTCOME_LEADS.
 */

const executeFunction = async ({
    // 1) Basics
    account_id,
    campaign_id,
    name = null, // default will be generated
    conversion_location = 'instant_forms',
    performance_goal = 'maximize_leads',
    application_id,
    page_id, // keep REQUIRED (UI always shows a Page selector)
    pixel_id = null,
  
    // 2) Cost & bidding
    cost_per_result_goal = null,
    bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
    bid_amount = 2.5,
  
    // 3) Budget & schedule
    budget_type = 'daily_budget',
    daily_budget = 500,
    lifetime_budget = null,
    start_time = null,
    end_time = null,
  
    // 4) Audience
    location = 'PH',
    age_min = 18,
    age_max = 65,
    gender = 'all',
    detailed_targeting = 'all',
    custom_audience_id = null,
  
    // 5) Conversion tracking / events
    // For website/app lead optimization we often use LEAD; leave configurable.
    custom_event_type = 'LEAD',
  
    // 6) Status
    status = 'ACTIVE',
  }) => {
    const { createClient } = await import('@supabase/supabase-js');
  
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  
    // ===== Config =====
    const LEADS_CONFIG = {
      objective: 'OUTCOME_LEADS',
      billingEvent: 'IMPRESSIONS',
      defaultName: (loc, goal) =>
        `Leads ${loc} ${goal} ${new Date().toISOString().split('T')[0]}`,
  
      /**
       * Conversion locations (from your screenshot):
       * - website_and_instant_forms
       * - website
       * - website_and_calls
       * - instant_forms
       * - messenger
       * - instant_forms_and_messenger
       * - instagram
       * - calls
       * - app
       */
      conversionLocations: {
        website_and_instant_forms: {
          validPerformanceGoals: ['maximize_leads', 'cost_per_lead'],
          // We may choose LEAD_GENERATION or OFFSITE_CONVERSIONS depending on intent;
          // API accepts either depending on ad format; we record both as "valid".
          validOptimizationGoals: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS'],
          requiredFields: ['page_id', 'pixel_id'],
          destinationType: 'WEBSITE',
        },
        website: {
          validPerformanceGoals: ['maximize_leads', 'cost_per_lead'],
          validOptimizationGoals: ['OFFSITE_CONVERSIONS'],
          requiredFields: ['pixel_id'],
          destinationType: 'WEBSITE',
        },
        website_and_calls: {
          validPerformanceGoals: ['maximize_leads', 'cost_per_lead', 'maximize_calls', 'cost_per_call'],
          validOptimizationGoals: ['OFFSITE_CONVERSIONS', 'QUALITY_CALL'],
          requiredFields: ['page_id', 'pixel_id'],
          destinationType: 'WEBSITE',
        },
        instant_forms: {
          validPerformanceGoals: ['maximize_leads', 'cost_per_lead'],
          validOptimizationGoals: ['LEAD_GENERATION'],
          requiredFields: ['page_id'],
          // no destination_type needed for forms
        },
        messenger: {
          validPerformanceGoals: ['maximize_conversations', 'cost_per_conversation'],
          validOptimizationGoals: ['CONVERSATIONS'],
          requiredFields: ['page_id'],
          destinationType: 'MESSENGER',
        },
        instant_forms_and_messenger: {
          validPerformanceGoals: [
            'maximize_leads',
            'cost_per_lead',
            'maximize_conversations',
            'cost_per_conversation',
          ],
          validOptimizationGoals: ['LEAD_GENERATION', 'CONVERSATIONS'],
          requiredFields: ['page_id'],
          // destination_type not required; mix of placements
        },
        instagram: {
          validPerformanceGoals: ['maximize_conversations', 'cost_per_conversation'],
          validOptimizationGoals: ['CONVERSATIONS'],
          requiredFields: ['page_id'], // IG must be connected to the Page
          // no destination_type required
        },
        calls: {
          validPerformanceGoals: ['maximize_calls', 'cost_per_call'],
          validOptimizationGoals: ['QUALITY_CALL'],
          requiredFields: ['page_id'],
        },
        app: {
          validPerformanceGoals: ['maximize_leads', 'cost_per_lead'],
          validOptimizationGoals: ['CONVERSIONS'],
          requiredFields: ['application_id'],
          destinationType: 'APP',
        },
      },
  
      // Base mapping; some goals adjust by location below.
      performanceGoals: {
        maximize_leads: 'LEAD_GENERATION',         // forms; for web/app we’ll override to OFFSITE_CONVERSIONS/CONVERSIONS
        cost_per_lead: 'LEAD_GENERATION',
        maximize_conversations: 'CONVERSATIONS',
        cost_per_conversation: 'CONVERSATIONS',
        maximize_calls: 'QUALITY_CALL',
        cost_per_call: 'QUALITY_CALL',
      },
  
      // Locations (same as your prior tools)
      locationMap: {
        PH: ['PH'], SG: ['SG'], MY: ['MY'], TH: ['TH'], VN: ['VN'], ID: ['ID'], IN: ['IN'], JP: ['JP'],
        KR: ['KR'], CN: ['CN'], HK: ['HK'], TW: ['TW'], AU: ['AU'], NZ: ['NZ'], BD: ['BD'], LK: ['LK'],
        MM: ['MM'], KH: ['KH'], LA: ['LA'], BN: ['BN'],
        US: ['US'], CA: ['CA'], MX: ['MX'], BR: ['BR'], AR: ['AR'], CL: ['CL'], CO: ['CO'], PE: ['PE'], VE: ['VE'], EC: ['EC'],
        GB: ['GB'], DE: ['DE'], FR: ['FR'], IT: ['IT'], ES: ['ES'], NL: ['NL'], BE: ['BE'], CH: ['CH'], AT: ['AT'], SE: ['SE'],
        NO: ['NO'], DK: ['DK'], FI: ['FI'], PL: ['PL'], RU: ['RU'], UA: ['UA'], TR: ['TR'], GR: ['GR'], PT: ['PT'], IE: ['IE'],
        CZ: ['CZ'], HU: ['HU'], RO: ['RO'], BG: ['BG'], HR: ['HR'], SI: ['SI'], SK: ['SK'], LT: ['LT'], LV: ['LV'], EE: ['EE'],
        AE: ['AE'], SA: ['SA'], IL: ['IL'], EG: ['EG'], ZA: ['ZA'], NG: ['NG'], KE: ['KE'], MA: ['MA'], GH: ['GH'], TN: ['TN'],
        JO: ['JO'], LB: ['LB'], KW: ['KW'], QA: ['QA'], BH: ['BH'], OM: ['OM'],
        ASEAN: ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'],
        SEA: ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'],
        APAC: ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ'],
        EU: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'PL', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'],
        EUROPE: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'],
        NORTH_AMERICA: ['US', 'CA'],
        LATIN_AMERICA: ['MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC'],
        MIDDLE_EAST: ['AE', 'SA', 'IL', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM'],
        GCC: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
        ENGLISH_SPEAKING: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'SG', 'PH', 'IN', 'ZA'],
        DEVELOPED_MARKETS: ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'AU', 'JP', 'KR', 'SG', 'HK'],
        EMERGING_MARKETS: ['PH', 'MY', 'TH', 'VN', 'ID', 'IN', 'CN', 'BR', 'MX', 'AR', 'TR', 'RU', 'ZA'],
        worldwide: null,
      },
  
      genderMap: { all: [1, 2], male: [1], female: [2] },
    };
  
    // ===== Helpers =====
    const convertPesosToCents = (pesos) => {
      if (!pesos || pesos <= 0) return null;
      return Math.round(pesos * 100);
    };
  
    const getUserFromAccount = async (accountId) => {
      const accountIdStr = String(accountId).trim();
      const { data, error } = await supabase
        .from('facebook_ad_accounts')
        .select('user_id, id, name')
        .eq('id', accountIdStr);
  
      if (error) throw new Error(`Account lookup failed: ${error.message}`);
      if (!data || data.length === 0) {
        throw new Error(`Ad account ${accountIdStr} not found in database.`);
      }
      const row = data[0];
      if (!row.user_id) {
        throw new Error(`Account ${accountIdStr} has no associated user_id.`);
      }
      return row.user_id;
    };
  
    const getFacebookToken = async (userId) => {
      const { data, error } = await supabase
        .from('users')
        .select('facebook_long_lived_token')
        .eq('id', userId)
        .single();
  
      if (error) throw new Error(`Supabase query failed: ${error.message}`);
      return data?.facebook_long_lived_token || null;
    };
  
    const getCampaignInfo = async (campaignId, token) => {
      const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
      const url = `https://graph.facebook.com/${API_VERSION}/${campaignId}?fields=objective,daily_budget,lifetime_budget&access_token=${token}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(`Campaign lookup failed: ${json.error.message}`);
      return {
        objective: json.objective,
        cboEnabled: !!(json.daily_budget || json.lifetime_budget),
      };
    };
  
    const buildTargeting = () => {
      const targetingObj = { geo_locations: {} };
  
      if (location && LEADS_CONFIG.locationMap[location]) {
        if (location !== 'worldwide') {
          targetingObj.geo_locations.countries = LEADS_CONFIG.locationMap[location];
        }
      } else {
        targetingObj.geo_locations.countries = ['PH'];
      }
  
      if (age_min && age_min >= 13) targetingObj.age_min = age_min;
      if (age_max && age_max <= 65) targetingObj.age_max = age_max;
  
      if (gender && LEADS_CONFIG.genderMap[gender]) {
        targetingObj.genders = LEADS_CONFIG.genderMap[gender];
      }
  
      if (detailed_targeting === 'custom' && custom_audience_id) {
        targetingObj.custom_audiences = [custom_audience_id];
      }
  
      return targetingObj;
    };
  
    const buildPromotedObject = () => ({
      ...(page_id ? { page_id } : {}),
      ...(pixel_id ? { pixel_id } : {}),
      ...(application_id ? { application_id } : {}),
      ...(custom_event_type ? { custom_event_type } : {}),
    });
  
    // Location-aware optimization for lead goals
    const resolveOptimizationGoal = (loc, perfGoal) => {
      // Non-lead goals map 1:1
      if (perfGoal === 'maximize_conversations' || perfGoal === 'cost_per_conversation')
        return 'CONVERSATIONS';
      if (perfGoal === 'maximize_calls' || perfGoal === 'cost_per_call')
        return 'QUALITY_CALL';
  
      // Lead goals depend on location
      if (loc === 'instant_forms' || loc === 'instant_forms_and_messenger')
        return 'LEAD_GENERATION';
  
      if (loc === 'website' || loc === 'website_and_calls' || loc === 'website_and_instant_forms')
        return 'OFFSITE_CONVERSIONS';
  
      if (loc === 'app') return 'CONVERSIONS';
  
      if (loc === 'messenger' || loc === 'instagram') return 'CONVERSATIONS';
  
      // Fallback: lead gen
      return LEADS_CONFIG.performanceGoals[perfGoal] || 'LEAD_GENERATION';
    };
  
    // ===== Main =====
    const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
    const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
    // Basic validation
    if (!account_id) return { error: 'Missing required parameter: account_id' };
    if (!campaign_id) return { error: 'Missing required parameter: campaign_id' };
    if (!page_id) return { error: 'Missing required parameter: page_id' };
  
    const locationConfig = LEADS_CONFIG.conversionLocations[conversion_location];
    if (!locationConfig) {
      return {
        error: `Invalid conversion_location "${conversion_location}". Valid options: ${Object.keys(
          LEADS_CONFIG.conversionLocations
        ).join(', ')}`,
      };
    }
  
    if (!locationConfig.validPerformanceGoals.includes(performance_goal)) {
      return {
        error: `Invalid performance_goal "${performance_goal}" for conversion location "${conversion_location}". Valid options: ${locationConfig.validPerformanceGoals.join(
          ', '
        )}`,
      };
    }
  
    // Per-location requireds
    for (const field of locationConfig.requiredFields) {
      if (field === 'page_id' && !page_id) {
        return { error: `page_id is required for conversion location "${conversion_location}"` };
      }
      if (field === 'pixel_id' && !pixel_id) {
        return { error: `pixel_id is required for conversion location "${conversion_location}"` };
      }
      if (field === 'application_id' && !application_id) {
        return { error: `application_id is required for conversion location "${conversion_location}"` };
      }
    }
  
    // Budget validation
    if (budget_type === 'lifetime_budget') {
      if (!lifetime_budget || lifetime_budget <= 0) {
        return { error: 'lifetime_budget is required when budget_type is "lifetime_budget"' };
      }
      if (!start_time || !end_time) {
        return { error: 'start_time and end_time are required when using lifetime_budget' };
      }
    } else if (budget_type === 'daily_budget') {
      if (!daily_budget || daily_budget <= 0) {
        return { error: 'daily_budget is required when budget_type is "daily_budget"' };
      }
    } else {
      return { error: 'budget_type must be either "daily_budget" or "lifetime_budget"' };
    }
  
    try {
      const userId = await getUserFromAccount(account_id);
      const token = await getFacebookToken(userId);
      if (!token) {
        return {
          error: 'No Facebook access token found for the user who owns this ad account',
          details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`,
        };
      }
  
      const campaignInfo = await getCampaignInfo(campaign_id, token);
  
      const adSetName = name || LEADS_CONFIG.defaultName(conversion_location, performance_goal);
      const optimization_goal = resolveOptimizationGoal(conversion_location, performance_goal);
      const builtTargeting = buildTargeting();
      const builtPromotedObject = buildPromotedObject();
  
      const url = `${baseUrl}/act_${account_id}/adsets`;
  
      const adSetParams = {
        name: adSetName,
        campaign_id,
        optimization_goal,
        billing_event: LEADS_CONFIG.billingEvent,
        status,
        access_token: token,
      };
  
      if (locationConfig.destinationType) {
        adSetParams.destination_type = locationConfig.destinationType;
      }
  
      // CBO handling
      if (campaignInfo.cboEnabled) {
        // campaign-level budget → no ad set budget
      } else {
        if (budget_type === 'lifetime_budget') {
          const lifetimeBudgetCents = convertPesosToCents(lifetime_budget);
          adSetParams.lifetime_budget = String(lifetimeBudgetCents);
          adSetParams.start_time = new Date(start_time).toISOString();
          adSetParams.end_time = new Date(end_time).toISOString();
        } else {
          const dailyBudgetCents = convertPesosToCents(daily_budget);
          adSetParams.daily_budget = String(dailyBudgetCents);
        }
      }
  
      // Bidding
      if (cost_per_result_goal && cost_per_result_goal > 0) {
        const cprCents = convertPesosToCents(cost_per_result_goal);
        adSetParams.bid_amount = String(cprCents);
      } else if (bid_amount && bid_amount > 0) {
        const bidCents = convertPesosToCents(bid_amount);
        adSetParams.bid_amount = String(bidCents);
      }
      adSetParams.bid_strategy = bid_strategy;
  
      // Targeting / promoted_object
      adSetParams.targeting = JSON.stringify(builtTargeting);
      adSetParams.promoted_object = JSON.stringify(builtPromotedObject);
  
      // Strip null/empty
      for (const [k, v] of Object.entries(adSetParams)) {
        if (v == null || (typeof v === 'string' && v.trim() === '')) {
          delete adSetParams[k];
        }
      }
  
      const body = new URLSearchParams(adSetParams);
  
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: `Leads ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
          details: errorData,
        };
      }
  
      const result = await response.json();
      return {
        success: true,
        adset: result,
        campaign_type: 'LEADS',
        configuration: {
          account_id,
          campaign_id,
          name: adSetName,
          conversion_location,
          performance_goal,
          optimization_goal,
          page_id,
          pixel_id,
          cost_per_result_goal,
          bid_strategy,
          bid_amount,
          budget_type,
          daily_budget,
          lifetime_budget,
          start_time,
          end_time,
          location,
          age_min,
          age_max,
          gender,
          detailed_targeting,
          custom_audience_id,
          custom_event_type,
          status,
          campaign_cbo_enabled: campaignInfo.cboEnabled,
        },
      };
    } catch (error) {
      return {
        error: 'An error occurred while creating the leads ad set.',
        details: error.message,
      };
    }
  };
  
  /**
   * Tool configuration for creating Facebook leads ad sets
   * (Only exposes the parameters you listed.)
   */
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create-ad-set-leads',
        description:
          'Create a Facebook ad set for LEADS campaigns with conversion-location-aware validation.',
        parameters: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Ad account ID (without act_)' },
            campaign_id: { type: 'string', description: 'Parent campaign ID (OUTCOME_LEADS)' },
            name: { type: 'string', description: 'Ad set name' },
  
            // Conversion locations (from your screenshot)
            conversion_location: {
              type: 'string',
              enum: [
                'website_and_instant_forms',
                'website',
                'website_and_calls',
                'instant_forms',
                'messenger',
                'instant_forms_and_messenger',
                'instagram',
                'calls',
                'app',
              ],
              description: 'Where you want to generate leads',
            },
  
            // Performance goals tailored to LEADS
            performance_goal: {
              type: 'string',
              enum: [
                'maximize_leads',
                'cost_per_lead',
                'maximize_conversations',
                'cost_per_conversation',
                'maximize_calls',
                'cost_per_call',
              ],
              description: 'How delivery optimizes within the chosen location',
            },
  
            page_id: { type: 'string', description: 'Facebook Page ID (required by your UI)' },
            pixel_id: { type: 'string', description: 'Pixel ID (required for website-related options)' },
  
            application_id: {
              type: 'string',
              description: 'Facebook App ID (required when conversion_location is "app")',
            },
  
            cost_per_result_goal: {
              type: 'number',
              description: 'Optional cost per result goal in pesos',
            },
            bid_strategy: {
              type: 'string',
              enum: [
                'LOWEST_COST_WITHOUT_CAP',
                'LOWEST_COST_WITH_BID_CAP',
                'COST_CAP',
                'LOWEST_COST_WITH_MIN_ROAS',
              ],
              description: 'Bid strategy',
            },
            bid_amount: {
              type: 'number',
              description: 'Manual bid in pesos (used if cost_per_result_goal not set)',
            },
  
            budget_type: {
              type: 'string',
              enum: ['daily_budget', 'lifetime_budget'],
              description: 'Budget type',
            },
            daily_budget: { type: 'number', description: 'Daily budget in pesos' },
            lifetime_budget: { type: 'number', description: 'Lifetime budget in pesos' },
            start_time: { type: 'string', description: 'Start time (ISO), required if lifetime_budget' },
            end_time: { type: 'string', description: 'End time (ISO), required if lifetime_budget' },
  
            location: {
              type: 'string',
              enum: [
                'PH','SG','MY','TH','VN','ID','IN','JP','KR','CN','HK','TW','AU','NZ','BD','LK','MM','KH','LA','BN',
                'US','CA','MX','BR','AR','CL','CO','PE','VE','EC',
                'GB','DE','FR','IT','ES','NL','BE','CH','AT','SE','NO','DK','FI','PL','RU','UA','TR','GR','PT','IE','CZ','HU','RO','BG','HR','SI','SK','LT','LV','EE',
                'AE','SA','IL','EG','ZA','NG','KE','MA','GH','TN','JO','LB','KW','QA','BH','OM',
                'ASEAN','SEA','APAC','EU','EUROPE','NORTH_AMERICA','LATIN_AMERICA','MIDDLE_EAST','GCC','ENGLISH_SPEAKING','DEVELOPED_MARKETS','EMERGING_MARKETS',
                'worldwide'
              ],
              description: 'Country/region selection',
            },
            age_min: { type: 'integer', minimum: 13, maximum: 65, description: 'Min age' },
            age_max: { type: 'integer', minimum: 13, maximum: 65, description: 'Max age' },
            gender: { type: 'string', enum: ['all', 'male', 'female'], description: 'Gender' },
            detailed_targeting: {
              type: 'string',
              enum: ['all', 'custom'],
              description: 'Use broad (all) or a custom audience',
            },
            custom_audience_id: {
              type: 'string',
              description: 'Custom audience ID (required if detailed_targeting = custom)',
            },
  
            custom_event_type: {
              type: 'string',
              enum: [
                'LEAD',
                'COMPLETE_REGISTRATION',
                'SUBSCRIBE',
                'START_TRIAL',
                'ADD_PAYMENT_INFO',
                'INITIATE_CHECKOUT',
                'ADD_TO_CART',
                'PURCHASE',
              ],
              description: 'Event to optimize for on website/app contexts (default: LEAD)',
            },
  
            status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Ad set status' },
          },
  
          // Keep page_id required (UI shows it)
          required: [
            'account_id',
            'campaign_id',
            'conversion_location',
            'performance_goal',
            'page_id',
          ],
  
          // Conditional UI requirements
          allOf: [
            // Website paths require pixel
            {
              if: { properties: { conversion_location: { const: 'website' } } },
              then: { required: ['pixel_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'website_and_calls' } } },
              then: { required: ['pixel_id', 'page_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'website_and_instant_forms' } } },
              then: { required: ['pixel_id', 'page_id'] }
            },
  
            // App requires application_id
            {
              if: { properties: { conversion_location: { const: 'app' } } },
              then: { required: ['application_id'] }
            },
  
            // Messaging / Instagram / Calls all require page_id (already top-level required)
            {
              if: { properties: { conversion_location: { const: 'messenger' } } },
              then: { required: ['page_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'instagram' } } },
              then: { required: ['page_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'calls' } } },
              then: { required: ['page_id'] }
            },
  
            // If detailed_targeting is custom, require custom_audience_id
            {
              if: { properties: { detailed_targeting: { const: 'custom' } } },
              then: { required: ['custom_audience_id'] }
            },
  
            // If budget_type is lifetime, require lifetime_budget, start_time, end_time
            {
              if: { properties: { budget_type: { const: 'lifetime_budget' } } },
              then: { required: ['lifetime_budget', 'start_time', 'end_time'] }
            }
          ]
        }
      }
    }
  };
  
  export { apiTool };
  