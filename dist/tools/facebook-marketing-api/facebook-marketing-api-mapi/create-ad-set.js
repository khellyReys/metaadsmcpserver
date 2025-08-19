/**
 * MCP Tool for creating Facebook ad sets with dynamic objective-based parameters
 */

/**
 * Create a Facebook ad set with dynamic optimization based on campaign objective
 */
const executeFunction = async ({ 
  account_id,
  campaign_id,
  campaign_objective, // User selects this to show relevant parameters
  name,
  optimization_goal = null,
  billing_event = null,
  bid_amount = null,
  bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
  daily_budget = null,
  lifetime_budget = null,
  start_time = null,
  end_time = null,
  status = 'ACTIVE',
  targeting = {},
  promoted_object = {},
  attribution_spec = null,
  frequency_control_specs = null,
  destination_type = null,
  dsa_payor = null,
  dsa_beneficiary = null
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

  // Complete objective configurations based on Facebook API v23.0 and ODAX
  const OBJECTIVE_CONFIGS = {
    'OUTCOME_AWARENESS': {
      name: 'Awareness',
      defaultOptimizationGoal: 'REACH',
      validOptimizationGoals: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS'],
      defaultBillingEvent: 'IMPRESSIONS',
      validBillingEvents: ['IMPRESSIONS'],
      requiredPromotedObject: ['page_id'],
      optionalPromotedObject: [],
      defaultFrequencyControl: { event: 'IMPRESSIONS', interval_days: 7, max_frequency: 2 },
      description: 'Generate interest in your product or service - brand awareness campaigns',
      destinationTypes: null
    },
    'OUTCOME_TRAFFIC': {
      name: 'Traffic',
      defaultOptimizationGoal: 'LINK_CLICKS',
      validOptimizationGoals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS'],
      defaultBillingEvent: 'LINK_CLICKS',
      validBillingEvents: ['LINK_CLICKS', 'IMPRESSIONS'],
      requiredPromotedObject: [],
      optionalPromotedObject: ['application_id', 'object_store_url', 'page_id'],
      defaultFrequencyControl: null,
      description: 'Drive visits to your website, app, or other destinations',
      destinationTypes: ['WEBSITE', 'APP', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT']
    },
    'OUTCOME_ENGAGEMENT': {
      name: 'Engagement',
      defaultOptimizationGoal: 'POST_ENGAGEMENT',
      validOptimizationGoals: ['POST_ENGAGEMENT', 'PAGE_LIKES', 'EVENT_RESPONSES', 'CONVERSATIONS', 'THRUPLAY', 'IMPRESSIONS'],
      defaultBillingEvent: 'IMPRESSIONS',
      validBillingEvents: ['IMPRESSIONS', 'POST_ENGAGEMENT', 'PAGE_LIKES'],
      requiredPromotedObject: ['page_id'],
      optionalPromotedObject: [],
      defaultFrequencyControl: null,
      description: 'Get people to engage with your posts, like your page, or respond to events',
      destinationTypes: ['ON_POST', 'ON_PAGE', 'ON_EVENT', 'ON_VIDEO', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT']
    },
    'OUTCOME_LEADS': {
      name: 'Leads',
      defaultOptimizationGoal: 'LEAD_GENERATION',
      validOptimizationGoals: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'QUALITY_LEAD', 'CONVERSATIONS'],
      defaultBillingEvent: 'IMPRESSIONS',
      validBillingEvents: ['IMPRESSIONS'],
      requiredPromotedObject: ['page_id'],
      optionalPromotedObject: ['pixel_id', 'custom_event_type'],
      defaultFrequencyControl: null,
      description: 'Collect leads through forms, website conversions, or messaging',
      destinationTypes: ['WEBSITE', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT', 'ON_AD']
    },
    'OUTCOME_APP_PROMOTION': {
      name: 'App Promotion',
      defaultOptimizationGoal: 'APP_INSTALLS',
      validOptimizationGoals: ['APP_INSTALLS', 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'VALUE', 'IMPRESSIONS'],
      defaultBillingEvent: 'APP_INSTALLS',
      validBillingEvents: ['APP_INSTALLS', 'LINK_CLICKS', 'IMPRESSIONS'],
      requiredPromotedObject: ['application_id', 'object_store_url'],
      optionalPromotedObject: [],
      defaultFrequencyControl: null,
      description: 'Promote mobile app installs or engagement',
      destinationTypes: ['APP']
    },
    'OUTCOME_SALES': {
      name: 'Sales',
      defaultOptimizationGoal: 'OFFSITE_CONVERSIONS',
      validOptimizationGoals: ['OFFSITE_CONVERSIONS', 'CONVERSIONS', 'VALUE', 'IMPRESSIONS'],
      defaultBillingEvent: 'IMPRESSIONS',
      validBillingEvents: ['IMPRESSIONS', 'PURCHASE'],
      requiredPromotedObject: ['pixel_id'],
      optionalPromotedObject: ['custom_event_type'],
      defaultFrequencyControl: null,
      description: 'Drive purchases and sales conversions',
      destinationTypes: ['WEBSITE', 'MESSENGER', 'WHATSAPP', 'SHOP_AUTOMATIC']
    }
  };

  // Helper functions
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
      
      return {
        objective: campaignData.objective,
        cboEnabled
      };
    } catch (error) {
      console.error('⚠️ Could not get campaign info:', error.message);
      throw new Error(`Unable to retrieve campaign information: ${error.message}`);
    }
  };

  const applyObjectiveDefaults = (objectiveKey, params) => {
    const config = OBJECTIVE_CONFIGS[objectiveKey];
    
    if (!config) {
      throw new Error(`Unsupported campaign objective: ${objectiveKey}. Supported: ${Object.keys(OBJECTIVE_CONFIGS).join(', ')}`);
    }

    console.log(`🎯 Applying defaults for ${config.name} (${config.description})`);

    // Set optimization goal if not provided
    if (!params.optimization_goal) {
      params.optimization_goal = config.defaultOptimizationGoal;
      console.log(`📈 Set optimization_goal to default: ${params.optimization_goal}`);
    }

    // Validate optimization goal
    if (!config.validOptimizationGoals.includes(params.optimization_goal)) {
      throw new Error(`Invalid optimization_goal "${params.optimization_goal}" for ${objectiveKey}. Valid options: ${config.validOptimizationGoals.join(', ')}`);
    }

    // Set billing event if not provided
    if (!params.billing_event) {
      params.billing_event = config.defaultBillingEvent;
      console.log(`💰 Set billing_event to: ${params.billing_event}`);
    }

    // Validate billing event
    if (!config.validBillingEvents.includes(params.billing_event)) {
      console.warn(`⚠️ billing_event "${params.billing_event}" may not be optimal for ${objectiveKey}. Recommended: ${config.validBillingEvents.join(', ')}`);
    }

    // Apply objective-specific defaults and validations
    switch (objectiveKey) {
      case 'OUTCOME_AWARENESS':
        if (!params.frequency_control_specs && config.defaultFrequencyControl) {
          params.frequency_control_specs = config.defaultFrequencyControl;
          console.log('📊 Applied default frequency control for awareness');
        }
        break;

      case 'OUTCOME_TRAFFIC':
        if (params.optimization_goal === 'LINK_CLICKS' && params.billing_event === 'IMPRESSIONS') {
          console.log('💡 Using IMPRESSIONS billing with LINK_CLICKS optimization - consider LINK_CLICKS billing for potentially better performance');
        }
        break;

      case 'OUTCOME_LEADS':
        if (params.optimization_goal === 'OFFSITE_CONVERSIONS' && !params.promoted_object.pixel_id) {
          console.warn('⚠️ OFFSITE_CONVERSIONS optimization typically requires pixel_id in promoted_object');
        }
        if (params.optimization_goal === 'LEAD_GENERATION' && !params.destination_type) {
          params.destination_type = 'ON_AD'; // Default for instant forms
          console.log('📋 Set destination_type to ON_AD for lead generation');
        }
        break;

      case 'OUTCOME_APP_PROMOTION':
        if (params.optimization_goal === 'APP_INSTALLS' && params.billing_event !== 'APP_INSTALLS') {
          params.billing_event = 'APP_INSTALLS';
          console.log('📱 Adjusted billing_event to APP_INSTALLS for app install optimization');
        }
        break;

      case 'OUTCOME_SALES':
        if (!params.promoted_object.custom_event_type) {
          params.promoted_object.custom_event_type = 'PURCHASE';
          console.log('🛒 Set default custom_event_type to PURCHASE');
        }
        break;
    }

    return params;
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

  // If campaign_objective is provided, use it for parameter validation
  // Otherwise, we'll detect it from the campaign
  let objectiveToUse = campaign_objective;

  console.log('📥 Input parameters received:', {
    account_id,
    campaign_id,
    campaign_objective,
    optimization_goal
  });

  try {
    console.log('🔍 Processing ad set creation for account:', account_id);

    // Step 1: Get user and token
    const userId = await getUserFromAccount(supabase, account_id);
    const token = await getFacebookToken(supabase, userId);
    
    if (!token) {
      return { 
        error: 'No Facebook access token found for the user who owns this ad account',
        details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
      };
    }

    // Step 2: Get campaign info
    const campaignInfo = await getCampaignInfo(campaign_id, token);
    
    // Use detected objective if not provided by user
    if (!objectiveToUse) {
      objectiveToUse = campaignInfo.objective;
      console.log(`🔍 Detected campaign objective: ${objectiveToUse}`);
    }

    // Step 3: Apply objective-specific defaults
    const processedParams = applyObjectiveDefaults(objectiveToUse, {
      optimization_goal,
      billing_event,
      frequency_control_specs,
      promoted_object,
      destination_type
    });

    // Generate ad set name
    const adSetName = name || `Ad Set ${processedParams.optimization_goal} ${new Date().toISOString()}`;
    
    const url = `${baseUrl}/act_${account_id}/adsets`;
    
    const adSetParams = {
      name: adSetName,
      campaign_id,
      optimization_goal: processedParams.optimization_goal,
      billing_event: processedParams.billing_event,
      status,
      access_token: token
    };

    // Handle budget based on campaign CBO status
    if (campaignInfo.cboEnabled) {
      console.log('📊 Campaign has CBO enabled - no budget required at ad set level');
    } else {
      console.log('📊 Campaign has CBO disabled - budget required at ad set level');
      
      const hasLifetime = lifetime_budget && Number(lifetime_budget) > 0;
      const hasDaily = daily_budget && Number(daily_budget) > 0;
      
      if (!hasLifetime && !hasDaily) {
        return {
          error: 'Budget required: Campaign does not have Campaign Budget Optimization (CBO) enabled, so you must provide either daily_budget or lifetime_budget for the ad set.',
          details: { 
            campaign_cbo_enabled: campaignInfo.cboEnabled, 
            daily_budget, 
            lifetime_budget 
          }
        };
      }

      if (hasLifetime) {
        adSetParams.lifetime_budget = String(lifetime_budget);
      } else if (hasDaily) {
        adSetParams.daily_budget = String(daily_budget);
      }
    }

    // Handle bid settings
    if (bid_amount && Number(bid_amount) > 0) {
      adSetParams.bid_amount = String(bid_amount);
    }
    
    if (bid_strategy) {
      adSetParams.bid_strategy = bid_strategy;
    }

    // Handle timing
    if (start_time) {
      const startDate = new Date(start_time);
      if (!isNaN(startDate.getTime())) {
        adSetParams.start_time = startDate.toISOString();
      }
    }

    if (end_time) {
      const endDate = new Date(end_time);
      if (!isNaN(endDate.getTime())) {
        adSetParams.end_time = endDate.toISOString();
      }
    }

    // Handle targeting
    if (targeting && Object.keys(targeting).length > 0) {
      const cleanTargeting = {};
      for (const [key, value] of Object.entries(targeting)) {
        if (value != null && value !== '') {
          cleanTargeting[key] = value;
        }
      }
      
      if (Object.keys(cleanTargeting).length > 0) {
        adSetParams.targeting = JSON.stringify(cleanTargeting);
      }
    } else {
      // Default targeting
      adSetParams.targeting = JSON.stringify({
        geo_locations: { countries: ['US'] },
        age_min: 18,
        age_max: 65
      });
    }

    // Handle promoted object
    if (processedParams.promoted_object && Object.keys(processedParams.promoted_object).length > 0) {
      adSetParams.promoted_object = JSON.stringify(processedParams.promoted_object);
    }

    // Handle destination type
    if (processedParams.destination_type) {
      adSetParams.destination_type = processedParams.destination_type;
    }

    // Handle EU DSA requirements
    if (dsa_payor) {
      adSetParams.dsa_payor = dsa_payor;
    }
    if (dsa_beneficiary) {
      adSetParams.dsa_beneficiary = dsa_beneficiary;
    }

    // Handle other optional parameters
    if (attribution_spec) {
      adSetParams.attribution_spec = JSON.stringify(attribution_spec);
    }

    if (processedParams.frequency_control_specs) {
      adSetParams.frequency_control_specs = JSON.stringify(processedParams.frequency_control_specs);
    }

    // Remove null/empty values
    for (const [k, v] of Object.entries(adSetParams)) {
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        delete adSetParams[k];
      }
    }

    const body = new URLSearchParams(adSetParams);

    console.log('🚀 Making Facebook API request to:', url);
    console.log('📋 Final ad set params being sent:', Object.fromEntries(body.entries()));

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
        error: `Ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData 
      };
    }

    const result = await response.json();
    console.log('✅ Ad set created successfully:', result);
    
    return {
      success: true,
      adset: result,
      account_id,
      campaign_id,
      campaign_objective: objectiveToUse,
      optimization_goal: processedParams.optimization_goal,
      billing_event: processedParams.billing_event,
      campaign_cbo_enabled: campaignInfo.cboEnabled,
      budget_info: {
        budget_level: campaignInfo.cboEnabled ? 'campaign' : 'ad_set',
        daily_budget: campaignInfo.cboEnabled ? null : daily_budget,
        lifetime_budget: campaignInfo.cboEnabled ? null : lifetime_budget
      }
    };
  } catch (error) {
    console.error('💥 Error in executeFunction:', error);
    return { 
      error: 'An error occurred while creating the ad set.',
      details: error.message 
    };
  }
};

/**
 * Dynamic tool configuration - parameters change based on campaign objective
 */
const getParametersForObjective = (objective) => {
  const baseParams = {
    account_id: {
      type: 'string',
      description: 'REQUIRED: Facebook ad account ID (without act_ prefix)'
    },
    campaign_id: {
      type: 'string',
      description: 'REQUIRED: The campaign ID to create this ad set under'
    },
    campaign_objective: {
      type: 'string',
      enum: ['OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_APP_PROMOTION', 'OUTCOME_SALES'],
      description: 'REQUIRED: Campaign objective - determines available parameters and defaults'
    },
    name: {
      type: 'string',
      description: 'Ad set name (defaults to "Ad Set {optimization_goal} {timestamp}")'
    },
    daily_budget: {
      type: 'integer',
      description: 'Daily budget in cents. Required if campaign does not have Campaign Budget Optimization (CBO) and no lifetime_budget is set.'
    },
    lifetime_budget: {
      type: 'integer',
      description: 'Total budget in cents. Required if campaign does not have CBO and no daily_budget is set.'
    },
    start_time: {
      type: 'string',
      description: 'Start time (ISO 8601 format, e.g., "2024-01-15T10:00:00Z"). Starts immediately if not provided.'
    },
    end_time: {
      type: 'string',
      description: 'End time (ISO 8601 format). Optional.'
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'PAUSED'],
      description: 'Ad set status (default: ACTIVE)'
    },
    targeting: {
      type: 'object',
      description: 'Targeting specification. Defaults to US, ages 18-65. Example: {"geo_locations": {"countries": ["US"]}, "age_min": 25, "age_max": 45}',
      properties: {
        geo_locations: { type: 'object', description: 'REQUIRED: Geographic targeting' },
        age_min: { type: 'integer', minimum: 13, maximum: 65 },
        age_max: { type: 'integer', minimum: 13, maximum: 65 },
        genders: { type: 'array', items: { type: 'integer' }, description: '[1] men, [2] women, [1,2] all' },
        interests: { type: 'array', items: { type: 'object' } },
        behaviors: { type: 'array', items: { type: 'object' } },
        custom_audiences: { type: 'array', items: { type: 'string' } }
      }
    },
    bid_amount: {
      type: 'integer',
      description: 'Maximum bid in cents (optional - auto-bid recommended)'
    },
    bid_strategy: {
      type: 'string',
      enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
      description: 'Bidding strategy (default: LOWEST_COST_WITHOUT_CAP)'
    },
    attribution_spec: {
      type: 'array',
      items: { type: 'object' },
      description: 'Attribution windows. Example: [{"event_type": "CLICK_THROUGH", "window_days": 7}]'
    },
    dsa_payor: {
      type: 'string',
      description: 'REQUIRED for EU targeting: Who pays for the ad (max 512 chars)'
    },
    dsa_beneficiary: {
      type: 'string',
      description: 'REQUIRED for EU targeting: Who benefits from the ad (max 512 chars)'
    }
  };

  const config = {
    'OUTCOME_AWARENESS': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS'],
        description: 'Optimization goal (default: REACH for maximum reach, AD_RECALL_LIFT for memorable ads)'
      },
      billing_event: {
        type: 'string',
        enum: ['IMPRESSIONS'],
        description: 'Billing event (always IMPRESSIONS for awareness)'
      },
      promoted_object: {
        type: 'object',
        description: 'REQUIRED: Page to promote',
        properties: {
          page_id: { type: 'string', description: 'REQUIRED: Facebook page ID' }
        },
        required: ['page_id']
      },
      frequency_control_specs: {
        type: 'object',
        description: 'Frequency control (auto-set to 2 impressions/week if not provided)',
        properties: {
          event: { type: 'string', enum: ['IMPRESSIONS'] },
          interval_days: { type: 'integer' },
          max_frequency: { type: 'integer' }
        }
      }
    },
    'OUTCOME_TRAFFIC': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS'],
        description: 'Optimization goal (default: LINK_CLICKS for clicks, LANDING_PAGE_VIEWS for quality visits)'
      },
      billing_event: {
        type: 'string',
        enum: ['LINK_CLICKS', 'IMPRESSIONS'],
        description: 'Billing event (default: LINK_CLICKS)'
      },
      promoted_object: {
        type: 'object',
        description: 'Optional: What to promote (for app traffic or specific destinations)',
        properties: {
          application_id: { type: 'string', description: 'App ID for app traffic' },
          object_store_url: { type: 'string', description: 'App store URL' },
          page_id: { type: 'string', description: 'Page ID for page traffic' }
        }
      },
      destination_type: {
        type: 'string',
        enum: ['WEBSITE', 'APP', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'],
        description: 'Traffic destination type'
      }
    },
    'OUTCOME_ENGAGEMENT': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['POST_ENGAGEMENT', 'PAGE_LIKES', 'EVENT_RESPONSES', 'CONVERSATIONS', 'THRUPLAY', 'IMPRESSIONS'],
        description: 'Optimization goal (default: POST_ENGAGEMENT for likes/comments/shares)'
      },
      billing_event: {
        type: 'string',
        enum: ['IMPRESSIONS', 'POST_ENGAGEMENT', 'PAGE_LIKES'],
        description: 'Billing event (default: IMPRESSIONS)'
      },
      promoted_object: {
        type: 'object',
        description: 'REQUIRED: Page or content to engage with',
        properties: {
          page_id: { type: 'string', description: 'REQUIRED: Facebook page ID' }
        },
        required: ['page_id']
      },
      destination_type: {
        type: 'string',
        enum: ['ON_POST', 'ON_PAGE', 'ON_EVENT', 'ON_VIDEO', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'],
        description: 'Engagement destination'
      }
    },
    'OUTCOME_LEADS': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'QUALITY_LEAD', 'CONVERSATIONS'],
        description: 'Optimization goal (default: LEAD_GENERATION for instant forms, OFFSITE_CONVERSIONS for website leads)'
      },
      billing_event: {
        type: 'string',
        enum: ['IMPRESSIONS'],
        description: 'Billing event (always IMPRESSIONS for leads)'
      },
      promoted_object: {
        type: 'object',
        description: 'REQUIRED: Page and optional pixel for tracking',
        properties: {
          page_id: { type: 'string', description: 'REQUIRED: Facebook page ID' },
          pixel_id: { type: 'string', description: 'Pixel ID for website lead tracking' },
          custom_event_type: { type: 'string', description: 'Event type (e.g., LEAD, COMPLETE_REGISTRATION)' }
        },
        required: ['page_id']
      },
      destination_type: {
        type: 'string',
        enum: ['WEBSITE', 'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT', 'ON_AD'],
        description: 'Lead collection method (default: ON_AD for instant forms)'
      }
    },
    'OUTCOME_APP_PROMOTION': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['APP_INSTALLS', 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'VALUE', 'IMPRESSIONS'],
        description: 'Optimization goal (default: APP_INSTALLS for installs, VALUE for in-app events)'
      },
      billing_event: {
        type: 'string',
        enum: ['APP_INSTALLS', 'LINK_CLICKS', 'IMPRESSIONS'],
        description: 'Billing event (default: APP_INSTALLS, matches optimization goal)'
      },
      promoted_object: {
        type: 'object',
        description: 'REQUIRED: App details for promotion',
        properties: {
          application_id: { type: 'string', description: 'REQUIRED: Mobile app ID' },
          object_store_url: { type: 'string', description: 'REQUIRED: App store URL (iOS App Store or Google Play)' }
        },
        required: ['application_id', 'object_store_url']
      },
      destination_type: {
        type: 'string',
        enum: ['APP'],
        description: 'Destination type (always APP for app promotion)'
      }
    },
    'OUTCOME_SALES': {
      ...baseParams,
      optimization_goal: {
        type: 'string',
        enum: ['OFFSITE_CONVERSIONS', 'CONVERSIONS', 'VALUE', 'IMPRESSIONS'],
        description: 'Optimization goal (default: OFFSITE_CONVERSIONS for purchases, VALUE for revenue optimization)'
      },
      billing_event: {
        type: 'string',
        enum: ['IMPRESSIONS', 'PURCHASE'],
        description: 'Billing event (default: IMPRESSIONS)'
      },
      promoted_object: {
        type: 'object',
        description: 'REQUIRED: Pixel and event tracking for sales',
        properties: {
          pixel_id: { type: 'string', description: 'REQUIRED: Facebook pixel ID for conversion tracking' },
          custom_event_type: { type: 'string', description: 'Conversion event (default: PURCHASE, also: ADD_TO_CART, INITIATE_CHECKOUT)' }
        },
        required: ['pixel_id']
      },
      destination_type: {
        type: 'string',
        enum: ['WEBSITE', 'MESSENGER', 'WHATSAPP', 'SHOP_AUTOMATIC'],
        description: 'Sales destination (default: WEBSITE)'
      }
    }
  };

  return config[objective] || config['OUTCOME_AWARENESS']; // Default fallback
};

/**
 * Tool configuration for creating Facebook ad sets with dynamic parameters
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create-ad-set',
      description: 'Create a Facebook ad set with dynamic optimization based on campaign objective. Select campaign_objective first to see relevant parameters for that objective type.',
      parameters: {
        type: 'object',
        properties: getParametersForObjective('OUTCOME_AWARENESS'), // Default to show awareness parameters
        required: ['account_id', 'campaign_id', 'campaign_objective']
      }
    }
  }
};

// Alternative tool definitions for each specific objective (for better UX)
const createObjectiveSpecificTool = (objective) => {
  const config = {
    'OUTCOME_AWARENESS': {
      name: 'create-ad-set-awareness',
      description: 'Create a Facebook ad set for AWARENESS campaigns (brand awareness, reach). Optimizes for maximum reach and brand recall.'
    },
    'OUTCOME_TRAFFIC': {
      name: 'create-ad-set-traffic',
      description: 'Create a Facebook ad set for TRAFFIC campaigns. Drives clicks to websites, apps, or other destinations.'
    },
    'OUTCOME_ENGAGEMENT': {
      name: 'create-ad-set-engagement',
      description: 'Create a Facebook ad set for ENGAGEMENT campaigns. Optimizes for likes, comments, shares, page likes, or event responses.'
    },
    'OUTCOME_LEADS': {
      name: 'create-ad-set-leads',
      description: 'Create a Facebook ad set for LEADS campaigns. Collects leads through instant forms, website conversions, or messaging.'
    },
    'OUTCOME_APP_PROMOTION': {
      name: 'create-ad-set-app-promotion',
      description: 'Create a Facebook ad set for APP PROMOTION campaigns. Drives mobile app installs and engagement.'
    },
    'OUTCOME_SALES': {
      name: 'create-ad-set-sales',
      description: 'Create a Facebook ad set for SALES campaigns. Optimizes for purchases and revenue conversions.'
    }
  };

  const objConfig = config[objective];
  const parameters = getParametersForObjective(objective);
  
  // Remove campaign_objective from parameters since it's implied
  const { campaign_objective, ...parametersWithoutObjective } = parameters;
  
  return {
    function: (params) => executeFunction({ ...params, campaign_objective: objective }),
    definition: {
      type: 'function',
      function: {
        name: objConfig.name,
        description: objConfig.description,
        parameters: {
          type: 'object',
          properties: parametersWithoutObjective,
          required: ['account_id', 'campaign_id']
        }
      }
    }
  };
};

// Export main tool and objective-specific tools
export { 
  apiTool,
  // Individual objective tools for better UX
  createObjectiveSpecificTool
};