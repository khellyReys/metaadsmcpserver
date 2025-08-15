/**
 * MCP Tool for creating Facebook ad sets - AWARENESS campaigns only
 * Optimized for brand awareness, reach, and ad recall campaigns
 */

/**
 * Create a Facebook ad set for AWARENESS campaigns
 */
const executeFunction = async ({ 
  // 1. Basic Details
  account_id,
  campaign_id,
  name = null, // Default will be generated
  optimization_goal = 'REACH', // Default (Performance Goal)
  page_id, // Required Facebook Page ID
  
  // 2. Cost & Bidding
  cost_per_result_goal = null, // Optional cost per result in pesos
  bid_strategy = 'LOWEST_COST_WITHOUT_CAP', // Default: Highest volume
  bid_amount = null, // Optional manual bid in pesos
  
  // 3. Frequency Control
  target_frequency = 2, // Default: Average 2 times
  frequency_cap = '2 times every 7 days', // Default cap
  
  // 4. Creative Settings
  dynamic_creative = false, // Default: Off
  
  // 5. Budget & Schedule
  budget_type = 'daily_budget', // Default: Daily budget
  daily_budget = 500, // Default: ₱500
  lifetime_budget = null,
  start_time = null, // Required if lifetime budget
  end_time = null, // Required if lifetime budget
  
  // 6. Audience
  location = 'PH', // Default: Philippines
  age_min = 18, // Default: 18
  age_max = 65, // Default: 65+
  gender = 'all', // Default: All genders
  detailed_targeting = 'all', // Default: All demographics
  custom_audience_id = null, // Custom audience ID
  
  // Additional Facebook required parameters
  status = 'ACTIVE',
  billing_event = 'IMPRESSIONS', // Always IMPRESSIONS for awareness
  targeting = null, // Will be built from audience parameters
  promoted_object = null, // Will be built from page_id
  attribution_spec = null
}) => {
  // Only import and initialize Node-only dependencies at execution time
  const { createClient } = await import('@supabase/supabase-js');
  
  // Create Supabase client only when function executes
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // AWARENESS campaign configuration
  const AWARENESS_CONFIG = {
    objective: 'OUTCOME_AWARENESS',
    validOptimizationGoals: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS'],
    billingEvent: 'IMPRESSIONS',
    defaultName: (goal) => `Awareness ${goal} ${new Date().toISOString().split('T')[0]}`,
    frequencyCapOptions: {
      '1 times every 7 days': { event: 'IMPRESSIONS', interval_days: 7, max_frequency: 1 },
      '2 times every 7 days': { event: 'IMPRESSIONS', interval_days: 7, max_frequency: 2 },
      '3 times every 7 days': { event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 },
      '1 times every 1 days': { event: 'IMPRESSIONS', interval_days: 1, max_frequency: 1 },
      '2 times every 1 days': { event: 'IMPRESSIONS', interval_days: 1, max_frequency: 2 }
    },
    locationMap: {
      // Single Countries - Asia Pacific
      'PH': ['PH'], // Philippines
      'SG': ['SG'], // Singapore  
      'MY': ['MY'], // Malaysia
      'TH': ['TH'], // Thailand
      'VN': ['VN'], // Vietnam
      'ID': ['ID'], // Indonesia
      'IN': ['IN'], // India
      'JP': ['JP'], // Japan
      'KR': ['KR'], // South Korea
      'CN': ['CN'], // China
      'HK': ['HK'], // Hong Kong
      'TW': ['TW'], // Taiwan
      'AU': ['AU'], // Australia
      'NZ': ['NZ'], // New Zealand
      'BD': ['BD'], // Bangladesh
      'LK': ['LK'], // Sri Lanka
      'MM': ['MM'], // Myanmar
      'KH': ['KH'], // Cambodia
      'LA': ['LA'], // Laos
      'BN': ['BN'], // Brunei
      
      // Single Countries - Americas
      'US': ['US'], // United States
      'CA': ['CA'], // Canada
      'MX': ['MX'], // Mexico
      'BR': ['BR'], // Brazil
      'AR': ['AR'], // Argentina
      'CL': ['CL'], // Chile
      'CO': ['CO'], // Colombia
      'PE': ['PE'], // Peru
      'VE': ['VE'], // Venezuela
      'EC': ['EC'], // Ecuador
      
      // Single Countries - Europe
      'GB': ['GB'], // United Kingdom
      'DE': ['DE'], // Germany
      'FR': ['FR'], // France
      'IT': ['IT'], // Italy
      'ES': ['ES'], // Spain
      'NL': ['NL'], // Netherlands
      'BE': ['BE'], // Belgium
      'CH': ['CH'], // Switzerland
      'AT': ['AT'], // Austria
      'SE': ['SE'], // Sweden
      'NO': ['NO'], // Norway
      'DK': ['DK'], // Denmark
      'FI': ['FI'], // Finland
      'PL': ['PL'], // Poland
      'RU': ['RU'], // Russia
      'UA': ['UA'], // Ukraine
      'TR': ['TR'], // Turkey
      'GR': ['GR'], // Greece
      'PT': ['PT'], // Portugal
      'IE': ['IE'], // Ireland
      'CZ': ['CZ'], // Czech Republic
      'HU': ['HU'], // Hungary
      'RO': ['RO'], // Romania
      'BG': ['BG'], // Bulgaria
      'HR': ['HR'], // Croatia
      'SI': ['SI'], // Slovenia
      'SK': ['SK'], // Slovakia
      'LT': ['LT'], // Lithuania
      'LV': ['LV'], // Latvia
      'EE': ['EE'], // Estonia
      
      // Single Countries - Middle East & Africa
      'AE': ['AE'], // United Arab Emirates
      'SA': ['SA'], // Saudi Arabia
      'IL': ['IL'], // Israel
      'EG': ['EG'], // Egypt
      'ZA': ['ZA'], // South Africa
      'NG': ['NG'], // Nigeria
      'KE': ['KE'], // Kenya
      'MA': ['MA'], // Morocco
      'GH': ['GH'], // Ghana
      'TN': ['TN'], // Tunisia
      'JO': ['JO'], // Jordan
      'LB': ['LB'], // Lebanon
      'KW': ['KW'], // Kuwait
      'QA': ['QA'], // Qatar
      'BH': ['BH'], // Bahrain
      'OM': ['OM'], // Oman
      
      // Regional Groups
      'ASEAN': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'], // ASEAN countries
      'SEA': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'], // Southeast Asia (same as ASEAN)
      'APAC': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ'], // Asia Pacific
      'EU': ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'PL', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'], // European Union
      'EUROPE': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'], // Europe including non-EU
      'NORTH_AMERICA': ['US', 'CA'], // North America
      'LATIN_AMERICA': ['MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC'], // Latin America
      'MIDDLE_EAST': ['AE', 'SA', 'IL', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM'], // Middle East
      'GCC': ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'], // Gulf Cooperation Council
      'ENGLISH_SPEAKING': ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'SG', 'PH', 'IN', 'ZA'], // Major English-speaking countries
      'DEVELOPED_MARKETS': ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'AU', 'JP', 'KR', 'SG', 'HK'], // Developed markets
      'EMERGING_MARKETS': ['PH', 'MY', 'TH', 'VN', 'ID', 'IN', 'CN', 'BR', 'MX', 'AR', 'TR', 'RU', 'ZA'], // Emerging markets
      
      // Special
      'worldwide': null // No geo restriction
    },
    genderMap: {
      'all': [1, 2], // All genders
      'male': [1], // Male only
      'female': [2] // Female only
    }
  };

  // Helper functions
  const convertPesosToCents = (pesos) => {
    if (!pesos || pesos <= 0) return null;
    return Math.round(pesos * 100);
  };

  const getUserFromAccount = async (supabase, accountId) => {
    console.log('🔍 Finding user for account ID:', accountId);
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    try {
      const accountIdStr = String(accountId).trim();
      
      const { data: allData, error: allError } = await supabase
        .from('facebook_ad_accounts')
        .select('user_id, id, name')
        .eq('id', accountIdStr);

      if (allError) {
        console.error('❌ Account lookup error:', allError);
        throw new Error(`Account lookup failed: ${allError.message}`);
      }

      if (!allData || allData.length === 0) {
        throw new Error(`Ad account ${accountIdStr} not found in database. Check if the account ID is correct.`);
      }

      const userData = allData[0];
      
      if (!userData.user_id) {
        throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
      }
      
      console.log('✅ Found user ID:', userData.user_id, 'for account:', userData.name);
      return userData.user_id;
    } catch (error) {
      console.error('💥 Error in getUserFromAccount:', error);
      throw error;
    }
  };

  const getFacebookToken = async (supabase, userId) => {
    console.log('🔍 Attempting to get Facebook token for userId:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('facebook_long_lived_token')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      if (!data || !data.facebook_long_lived_token) {
        return null;
      }

      console.log('✅ Facebook token retrieved successfully');
      return data.facebook_long_lived_token;
    } catch (error) {
      console.error('💥 Error in getFacebookToken:', error);
      throw error;
    }
  };

  const getCampaignInfo = async (campaignId, token) => {
    const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
    const url = `https://graph.facebook.com/${API_VERSION}/${campaignId}?fields=objective,daily_budget,lifetime_budget&access_token=${token}`;
    
    try {
      const response = await fetch(url);
      const campaignData = await response.json();
      
      if (campaignData.error) {
        throw new Error(`Campaign lookup failed: ${campaignData.error.message}`);
      }
      
      const cboEnabled = !!(campaignData.daily_budget || campaignData.lifetime_budget);
      
      console.log('📊 Campaign info:', { 
        objective: campaignData.objective, 
        cboEnabled, 
        campaignData 
      });
      
      // Verify this is an awareness campaign
      if (campaignData.objective !== 'OUTCOME_AWARENESS') {
        console.warn(`⚠️ Campaign objective is ${campaignData.objective}, but this tool is optimized for OUTCOME_AWARENESS campaigns`);
      }
      
      return {
        objective: campaignData.objective,
        cboEnabled
      };
    } catch (error) {
      console.error('⚠️ Could not get campaign info:', error.message);
      throw new Error(`Unable to retrieve campaign information: ${error.message}`);
    }
  };

  const buildTargeting = () => {
    // Start with location
    const targetingObj = {
      geo_locations: {}
    };

    // Handle location
    if (location && AWARENESS_CONFIG.locationMap[location]) {
      if (location === 'worldwide') {
        // No geo restrictions for worldwide - don't set countries
        console.log('🌍 Using worldwide targeting (no geo restrictions)');
      } else {
        targetingObj.geo_locations.countries = AWARENESS_CONFIG.locationMap[location];
        console.log('📍 Applied location targeting:', AWARENESS_CONFIG.locationMap[location]);
      }
    } else {
      // Default to Philippines
      targetingObj.geo_locations.countries = ['PH'];
      console.log('📍 Applied default location: Philippines');
    }

    // Handle age range
    if (age_min && age_min >= 13) {
      targetingObj.age_min = age_min;
    }
    if (age_max && age_max <= 65) {
      targetingObj.age_max = age_max;
    }

    // Handle gender
    if (gender && AWARENESS_CONFIG.genderMap[gender]) {
      targetingObj.genders = AWARENESS_CONFIG.genderMap[gender];
    }

    // Handle detailed targeting
    if (detailed_targeting === 'all') {
      // Don't add interest restrictions for maximum reach
      console.log('🎯 Using broad targeting for maximum awareness reach');
    } else if (detailed_targeting === 'custom' && custom_audience_id) {
      // Apply custom audience
      targetingObj.custom_audiences = [custom_audience_id];
      console.log('👥 Applied custom audience:', custom_audience_id);
    }

    return targetingObj;
  };

  const buildFrequencyControl = () => {
    let frequencyControlObj;
    
    if (frequency_cap && AWARENESS_CONFIG.frequencyCapOptions[frequency_cap]) {
      frequencyControlObj = AWARENESS_CONFIG.frequencyCapOptions[frequency_cap];
    } else {
      // Default frequency control
      frequencyControlObj = {
        event: 'IMPRESSIONS',
        interval_days: 7,
        max_frequency: target_frequency || 2
      };
    }
    
    // Facebook expects an array of frequency control specs
    return [frequencyControlObj];
  };

  // Main execution logic
  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
  // Validate required params
  if (!account_id) {
    return { error: 'Missing required parameter: account_id' };
  }

  if (!campaign_id) {
    return { error: 'Missing required parameter: campaign_id' };
  }

  if (!page_id) {
    return { error: 'Missing required parameter: page_id (Facebook Page ID is required for awareness campaigns)' };
  }

  // Validate optimization goal for awareness campaigns
  if (!AWARENESS_CONFIG.validOptimizationGoals.includes(optimization_goal)) {
    return {
      error: `Invalid optimization_goal "${optimization_goal}" for awareness campaigns. Valid options: ${AWARENESS_CONFIG.validOptimizationGoals.join(', ')}`
    };
  }

  // Validate budget type and requirements
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
  }

  // Validate custom audience when detailed_targeting is 'custom'
  if (detailed_targeting === 'custom' && !custom_audience_id) {
    return { error: 'custom_audience_id is required when detailed_targeting is "custom"' };
  }

  console.log('📥 Input parameters received:', {
    account_id,
    campaign_id,
    page_id,
    optimization_goal,
    budget_type,
    location,
    detailed_targeting
  });

  try {
    console.log('🎯 Processing AWARENESS ad set creation for account:', account_id);

    // Step 1: Get user and token
    const userId = await getUserFromAccount(supabase, account_id);
    const token = await getFacebookToken(supabase, userId);
    
    if (!token) {
      return { 
        error: 'No Facebook access token found for the user who owns this ad account',
        details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
      };
    }

    // Step 2: Get campaign info and validate
    const campaignInfo = await getCampaignInfo(campaign_id, token);

    // Step 3: Build ad set parameters
    console.log('📢 Building AWARENESS ad set with specified parameters...');

    // Generate ad set name if not provided
    const adSetName = name || AWARENESS_CONFIG.defaultName(optimization_goal);

    // Build targeting from audience parameters
    const builtTargeting = targeting || buildTargeting();

    // Build promoted object
    const builtPromotedObject = promoted_object || { page_id };

    // Build frequency control
    const frequencyControlSpecs = buildFrequencyControl();

    const url = `${baseUrl}/act_${account_id}/adsets`;
    
    const adSetParams = {
      name: adSetName,
      campaign_id,
      optimization_goal,
      billing_event: AWARENESS_CONFIG.billingEvent,
      status,
      access_token: token
    };

    // Handle budget based on campaign CBO status and user selection
    if (campaignInfo.cboEnabled) {
      console.log('📊 Campaign has CBO enabled - no budget required at ad set level');
    } else {
      console.log('📊 Campaign has CBO disabled - applying budget at ad set level');
      
      if (budget_type === 'lifetime_budget') {
        const lifetimeBudgetCents = convertPesosToCents(lifetime_budget);
        adSetParams.lifetime_budget = String(lifetimeBudgetCents);
        adSetParams.start_time = new Date(start_time).toISOString();
        adSetParams.end_time = new Date(end_time).toISOString();
        console.log(`💰 Applied lifetime budget: ₱${lifetime_budget} (${lifetimeBudgetCents} cents)`);
      } else {
        const dailyBudgetCents = convertPesosToCents(daily_budget);
        adSetParams.daily_budget = String(dailyBudgetCents);
        console.log(`💰 Applied daily budget: ₱${daily_budget} (${dailyBudgetCents} cents)`);
      }
    }

    // Handle cost per result goal
    if (cost_per_result_goal && cost_per_result_goal > 0) {
      const costPerResultCents = convertPesosToCents(cost_per_result_goal);
      adSetParams.bid_amount = String(costPerResultCents);
      console.log(`🎯 Set cost per result goal: ₱${cost_per_result_goal} (${costPerResultCents} cents)`);
    } else if (bid_amount && bid_amount > 0) {
      const bidAmountCents = convertPesosToCents(bid_amount);
      adSetParams.bid_amount = String(bidAmountCents);
      console.log(`💵 Set manual bid: ₱${bid_amount} (${bidAmountCents} cents)`);
    }

    // Handle bid strategy
    adSetParams.bid_strategy = bid_strategy;

    // Handle dynamic creative
    if (dynamic_creative) {
      adSetParams.is_dynamic_creative = dynamic_creative;
    }

    // Apply targeting
    adSetParams.targeting = JSON.stringify(builtTargeting);
    console.log('🎯 Applied targeting:', builtTargeting);

    // Apply promoted object
    adSetParams.promoted_object = JSON.stringify(builtPromotedObject);

    // Apply frequency control
    adSetParams.frequency_control_specs = JSON.stringify(frequencyControlSpecs);
    console.log('📊 Applied frequency control:', frequencyControlSpecs);

    // Handle attribution spec
    if (attribution_spec) {
      adSetParams.attribution_spec = JSON.stringify(attribution_spec);
    }

    // Remove null/empty values
    for (const [k, v] of Object.entries(adSetParams)) {
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        delete adSetParams[k];
      }
    }

    const body = new URLSearchParams(adSetParams);

    console.log('🚀 Making Facebook API request to:', url);
    console.log('📋 Final awareness ad set params:', Object.fromEntries(body.entries()));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Facebook API error:', errorData);
      return { 
        error: `Awareness ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData 
      };
    }

    const result = await response.json();
    console.log('✅ Awareness ad set created successfully:', result);
    
    return {
      success: true,
      adset: result,
      campaign_type: 'AWARENESS',
      configuration: {
        account_id,
        campaign_id,
        page_id,
        optimization_goal,
        budget_type,
        budget_amount: budget_type === 'daily_budget' ? daily_budget : lifetime_budget,
        location,
        age_range: `${age_min} - ${age_max}`,
        gender,
        detailed_targeting,
        custom_audience_id,
        frequency_control: frequencyControlSpecs,
        dynamic_creative,
        campaign_cbo_enabled: campaignInfo.cboEnabled
      }
    };
  } catch (error) {
    console.error('💥 Error in executeFunction:', error);
    return { 
      error: 'An error occurred while creating the awareness ad set.',
      details: error.message 
    };
  }
};

/**
 * Tool configuration for creating Facebook awareness ad sets
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create-ad-set-awareness',
      description: 'Create a Facebook ad set for AWARENESS campaigns. Optimized for brand awareness, reach, and ad recall with comprehensive parameter control.',
      parameters: {
        type: 'object',
        properties: {
          // 1. Basic Details
          account_id: {
            type: 'string',
            description: 'REQUIRED: Facebook ad account ID (without act_ prefix)'
          },
          campaign_id: {
            type: 'string',
            description: 'REQUIRED: The AWARENESS campaign ID to create this ad set under'
          },
          page_id: {
            type: 'string',
            description: 'REQUIRED: Facebook Page ID to promote for brand awareness'
          },
          name: {
            type: 'string',
            description: 'Ad set name (default: "Awareness {optimization_goal} {date}")'
          },
          optimization_goal: {
            type: 'string',
            enum: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS'],
            description: 'Performance goal (default: REACH for maximum reach, AD_RECALL_LIFT for memorable ads)'
          },

          // 2. Cost & Bidding
          cost_per_result_goal: {
            type: 'number',
            description: 'Optional cost per result goal in pesos (e.g., 5 for ₱5.00)'
          },
          bid_strategy: {
            type: 'string',
            enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
            description: 'Bid strategy (default: LOWEST_COST_WITHOUT_CAP for highest volume)'
          },
          bid_amount: {
            type: 'number',
            description: 'Optional manual bid amount in pesos'
          },

          // 3. Frequency Control
          target_frequency: {
            type: 'integer',
            description: 'Average number of times people see the ad (default: 2)'
          },
          frequency_cap: {
            type: 'string',
            enum: ['1 times every 7 days', '2 times every 7 days', '3 times every 7 days', '1 times every 1 days', '2 times every 1 days'],
            description: 'Maximum frequency cap (default: "2 times every 7 days")'
          },

          // 4. Creative Settings
          dynamic_creative: {
            type: 'boolean',
            description: 'Enable dynamic creative (default: false/Off)'
          },

          // 5. Budget & Schedule
          budget_type: {
            type: 'string',
            enum: ['daily_budget', 'lifetime_budget'],
            description: 'Budget type (default: daily_budget)'
          },
          daily_budget: {
            type: 'number',
            description: 'Daily budget in pesos (default: 500 = ₱500). Required if budget_type is daily_budget.'
          },
          lifetime_budget: {
            type: 'number',
            description: 'Lifetime budget in pesos. Required if budget_type is lifetime_budget.'
          },
          start_time: {
            type: 'string',
            description: 'Start date (ex 2025-01-17T00:00:00+08:00). Required if using lifetime_budget.'
          },
          end_time: {
            type: 'string',
            description: 'End date (ex 2025-07-17T00:00:00+08:00). Required if using lifetime_budget.'
          },

          // 6. Audience
          location: {
            type: 'string',
            enum: [
              // Single Countries - Asia Pacific
              'PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ', 'BD', 'LK', 'MM', 'KH', 'LA', 'BN',
              // Single Countries - Americas  
              'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC',
              // Single Countries - Europe
              'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE',
              // Single Countries - Middle East & Africa
              'AE', 'SA', 'IL', 'EG', 'ZA', 'NG', 'KE', 'MA', 'GH', 'TN', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM',
              // Regional Groups
              'ASEAN', 'SEA', 'APAC', 'EU', 'EUROPE', 'NORTH_AMERICA', 'LATIN_AMERICA', 'MIDDLE_EAST', 'GCC', 'ENGLISH_SPEAKING', 'DEVELOPED_MARKETS', 'EMERGING_MARKETS',
              // Special
              'worldwide'
            ],
            description: 'Target location: Single countries (PH, US, SG, etc.) or regions (ASEAN, APAC, EU, etc.). Default: PH'
          },
          age_min: {
            type: 'integer',
            minimum: 13,
            maximum: 65,
            description: 'Minimum age (default: 18)'
          },
          age_max: {
            type: 'integer',
            minimum: 13,
            maximum: 65,
            description: 'Maximum age (default: 65)'
          },
          gender: {
            type: 'string',
            enum: ['all', 'male', 'female'],
            description: 'Gender targeting (default: all)'
          },
          detailed_targeting: {
            type: 'string',
            enum: ['all', 'custom'],
            description: 'Detailed targeting approach: "all" for broad reach, "custom" to use a specific custom audience'
          },
          custom_audience_id: {
            type: 'string',
            description: 'Custom audience ID - Required when detailed_targeting is "custom"'
          },

          // Additional Options
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED'],
            description: 'Ad set status (default: ACTIVE)'
          }
        },
        required: ['account_id', 'campaign_id', 'page_id']
      }
    }
  }
};

export { apiTool };