/**
 * MCP Tool for creating Facebook ad sets - SALES campaigns only
 * Retained params ONLY:
 * account_id, campaign_id, name, conversion_location, performance_goal, page_id, pixel_id,
 * cost_per_result_goal, bid_strategy, bid_amount, budget_type, daily_budget, lifetime_budget,
 * start_time, end_time, location, age_min, age_max, gender, detailed_targeting,
 * custom_audience_id, custom_event_type, status
 */

const executeFunction = async ({
    // 1) Basics
    account_id,
    campaign_id,
    name = null, // default will be generated
    conversion_location = 'website',
    performance_goal = 'maximize_conversions',
    application_id,
    page_id, // REQUIRED (UI always shows it)
    pixel_id = null,
  
    // 2) Cost & bidding
    cost_per_result_goal = null,
    bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
    bid_amount = null,
  
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
  
    // 5) Conversion tracking
    custom_event_type = 'PURCHASE',
  
    // 6) Status
    status = 'ACTIVE',
  }) => {
    // Node-only deps at execution time
    const { createClient } = await import('@supabase/supabase-js');
  
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  
    // ===== Config =====
    const SALES_CONFIG = {
      objective: 'OUTCOME_SALES',
      billingEvent: 'IMPRESSIONS',
      defaultName: (loc, goal) =>
        `Sales ${loc} ${goal} ${new Date().toISOString().split('T')[0]}`,
  
      // Conversion locations
      conversionLocations: {
        website: {
          validPerformanceGoals: [
            'maximize_conversions',
            'maximize_conversion_value',
            'cost_per_conversion',
          ],
          validOptimizationGoals: ['OFFSITE_CONVERSIONS', 'CONVERSIONS', 'VALUE'],
          requiredFields: ['pixel_id'],
          destinationType: 'WEBSITE',
        },
        app: {
          validPerformanceGoals: [
            'maximize_conversions',
            'maximize_conversion_value',
            'cost_per_conversion',
          ],
          validOptimizationGoals: ['CONVERSIONS', 'VALUE'],
          requiredFields: ['application_id'], // note: not exposed as param; validated only if ever needed
          destinationType: 'APP',
        },
        website_and_app: {
          validPerformanceGoals: [
            'maximize_conversions',
            'maximize_conversion_value',
          ],
          validOptimizationGoals: ['CONVERSIONS', 'VALUE'],
          requiredFields: ['pixel_id', 'application_id'], // app id not exposed; generally avoid this mode unless you handle it upstream
          destinationType: 'WEBSITE',
        },
        message_destinations: {
          validPerformanceGoals: ['maximize_conversations', 'cost_per_conversation'],
          validOptimizationGoals: ['CONVERSATIONS', 'CONVERSIONS'],
          requiredFields: ['page_id'],
          destinationType: 'MESSENGER',
        },
        calls: {
          validPerformanceGoals: ['maximize_calls', 'cost_per_call'],
          validOptimizationGoals: ['QUALITY_CALL'],
          requiredFields: ['page_id'],
          destinationType: 'WEBSITE',
        },
        website_and_store: {
          validPerformanceGoals: [
            'maximize_conversions',
            'maximize_conversion_value',
          ],
          validOptimizationGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
          requiredFields: ['pixel_id'],
          destinationType: 'WEBSITE',
        },
        website_and_calls: {
          validPerformanceGoals: ['maximize_conversions', 'maximize_calls'],
          validOptimizationGoals: ['OFFSITE_CONVERSIONS', 'QUALITY_CALL'],
          requiredFields: ['pixel_id', 'page_id'],
          destinationType: 'WEBSITE',
        },
      },
  
      // performance -> optimization mapping
      performanceGoals: {
        maximize_conversions: 'OFFSITE_CONVERSIONS',
        maximize_conversion_value: 'VALUE',
        cost_per_conversion: 'OFFSITE_CONVERSIONS',
        maximize_conversations: 'CONVERSATIONS',
        cost_per_conversation: 'CONVERSATIONS',
        maximize_calls: 'QUALITY_CALL',
        cost_per_call: 'QUALITY_CALL',
      },
  
      // Locations (same as before)
      locationMap: {
        // APAC
        PH: ['PH'], SG: ['SG'], MY: ['MY'], TH: ['TH'], VN: ['VN'], ID: ['ID'], IN: ['IN'], JP: ['JP'],
        KR: ['KR'], CN: ['CN'], HK: ['HK'], TW: ['TW'], AU: ['AU'], NZ: ['NZ'], BD: ['BD'], LK: ['LK'],
        MM: ['MM'], KH: ['KH'], LA: ['LA'], BN: ['BN'],
        // Americas
        US: ['US'], CA: ['CA'], MX: ['MX'], BR: ['BR'], AR: ['AR'], CL: ['CL'], CO: ['CO'], PE: ['PE'], VE: ['VE'], EC: ['EC'],
        // Europe
        GB: ['GB'], DE: ['DE'], FR: ['FR'], IT: ['IT'], ES: ['ES'], NL: ['NL'], BE: ['BE'], CH: ['CH'], AT: ['AT'], SE: ['SE'],
        NO: ['NO'], DK: ['DK'], FI: ['FI'], PL: ['PL'], RU: ['RU'], UA: ['UA'], TR: ['TR'], GR: ['GR'], PT: ['PT'], IE: ['IE'],
        CZ: ['CZ'], HU: ['HU'], RO: ['RO'], BG: ['BG'], HR: ['HR'], SI: ['SI'], SK: ['SK'], LT: ['LT'], LV: ['LV'], EE: ['EE'],
        // MEA
        AE: ['AE'], SA: ['SA'], IL: ['IL'], EG: ['EG'], ZA: ['ZA'], NG: ['NG'], KE: ['KE'], MA: ['MA'], GH: ['GH'], TN: ['TN'],
        JO: ['JO'], LB: ['LB'], KW: ['KW'], QA: ['QA'], BH: ['BH'], OM: ['OM'],
        // Regions
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
        // Special
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
      return { objective: json.objective, cboEnabled: !!(json.daily_budget || json.lifetime_budget) };
    };
  
    const buildTargeting = () => {
      const targetingObj = { geo_locations: {} };
  
      if (location && SALES_CONFIG.locationMap[location]) {
        if (location !== 'worldwide') {
          targetingObj.geo_locations.countries = SALES_CONFIG.locationMap[location];
        }
      } else {
        targetingObj.geo_locations.countries = ['PH'];
      }
  
      if (age_min && age_min >= 13) targetingObj.age_min = age_min;
      if (age_max && age_max <= 65) targetingObj.age_max = age_max;
  
      if (gender && SALES_CONFIG.genderMap[gender]) {
        targetingObj.genders = SALES_CONFIG.genderMap[gender];
      }
  
      if (detailed_targeting === 'custom' && custom_audience_id) {
        targetingObj.custom_audiences = [custom_audience_id];
      }
  
      return targetingObj;
    };
  
    // Awareness-style: always include page_id if provided; include pixel/custom_event when present
    const buildPromotedObject = () => ({
      ...(page_id ? { page_id } : {}),
      ...(pixel_id ? { pixel_id } : {}),
      ...(application_id ? { application_id } : {}),
      ...(custom_event_type ? { custom_event_type } : {}),
    });
  
    // ===== Main =====
    const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
    const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
    // Basic validation per your retained params
    if (!account_id) return { error: 'Missing required parameter: account_id' };
    if (!campaign_id) return { error: 'Missing required parameter: campaign_id' };
    if (!page_id) return { error: 'Missing required parameter: page_id' };
  
    const locationConfig = SALES_CONFIG.conversionLocations[conversion_location];
    if (!locationConfig) {
      return {
        error: `Invalid conversion_location "${conversion_location}". Valid options: ${Object.keys(
          SALES_CONFIG.conversionLocations
        ).join(', ')}`,
      };
    }
  
    // Validate performance goal for selected location
    if (!locationConfig.validPerformanceGoals.includes(performance_goal)) {
      return {
        error: `Invalid performance_goal "${performance_goal}" for conversion location "${conversion_location}". Valid options: ${locationConfig.validPerformanceGoals.join(
          ', '
        )}`,
      };
    }
  
    // Validate per-location requireds (only among retained params)
    for (const field of locationConfig.requiredFields) {
      if (field === 'pixel_id' && !pixel_id) {
        return { error: `pixel_id is required for conversion location "${conversion_location}"` };
      }
      if (field === 'page_id' && !page_id) {
        return { error: `page_id is required for conversion location "${conversion_location}"` };
      }
      // Note: application_id not exposed by spec; avoid using locations that require it unless you extend inputs
      if (field === 'application_id' && !application_id) {
        return {
            error: `application_id is required for conversion location "${conversion_location}"`};
      }
    }
  
    // Budget validation per retained params
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
      const adSetName = name || SALES_CONFIG.defaultName(conversion_location, performance_goal);
      const optimization_goal = SALES_CONFIG.performanceGoals[performance_goal];
      const builtTargeting = buildTargeting();
      const builtPromotedObject = buildPromotedObject();
  
      const url = `${baseUrl}/act_${account_id}/adsets`;
  
      const adSetParams = {
        name: adSetName,
        campaign_id,
        optimization_goal,
        billing_event: SALES_CONFIG.billingEvent, // fixed internally; not exposed
        status,
        access_token: token,
      };
  
      if (locationConfig.destinationType) {
        adSetParams.destination_type = locationConfig.destinationType;
      }
  
      // CBO handling
      if (campaignInfo.cboEnabled) {
        // no ad set budget
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
  
      // Apply targeting and promoted_object
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
          error: `Sales ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
          details: errorData,
        };
      }
  
      const result = await response.json();
      return {
        success: true,
        adset: result,
        campaign_type: 'SALES',
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
        error: 'An error occurred while creating the sales ad set.',
        details: error.message,
      };
    }
  };
  
  /**
   * Tool configuration for creating Facebook sales ad sets
   * (Only exposes the parameters you listed)
   */
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create-ad-set-sales',
        description:
          'Create a Facebook ad set for SALES campaigns with a minimal, focused parameter set.',
        parameters: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Ad account ID (without act_)' },
            campaign_id: { type: 'string', description: 'Parent campaign ID (OUTCOME_SALES)' },
            name: { type: 'string', description: 'Ad set name' },
            conversion_location: {
              type: 'string',
              enum: [
                'website',
                'app',
                'website_and_app',
                'message_destinations',
                'calls',
                'website_and_store',
                'website_and_calls',
              ],
              description: 'Destination for sales',
            },
            performance_goal: {
              type: 'string',
              enum: [
                'maximize_conversions',
                'maximize_conversion_value',
                'cost_per_conversion',
                'maximize_conversations',
                'cost_per_conversation',
                'maximize_calls',
                'cost_per_call',
              ],
              description: 'How to optimize performance',
            },
            page_id: { type: 'string', description: 'Facebook Page ID' },
            pixel_id: { type: 'string', description: 'Pixel ID (required for website conversions)' },
  
            // NEW: add application_id so it appears in JSX
            application_id: {
              type: 'string',
              description:
                'Facebook App ID (required when conversion_location is "app" or "website_and_app")',
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
                'PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ', 'BD', 'LK', 'MM', 'KH', 'LA', 'BN',
                'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC',
                'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE',
                'AE', 'SA', 'IL', 'EG', 'ZA', 'NG', 'KE', 'MA', 'GH', 'TN', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM',
                'ASEAN', 'SEA', 'APAC', 'EU', 'EUROPE', 'NORTH_AMERICA', 'LATIN_AMERICA', 'MIDDLE_EAST', 'GCC', 'ENGLISH_SPEAKING', 'DEVELOPED_MARKETS', 'EMERGING_MARKETS',
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
              description: 'Event to optimize for (default: PURCHASE)',
            },
  
            status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Ad set status' },
          },
  
          // Keep page_id required (Awareness-style visibility)
          required: [
            'account_id',
            'campaign_id',
            'conversion_location',
            'performance_goal',
            'page_id',
          ],
  
          // Conditional requirements so the UI requires the right fields when needed
          allOf: [
            // Website-only destinations require pixel_id
            {
              if: { properties: { conversion_location: { const: 'website' } } },
              then: { required: ['pixel_id'] }
            },
            // Website & store also requires pixel_id
            {
              if: { properties: { conversion_location: { const: 'website_and_store' } } },
              then: { required: ['pixel_id'] }
            },
            // Website & calls requires both pixel_id and page_id
            {
              if: { properties: { conversion_location: { const: 'website_and_calls' } } },
              then: { required: ['pixel_id', 'page_id'] }
            },
            // App-only requires application_id
            {
              if: { properties: { conversion_location: { const: 'app' } } },
              then: { required: ['application_id'] }
            },
            // Website & app requires application_id and pixel_id
            {
              if: { properties: { conversion_location: { const: 'website_and_app' } } },
              then: { required: ['application_id', 'pixel_id'] }
            },
            // Messaging destinations require page_id (already top-level required; keeps it explicit)
            {
              if: { properties: { conversion_location: { const: 'message_destinations' } } },
              then: { required: ['page_id'] }
            },
            // Calls require page_id (explicit)
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
  