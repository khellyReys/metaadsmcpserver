/**
 * MCP Tool for creating Facebook ad sets – APP PROMOTION campaigns only
 * Retained params ONLY:
 * account_id, campaign_id, name, conversion_location, performance_goal, page_id, pixel_id,
 * cost_per_result_goal, bid_strategy, bid_amount, budget_type, daily_budget, lifetime_budget,
 * start_time, end_time, location, age_min, age_max, gender, detailed_targeting,
 * custom_audience_id, custom_event_type, status, application_id,
 * mobile_app_store, object_store_url, app_country
 *
 * Objective is forced to OUTCOME_APP_PROMOTION.
 */

const executeFunction = async ({
  // 1) Basics
  account_id,
  campaign_id,
  name = null,
  conversion_location = 'app', // primary for app promotion
  performance_goal = 'app_installs',
  application_id,                              // REQUIRED
  mobile_app_store = 'GOOGLE_PLAY',            // 'GOOGLE_PLAY' | 'IOS_APP_STORE'
  object_store_url = null,                     // e.g., Play/App Store URL
  app_country = null,                          // optional: store search scoping

  page_id = null,                              // optional for app promotion
  pixel_id = null,                             // optional; required only for app_and_website

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

  // 5) Optional note (not typically needed for app promo)
  custom_event_type = null,

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
  const APP_PROMO_CONFIG = {
    objective: 'OUTCOME_APP_PROMOTION',
    billingEvent: 'IMPRESSIONS',
    defaultName: (loc, goal) =>
      `AppPromo ${loc} ${goal} ${new Date().toISOString().split('T')[0]}`,

    /**
     * Conversion locations (kept tight for app flows)
     * - app: send people to install/open your app (primary)
     * - app_and_website: (optional) dual destinations; requires pixel for website side
     */
    conversionLocations: {
      app: {
        validPerformanceGoals: [
          'app_installs',
          'in_app_events',
          'value',
          'link_clicks',
          'landing_page_views',
          'impressions',
          'reach',
          'daily_unique_reach',
        ],
        validOptimizationGoals: [
          'APP_INSTALLS',
          'CONVERSIONS',            // for in-app events
          'VALUE',
          'LINK_CLICKS',
          'LANDING_PAGE_VIEWS',
          'IMPRESSIONS',
          'REACH',
        ],
        requiredFields: ['application_id'],
        destinationType: 'APP',
      },
      app_and_website: {
        validPerformanceGoals: [
          'app_installs',
          'in_app_events',
          'value',
          'link_clicks',
          'landing_page_views',
        ],
        validOptimizationGoals: [
          'APP_INSTALLS',
          'CONVERSIONS',            // in-app events
          'VALUE',
          'LINK_CLICKS',
          'LANDING_PAGE_VIEWS',
        ],
        requiredFields: ['application_id', 'pixel_id'],
        // destination_type not strictly required for combos; omit
      },
    },

    // Performance goal → optimization_goal mapping
    performanceGoals: {
      app_installs: 'APP_INSTALLS',
      in_app_events: 'CONVERSIONS',           // optimize for app events
      value: 'VALUE',
      link_clicks: 'LINK_CLICKS',
      landing_page_views: 'LANDING_PAGE_VIEWS',
      impressions: 'IMPRESSIONS',
      reach: 'REACH',
      daily_unique_reach: 'REACH',
    },

    // Locations (same as your other tools)
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
      ASEAN: ['PH','SG','MY','TH','VN','ID','MM','KH','LA','BN'],
      SEA: ['PH','SG','MY','TH','VN','ID','MM','KH','LA','BN'],
      APAC: ['PH','SG','MY','TH','VN','ID','IN','JP','KR','CN','HK','TW','AU','NZ'],
      EU: ['DE','FR','IT','ES','NL','BE','AT','SE','DK','FI','PL','GR','PT','IE','CZ','HU','RO','BG','HR','SI','SK','LT','LV','EE'],
      EUROPE: ['GB','DE','FR','IT','ES','NL','BE','CH','AT','SE','NO','DK','FI','PL','RU','UA','TR','GR','PT','IE','CZ','HU','RO','BG','HR','SI','SK','LT','LV','EE'],
      NORTH_AMERICA: ['US','CA'],
      LATIN_AMERICA: ['MX','BR','AR','CL','CO','PE','VE','EC'],
      MIDDLE_EAST: ['AE','SA','IL','JO','LB','KW','QA','BH','OM'],
      GCC: ['AE','SA','KW','QA','BH','OM'],
      ENGLISH_SPEAKING: ['US','GB','CA','AU','NZ','IE','SG','PH','IN','ZA'],
      DEVELOPED_MARKETS: ['US','GB','DE','FR','IT','ES','NL','CA','AU','JP','KR','SG','HK'],
      EMERGING_MARKETS: ['PH','MY','TH','VN','ID','IN','CN','BR','MX','AR','TR','RU','ZA'],
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

    if (location && APP_PROMO_CONFIG.locationMap[location]) {
      if (location !== 'worldwide') {
        targetingObj.geo_locations.countries = APP_PROMO_CONFIG.locationMap[location];
      }
    } else {
      targetingObj.geo_locations.countries = ['PH'];
    }

    if (age_min && age_min >= 13) targetingObj.age_min = age_min;
    if (age_max && age_max <= 65) targetingObj.age_max = age_max;

    if (gender && APP_PROMO_CONFIG.genderMap[gender]) {
      targetingObj.genders = APP_PROMO_CONFIG.genderMap[gender];
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
    ...(object_store_url ? { object_store_url } : {}),
    ...(custom_event_type ? { custom_event_type } : {}),
  });

  const resolveOptimizationGoal = (loc, perfGoal) => {
    // Straight mapping
    if (perfGoal === 'app_installs') return 'APP_INSTALLS';
    if (perfGoal === 'in_app_events') return 'CONVERSIONS';
    if (perfGoal === 'value') return 'VALUE';
    if (perfGoal === 'link_clicks') return 'LINK_CLICKS';
    if (perfGoal === 'landing_page_views') return 'LANDING_PAGE_VIEWS';
    if (perfGoal === 'impressions') return 'IMPRESSIONS';
    if (perfGoal === 'reach' || perfGoal === 'daily_unique_reach') return 'REACH';

    // Fallback
    return APP_PROMO_CONFIG.performanceGoals[perfGoal] || 'APP_INSTALLS';
  };

  // ===== Main =====
  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;

  // Basic validation
  if (!account_id) return { error: 'Missing required parameter: account_id' };
  if (!campaign_id) return { error: 'Missing required parameter: campaign_id' };
  if (!application_id) return { error: 'Missing required parameter: application_id' };

  const locationConfig = APP_PROMO_CONFIG.conversionLocations[conversion_location];
  if (!locationConfig) {
    return {
      error: `Invalid conversion_location "${conversion_location}". Valid options: ${Object.keys(
        APP_PROMO_CONFIG.conversionLocations
      ).join(', ')}`,
    };
  }

  // performance goal sanity
  if (!locationConfig.validPerformanceGoals.includes(performance_goal)) {
    return {
      error: `Invalid performance_goal "${performance_goal}" for conversion location "${conversion_location}". Valid options: ${locationConfig.validPerformanceGoals.join(
        ', '
      )}`,
    };
  }

  // per-location requireds
  for (const field of locationConfig.requiredFields) {
    if (field === 'application_id' && !application_id) {
      return { error: `application_id is required for conversion location "${conversion_location}"` };
    }
    if (field === 'pixel_id' && !pixel_id) {
      return { error: `pixel_id is required for conversion location "${conversion_location}"` };
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

    const adSetName = name || APP_PROMO_CONFIG.defaultName(conversion_location, performance_goal);
    const optimization_goal = resolveOptimizationGoal(conversion_location, performance_goal);
    const builtTargeting = buildTargeting();
    const builtPromotedObject = buildPromotedObject();

    const url = `${baseUrl}/act_${account_id}/adsets`;

    const adSetParams = {
      name: adSetName,
      campaign_id,
      optimization_goal,
      billing_event: APP_PROMO_CONFIG.billingEvent,
      status,
      access_token: token,
      // App-specific hints (not Graph params but useful to echo)
      _mobile_app_store: mobile_app_store,
      _app_country: app_country || undefined,
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
      // Helpful hint for common app-store wiring problems
      if (errorData?.error?.code === 100 && /application/i.test(errorData?.error?.message || '')) {
        errorData.hint = 'Ensure application_id is valid and, for APP_INSTALLS, include a correct object_store_url.';
      }
      return {
        error: `App promotion ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData,
      };
    }

    const result = await response.json();
    return {
      success: true,
      adset: result,
      campaign_type: 'APP_PROMOTION',
      configuration: {
        account_id,
        campaign_id,
        name: adSetName,
        conversion_location,
        performance_goal,
        optimization_goal,
        application_id,
        mobile_app_store,
        object_store_url,
        app_country,
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
      error: 'An error occurred while creating the app promotion ad set.',
      details: error.message,
    };
  }
};

/**
 * Tool configuration for creating Facebook app promotion ad sets
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create-ad-set-app-promotion',
      description:
        'Create a Facebook ad set for APP PROMOTION campaigns with app-store-aware validation.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'Ad account ID (without act_)' },
          campaign_id: { type: 'string', description: 'Parent campaign ID (OUTCOME_APP_PROMOTION)' },
          name: { type: 'string', description: 'Ad set name' },

          // Conversion locations
          conversion_location: {
            type: 'string',
            enum: ['app', 'app_and_website'],
            description: 'Where you want to promote the app',
          },

          // Performance goals tailored to App Promotion
          performance_goal: {
            type: 'string',
            enum: [
              'app_installs',
              'in_app_events',
              'value',
              'link_clicks',
              'landing_page_views',
              'impressions',
              'reach',
              'daily_unique_reach',
            ],
            description: 'How delivery optimizes for app promotion',
          },

          // App wiring
          application_id: { type: 'string', description: 'Facebook App ID (required)' },
          mobile_app_store: {
            type: 'string',
            enum: ['GOOGLE_PLAY', 'IOS_APP_STORE'],
            description: 'Which store your app is in',
          },
          object_store_url: {
            type: 'string',
            description: 'Exact Play/App Store URL (recommended for APP_INSTALLS)',
          },
          app_country: {
            type: 'string',
            description: 'Country code for store discovery (optional)',
          },

          // Optional page/pixel
          page_id: { type: 'string', description: 'Facebook Page ID (optional in app promo)' },
          pixel_id: { type: 'string', description: 'Pixel ID (required if conversion_location = app_and_website)' },

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
              'PURCHASE','ADD_TO_CART','INITIATE_CHECKOUT','ADD_PAYMENT_INFO',
              'COMPLETE_REGISTRATION','LEAD','SUBSCRIBE','START_TRIAL'
            ],
            description: 'Optional note; not typically required for app promo',
          },

          status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Ad set status' },
        },

        // Required (lighter than other objectives; page_id NOT required)
        required: ['account_id', 'campaign_id', 'conversion_location', 'performance_goal', 'application_id'],

        // Conditional UI requirements
        allOf: [
          {
            if: { properties: { conversion_location: { const: 'app_and_website' } } },
            then: { required: ['pixel_id'] }
          },
          {
            if: { properties: { budget_type: { const: 'lifetime_budget' } } },
            then: { required: ['lifetime_budget', 'start_time', 'end_time'] }
          },
          {
            if: { properties: { performance_goal: { const: 'app_installs' } } },
            then: { required: ['application_id'] } // already required; kept explicit
          }
        ]
      }
    }
  }
};

export { apiTool };
