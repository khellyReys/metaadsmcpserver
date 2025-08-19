/**
 * MCP Tool for creating Facebook ad sets - ENGAGEMENT campaigns only
 * Retained params ONLY:
 * account_id, campaign_id, name, conversion_location, performance_goal, page_id, pixel_id,
 * cost_per_result_goal, bid_strategy, bid_amount, budget_type, daily_budget, lifetime_budget,
 * start_time, end_time, location, age_min, age_max, gender, detailed_targeting,
 * custom_audience_id, custom_event_type, status, application_id
 *
 * NOTE:
 * - Objective forced to OUTCOME_ENGAGEMENT
 * - Conversion locations per UI: message_destinations, on_your_ad, calls, website, app, instagram_or_facebook
 * - For ENGAGEMENT we DO NOT require pixel_id for website (not conversion-focused)
 */

const executeFunction = async ({
    // 1) Basics
    account_id,
    campaign_id,
    name = null, // default will be generated
    conversion_location = 'message_destinations',
    performance_goal = 'maximize_conversations',
    application_id,
    page_id, // keep REQUIRED (your UI shows this)
    pixel_id = null, // optional here (engagement)
  
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
  
    // 5) Event (rarely needed for ENGAGEMENT, but allowed to keep parity)
    custom_event_type = null,
  
    // 6) Status
    status = 'ACTIVE',
  }) => {
    // Node-only deps at execution time
    const { createClient } = await import('@supabase/supabase-js');
  
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  
    // ===== Config =====
    const ENGAGEMENT_CONFIG = {
      objective: 'OUTCOME_ENGAGEMENT',
      billingEvent: 'IMPRESSIONS',
      defaultName: (loc, goal) =>
        `Engagement ${loc} ${goal} ${new Date().toISOString().split('T')[0]}`,
  
      /**
       * Conversion locations (from your screenshot):
       * - message_destinations (Messenger/WhatsApp/Instagram)
       * - on_your_ad (engage directly on the ad: reactions, comments, shares, video views)
       * - calls
       * - website
       * - app
       * - instagram_or_facebook (profile/page)
       */
      conversionLocations: {
        message_destinations: {
          validPerformanceGoals: ['maximize_conversations', 'cost_per_conversation'],
          validOptimizationGoals: ['CONVERSATIONS'],
          requiredFields: ['page_id'],
          destinationType: 'MESSENGER',
        },
        on_your_ad: {
          validPerformanceGoals: [
            'post_engagement',
            'video_views',
            'thruplay',
            'two_second_continuous_video_views',
          ],
          // We’ll resolve to POST_ENGAGEMENT or video view goals below
          validOptimizationGoals: [
            'POST_ENGAGEMENT',
            'THRUPLAY',
            'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
          ],
          requiredFields: ['page_id'], // keeps parity with your UI
          // no destination_type needed
        },
        calls: {
          validPerformanceGoals: ['maximize_calls', 'cost_per_call'],
          validOptimizationGoals: ['QUALITY_CALL'],
          requiredFields: ['page_id'],
          // no destination_type needed (Meta derives call ads context)
        },
        website: {
          validPerformanceGoals: ['link_clicks', 'landing_page_views', 'post_engagement'],
          validOptimizationGoals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'POST_ENGAGEMENT'],
          requiredFields: [], // pixel NOT required for engagement
          destinationType: 'WEBSITE',
        },
        app: {
          validPerformanceGoals: ['post_engagement', 'link_clicks', 'landing_page_views'],
          validOptimizationGoals: ['POST_ENGAGEMENT', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
          requiredFields: ['application_id'],
          destinationType: 'APP',
        },
        instagram_or_facebook: {
          validPerformanceGoals: ['post_engagement', 'video_views', 'thruplay', 'two_second_continuous_video_views'],
          validOptimizationGoals: [
            'POST_ENGAGEMENT',
            'THRUPLAY',
            'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
          ],
          requiredFields: ['page_id'],
          // no destination_type needed
        },
      },
  
      // performance -> optimization mapping (ENGAGEMENT)
      performanceGoals: {
        // Messaging
        maximize_conversations: 'CONVERSATIONS',
        cost_per_conversation: 'CONVERSATIONS',
  
        // On-ad engagement
        post_engagement: 'POST_ENGAGEMENT',
        video_views: 'THRUPLAY', // default to THRUPLAY for general “video views”
        thruplay: 'THRUPLAY',
        two_second_continuous_video_views: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
  
        // Calls
        maximize_calls: 'QUALITY_CALL',
        cost_per_call: 'QUALITY_CALL',
  
        // Clicks / LVs
        link_clicks: 'LINK_CLICKS',
        landing_page_views: 'LANDING_PAGE_VIEWS',
      },
  
      // Locations (same map you used)
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
  
      if (location && ENGAGEMENT_CONFIG.locationMap[location]) {
        if (location !== 'worldwide') {
          targetingObj.geo_locations.countries = ENGAGEMENT_CONFIG.locationMap[location];
        }
      } else {
        targetingObj.geo_locations.countries = ['PH'];
      }
  
      if (age_min && age_min >= 13) targetingObj.age_min = age_min;
      if (age_max && age_max <= 65) targetingObj.age_max = age_max;
  
      if (gender && ENGAGEMENT_CONFIG.genderMap[gender]) {
        targetingObj.genders = ENGAGEMENT_CONFIG.genderMap[gender];
      }
  
      if (detailed_targeting === 'custom' && custom_audience_id) {
        targetingObj.custom_audiences = [custom_audience_id];
      }
  
      return targetingObj;
    };
  
    const buildPromotedObject = () => ({
      ...(page_id ? { page_id } : {}),
      ...(pixel_id ? { pixel_id } : {}), // optional for engagement
      ...(application_id ? { application_id } : {}),
      ...(custom_event_type ? { custom_event_type } : {}),
    });
  
    // ===== Main =====
    const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
    const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
    // Basic validation
    if (!account_id) return { error: 'Missing required parameter: account_id' };
    if (!campaign_id) return { error: 'Missing required parameter: campaign_id' };
    if (!page_id) return { error: 'Missing required parameter: page_id' };
  
    const locationConfig = ENGAGEMENT_CONFIG.conversionLocations[conversion_location];
    if (!locationConfig) {
      return {
        error: `Invalid conversion_location "${conversion_location}". Valid options: ${Object.keys(
          ENGAGEMENT_CONFIG.conversionLocations
        ).join(', ')}`,
      };
    }
  
    // performance goal
    if (!locationConfig.validPerformanceGoals.includes(performance_goal)) {
      return {
        error: `Invalid performance_goal "${performance_goal}" for conversion location "${conversion_location}". Valid options: ${locationConfig.validPerformanceGoals.join(
          ', '
        )}`,
      };
    }
  
    // per-location requireds
    for (const field of locationConfig.requiredFields) {
      if (field === 'page_id' && !page_id) {
        return { error: `page_id is required for conversion location "${conversion_location}"` };
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
  
      // Build request
      const adSetName = name || ENGAGEMENT_CONFIG.defaultName(conversion_location, performance_goal);
      const optimization_goal = ENGAGEMENT_CONFIG.performanceGoals[performance_goal];
      const builtTargeting = buildTargeting();
      const builtPromotedObject = buildPromotedObject();
  
      const url = `${baseUrl}/act_${account_id}/adsets`;
  
      const adSetParams = {
        name: adSetName,
        campaign_id,
        optimization_goal,
        billing_event: ENGAGEMENT_CONFIG.billingEvent,
        status,
        access_token: token,
      };
  
      // Destination type (only where the API expects it)
      if (locationConfig.destinationType) {
        adSetParams.destination_type = locationConfig.destinationType;
      }
  
      // CBO handling
      if (campaignInfo.cboEnabled) {
        // Campaign has budget; skip ad set budgets
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
  
      // Bidding — safest handling
      const normalizeBidStrategy = (v) => {
        const s = String(v || '').toLowerCase().replace(/\s+/g, '');
        if (s.includes('withbidcap') || s.includes('cap')) return 'LOWEST_COST_WITH_BID_CAP';
        if (s.includes('costcap')) return 'COST_CAP';
        if (s.includes('minroas') || s.includes('roas')) return 'LOWEST_COST_WITH_MIN_ROAS';
        if (s.includes('targetcost')) return 'TARGET_COST';
        // default to no-cap
        return 'LOWEST_COST_WITHOUT_CAP';
      };

      const strategy = normalizeBidStrategy(bid_strategy);

      // If NO-CAP: omit both bid_strategy and bid_amount entirely (let FB default to no-cap)
      if (strategy === 'LOWEST_COST_WITHOUT_CAP') {
        delete adSetParams.bid_strategy;
        delete adSetParams.bid_amount;
      } else {
        // Capped strategies require a positive bid_amount
        const pesosToCents = (v) => (v && v > 0 ? Math.round(v * 100) : null);
        const fromGoal = pesosToCents(cost_per_result_goal);
        const fromManual = pesosToCents(bid_amount);
        const chosen = fromGoal || fromManual;

        if (!chosen) {
          return {
            error: 'Bid amount required for the chosen bid_strategy.',
            details: {
              bid_strategy: strategy,
              hint: 'Provide a positive bid_amount (in pesos) or switch to Lowest cost (no cap).'
            }
          };
        }

        adSetParams.bid_strategy = strategy;
        adSetParams.bid_amount = String(chosen);
      }

      // Extra hardening: strip empty/zero bid_amount if it exists
      if (
        Object.prototype.hasOwnProperty.call(adSetParams, 'bid_amount') &&
        (adSetParams.bid_amount === '' || adSetParams.bid_amount === '0' || Number(adSetParams.bid_amount) <= 0)
      ) {
        delete adSetParams.bid_amount;
      }
  
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
          error: `Engagement ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
          details: errorData,
        };
      }
  
      const result = await response.json();
      return {
        success: true,
        adset: result,
        campaign_type: 'ENGAGEMENT',
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
        error: 'An error occurred while creating the engagement ad set.',
        details: error.message,
      };
    }
  };
  
  /**
   * Tool definition for ENGAGEMENT ad sets
   */
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create-ad-set-engagement',
        description:
          'Create a Facebook ad set for ENGAGEMENT campaigns with focused, UI-matching parameters.',
        parameters: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Ad account ID (without act_)' },
            campaign_id: { type: 'string', description: 'Parent campaign ID (OUTCOME_ENGAGEMENT)' },
            name: { type: 'string', description: 'Ad set name' },
  
            // Conversion locations (from your screenshot)
            conversion_location: {
              type: 'string',
              enum: [
                'message_destinations',
                'on_your_ad',
                'calls',
                'website',
                'app',
                'instagram_or_facebook',
              ],
              description: 'Where you want engagement to happen',
            },
  
            // Performance goals tailored to ENGAGEMENT
            performance_goal: {
              type: 'string',
              enum: [
                // Messaging
                'maximize_conversations',
                'cost_per_conversation',
                // On-ad engagement
                'post_engagement',
                'video_views',
                'thruplay',
                'two_second_continuous_video_views',
                // Calls
                'maximize_calls',
                'cost_per_call',
                // Clicks/LVs
                'link_clicks',
                'landing_page_views',
              ],
              description: 'How delivery optimizes within the chosen location',
            },
  
            page_id: { type: 'string', description: 'Facebook Page ID (required by your UI)' },
            pixel_id: { type: 'string', description: 'Optional pixel (not required for engagement)' },
  
            application_id: {
              type: 'string',
              description:
                'Facebook App ID (required when conversion_location is "app")',
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
            start_time: {
              type: 'string',
              description: 'Start time (ISO), required if lifetime_budget',
            },
            end_time: {
              type: 'string',
              description: 'End time (ISO), required if lifetime_budget',
            },
  
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
                'PURCHASE',
                'ADD_TO_CART',
                'INITIATE_CHECKOUT',
                'ADD_PAYMENT_INFO',
                'COMPLETE_REGISTRATION',
                'LEAD',
                'SUBSCRIBE',
                'START_TRIAL',
              ],
              description: 'Optional event note (not typically needed for ENGAGEMENT)',
            },
  
            status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Ad set status' },
          },
  
          // Keep page_id required (your UI expects it)
          required: [
            'account_id',
            'campaign_id',
            'conversion_location',
            'performance_goal',
            'page_id',
          ],
  
          // Conditional requirements (UI-level)
          allOf: [
            // App requires application_id
            {
              if: { properties: { conversion_location: { const: 'app' } } },
              then: { required: ['application_id'] }
            },
            // Messaging, calls, instagram_or_facebook all need page_id (already top-level required)
            {
              if: { properties: { conversion_location: { const: 'message_destinations' } } },
              then: { required: ['page_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'calls' } } },
              then: { required: ['page_id'] }
            },
            {
              if: { properties: { conversion_location: { const: 'instagram_or_facebook' } } },
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
  