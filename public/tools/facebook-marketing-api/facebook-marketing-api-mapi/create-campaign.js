/**
 * Function to create a campaign using the Facebook Marketing API v22.0+.
 * Based on official Meta documentation with accurate parameters and validation.
 *
 * @param {Object} args - Arguments for creating a campaign.
 * @param {string} args.account_id - The ID of the ad account to create the campaign under.
 * @param {string} args.name - The name of the campaign.
 * @param {string} [args.objective="OUTCOME_TRAFFIC"] - Campaign objective from the new outcome-driven experiences.
 * @param {string} [args.status="PAUSED"] - Campaign status. PAUSED is recommended for initial creation.
 * @param {Array} [args.special_ad_categories=[]] - REQUIRED: Special ad categories for compliance.
 * @param {string} [args.buying_type="AUCTION"] - Buying type: AUCTION or RESERVED.
 * @param {string} [args.bid_strategy] - Bid strategy when using campaign budget optimization.
 * @param {number} [args.daily_budget] - Daily budget in dollars (converted to cents - minimum $1.00).
 * @param {number} [args.lifetime_budget] - Lifetime budget in dollars (converted to cents - minimum $1.00).
 * @param {number} [args.spend_cap] - Spending limit in dollars (converted to cents - minimum $100.00).
 * @param {Object} [args.promoted_object] - Object being promoted (required for some objectives).
 * @param {boolean} [args.is_skadnetwork_attribution=false] - Enable for iOS 14+ app promotion campaigns.
 * @param {string} [args.access_token] - Override token (uses env var if not provided).
 * @returns {Promise<Object>} - The result of the campaign creation with success/error status.
 */
const executeFunction = async ({ 
    account_id, 
    name, 
    objective = 'OUTCOME_TRAFFIC', 
    status = 'PAUSED',
    special_ad_categories = [], 
    buying_type = 'AUCTION',
    bid_strategy,
    daily_budget,
    lifetime_budget,
    spend_cap,
    promoted_object,
    is_skadnetwork_attribution = false,
    optimization_goal, // For AI suggestions
    destination_type,  // For AI suggestions
    access_token
  }) => {
    const baseUrl = 'https://graph.facebook.com/v22.0';
    const token = access_token || process.env.FACEBOOK_MARKETING_API_ACCESS_TOKEN;
  
    // Validation based on official API requirements
    if (!account_id) {
      return { success: false, error: 'account_id is required' };
    }
    if (!name) {
      return { success: false, error: 'name is required' };
    }
    if (!token) {
      return { success: false, error: 'Access token is required (env: FACEBOOK_MARKETING_API_ACCESS_TOKEN)' };
    }
  
    // Validate objective (from official docs)
    const validObjectives = [
      'APP_INSTALLS', 'BRAND_AWARENESS', 'CONVERSIONS', 'EVENT_RESPONSES', 
      'LEAD_GENERATION', 'LINK_CLICKS', 'LOCAL_AWARENESS', 'MESSAGES', 
      'OFFER_CLAIMS', 'OUTCOME_APP_PROMOTION', 'OUTCOME_AWARENESS', 
      'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_TRAFFIC', 
      'PAGE_LIKES', 'POST_ENGAGEMENT', 'PRODUCT_CATALOG_SALES', 'REACH', 
      'STORE_VISITS', 'VIDEO_VIEWS'
    ];
    
    if (!validObjectives.includes(objective)) {
      return { 
        success: false, 
        error: `Invalid objective. Must be one of: ${validObjectives.join(', ')}` 
      };
    }
  
    // Validate bid_strategy (from official docs)
    if (bid_strategy) {
      const validBidStrategies = [
        'LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 
        'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'
      ];
      if (!validBidStrategies.includes(bid_strategy)) {
        return { 
          success: false, 
          error: `Invalid bid_strategy. Must be one of: ${validBidStrategies.join(', ')}` 
        };
      }
    }
  
    // Validate spend_cap minimum ($100 USD from docs)
    if (spend_cap && spend_cap < 100) {
      return { 
        success: false, 
        error: 'spend_cap must be at least $100.00' 
      };
    }
  
    try {
      const url = `${baseUrl}/act_${account_id}/campaigns`;
  
      // Build request body parameters according to official API
      const params = new URLSearchParams();
      params.append('name', name);
      params.append('objective', objective);
      params.append('status', status);
      params.append('buying_type', buying_type);
      params.append('special_ad_categories', JSON.stringify(special_ad_categories));
      params.append('access_token', token);
  
      // Add optional bid strategy (only for campaign budget optimization)
      if (bid_strategy) {
        params.append('bid_strategy', bid_strategy);
      }
  
      // Handle budget parameters (convert dollars to cents, minimum $1.00)
      if (daily_budget) {
        if (daily_budget < 1.0) {
          return { success: false, error: 'daily_budget must be at least $1.00' };
        }
        params.append('daily_budget', Math.round(parseFloat(daily_budget) * 100).toString());
      }
      
      if (lifetime_budget) {
        if (lifetime_budget < 1.0) {
          return { success: false, error: 'lifetime_budget must be at least $1.00' };
        }
        params.append('lifetime_budget', Math.round(parseFloat(lifetime_budget) * 100).toString());
      }
      
      if (spend_cap) {
        params.append('spend_cap', Math.round(parseFloat(spend_cap) * 100).toString());
      }
  
      // Add promoted object if provided (required for some objectives)
      if (promoted_object) {
        params.append('promoted_object', JSON.stringify(promoted_object));
      }
  
      // Add iOS 14+ SKAdNetwork attribution
      if (is_skadnetwork_attribution) {
        params.append('is_skadnetwork_attribution', 'true');
      }
  
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
  
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error('Error creating campaign:', JSON.stringify(data, null, 2));
        return { 
          success: false, 
          error: data,
          status: response.status,
          message: data.error?.message || 'Failed to create campaign'
        };
      }
  
      console.log('Campaign created successfully:', data);
      return { 
        success: true, 
        data,
        campaign_id: data.id,
        message: `Campaign "${name}" created successfully with ID: ${data.id}`
      };
  
    } catch (error) {
      console.error('Network error creating campaign:', error);
      return { 
        success: false, 
        error: error.message || 'An error occurred while creating the campaign.',
        type: 'network_error'
      };
    }
  };
  
  /**
   * AI-powered parameter suggestion function
   * Based on official Facebook Marketing API objective mapping table
   */
  const suggestCampaignParameters = (userInput) => {
    const suggestions = {};
  
    // Official objective mapping from Facebook docs
    const objectiveMapping = {
      // New Outcome-Driven Experiences
      'OUTCOME_TRAFFIC': {
        destination_types: {
          'WEBSITE': { optimization_goals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS'] },
          'APP': { optimization_goals: ['LINK_CLICKS', 'REACH', 'IMPRESSIONS'], promoted_object: { application_id: 'REQUIRED', object_store_url: 'REQUIRED' } },
          'MESSENGER': { optimization_goals: ['LINK_CLICKS', 'REACH', 'IMPRESSIONS'] },
          'WHATSAPP': { optimization_goals: ['LINK_CLICKS', 'REACH', 'IMPRESSIONS'], promoted_object: { page_id: 'REQUIRED' } },
          'PHONE_CALL': { optimization_goals: ['QUALITY_CALL', 'LINK_CLICKS'] }
        }
      },
      
      'OUTCOME_SALES': {
        destination_types: {
          'WEBSITE': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS'], promoted_object: { pixel_id: 'REQUIRED', custom_event_type: 'REQUIRED' } },
          'APP': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH'], promoted_object: { application_id: 'REQUIRED', object_store_url: 'REQUIRED' } },
          'MESSENGER': { optimization_goals: ['CONVERSATIONS'], promoted_object: { page_id: 'REQUIRED', pixel_id: 'REQUIRED', custom_event_type: 'REQUIRED' } },
          'PHONE_CALL': { optimization_goals: ['QUALITY_CALL'], promoted_object: { page_id: 'REQUIRED' } }
        }
      },
      
      'OUTCOME_LEADS': {
        destination_types: {
          'WEBSITE': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS'], promoted_object: { pixel_id: 'REQUIRED', custom_event_type: 'REQUIRED' } },
          'APP': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH'], promoted_object: { application_id: 'REQUIRED', object_store_url: 'REQUIRED' } },
          'ON_AD': { optimization_goals: ['LEAD_GENERATION', 'QUALITY_LEAD'], promoted_object: { page_id: 'REQUIRED' } },
          'MESSENGER': { optimization_goals: ['LEAD_GENERATION'], promoted_object: { page_id: 'REQUIRED' } },
          'INSTAGRAM_DIRECT': { optimization_goals: ['LEAD_GENERATION'], promoted_object: { page_id: 'REQUIRED' } },
          'PHONE_CALL': { optimization_goals: ['QUALITY_CALL'], promoted_object: { page_id: 'REQUIRED' } }
        }
      },
      
      'OUTCOME_ENGAGEMENT': {
        destination_types: {
          'WEBSITE': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH', 'IMPRESSIONS'], promoted_object: { pixel_id: 'REQUIRED', custom_event_type: 'REQUIRED' } },
          'APP': { optimization_goals: ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'REACH'], promoted_object: { application_id: 'REQUIRED', object_store_url: 'REQUIRED' } },
          'ON_POST': { optimization_goals: ['POST_ENGAGEMENT', 'REACH', 'IMPRESSIONS'] },
          'ON_PAGE': { optimization_goals: ['PAGE_LIKES'], promoted_object: { page_id: 'REQUIRED' } },
          'ON_EVENT': { optimization_goals: ['EVENT_RESPONSES', 'POST_ENGAGEMENT', 'REACH', 'IMPRESSIONS'] },
          'ON_VIDEO': { optimization_goals: ['THRUPLAY', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'] },
          'MESSENGER': { optimization_goals: ['CONVERSATIONS', 'LINK_CLICKS'], promoted_object: { page_id: 'REQUIRED' } }
        }
      },
      
      'OUTCOME_AWARENESS': {
        destination_types: {
          'BRAND': { optimization_goals: ['AD_RECALL_LIFT', 'REACH', 'IMPRESSIONS'], promoted_object: { page_id: 'REQUIRED' } },
          'VIDEO': { optimization_goals: ['THRUPLAY', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'], promoted_object: { page_id: 'REQUIRED' } },
          'STORE_VISITS': { optimization_goals: ['REACH'], promoted_object: { place_page_set_id: 'REQUIRED' } }
        }
      },
  
      'OUTCOME_APP_PROMOTION': {
        destination_types: {
          'APP_INSTALLS': { optimization_goals: ['LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'APP_INSTALLS'], promoted_object: { application_id: 'REQUIRED', object_store_url: 'REQUIRED' } }
        }
      },
  
      // Legacy objectives (still supported)
      'CONVERSIONS': {
        destination_types: {
          'WEBSITE': { optimization_goals: ['OFFSITE_CONVERSIONS'], promoted_object: { pixel_id: 'REQUIRED', custom_event_type: 'REQUIRED' } }
        }
      },
      
      'MESSAGES': {
        destination_types: {
          'MESSENGER': { optimization_goals: ['CONVERSATIONS'], promoted_object: { page_id: 'REQUIRED' } }
        }
      }
    };
  
    // If user specifies optimization goal and destination type, suggest matching objective
    if (userInput.optimization_goal && userInput.destination_type) {
      for (const [objective, config] of Object.entries(objectiveMapping)) {
        const destConfig = config.destination_types[userInput.destination_type];
        if (destConfig && destConfig.optimization_goals.includes(userInput.optimization_goal)) {
          suggestions.objective = objective;
          if (destConfig.promoted_object) {
            suggestions.promoted_object = destConfig.promoted_object;
          }
          break;
        }
      }
    }
    // If user specifies objective, suggest compatible optimization goals and promoted objects
    else if (userInput.objective && objectiveMapping[userInput.objective]) {
      const objConfig = objectiveMapping[userInput.objective];
      const firstDestType = Object.keys(objConfig.destination_types)[0];
      const firstDestConfig = objConfig.destination_types[firstDestType];
      
      suggestions.optimization_goal = firstDestConfig.optimization_goals[0]; // Suggest first option
      suggestions.destination_type = firstDestType;
      
      if (firstDestConfig.promoted_object) {
        suggestions.promoted_object = firstDestConfig.promoted_object;
      }
    }
  
    // Handle specific case: optimization = CONVERSATIONS, destination = MESSENGER
    if (userInput.optimization_goal === 'CONVERSATIONS' && userInput.destination_type === 'MESSENGER') {
      suggestions.objective = 'OUTCOME_SALES'; // or OUTCOME_ENGAGEMENT
      suggestions.promoted_object = { page_id: 'REQUIRED - Replace with your page ID' };
    }
  
    // Budget-based bid strategy suggestions
    if (userInput.daily_budget || userInput.lifetime_budget) {
      const budget = userInput.daily_budget || (userInput.lifetime_budget / 30);
      if (budget >= 50) {
        suggestions.bid_strategy = 'LOWEST_COST_WITH_BID_CAP';
      } else {
        suggestions.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
      }
    }
  
    // Smart campaign naming
    if (!userInput.name) {
      const objective = userInput.objective || suggestions.objective || 'TRAFFIC';
      const destination = userInput.destination_type || suggestions.destination_type || '';
      const date = new Date().toISOString().split('T')[0];
      suggestions.name = `${objective.replace('OUTCOME_', '')}${destination ? ` ${destination}` : ''} Campaign - ${date}`;
    }
  
    // Special ad categories compliance
    if (!userInput.special_ad_categories || userInput.special_ad_categories.length === 0) {
      const campaignText = (userInput.name || suggestions.name || '').toLowerCase();
      const specialCategories = [];
      
      if (campaignText.includes('credit') || campaignText.includes('loan') || campaignText.includes('financial')) {
        specialCategories.push('CREDIT');
      }
      if (campaignText.includes('job') || campaignText.includes('employment') || campaignText.includes('hiring')) {
        specialCategories.push('EMPLOYMENT');
      }
      if (campaignText.includes('housing') || campaignText.includes('real estate') || campaignText.includes('rent')) {
        specialCategories.push('HOUSING');
      }
      if (campaignText.includes('election') || campaignText.includes('political') || campaignText.includes('voting')) {
        specialCategories.push('ISSUES_ELECTIONS_POLITICS');
      }
      
      suggestions.special_ad_categories = specialCategories.length > 0 ? specialCategories : [];
    }
  
    // iOS attribution for app campaigns
    if (suggestions.objective === 'OUTCOME_APP_PROMOTION' || userInput.objective === 'APP_INSTALLS') {
      suggestions.is_skadnetwork_attribution = true;
    }
  
    return suggestions;
  };
  
  /**
   * Enhanced campaign creation with AI suggestions
   */
  const createCampaignWithAI = async (userParams = {}, options = {}) => {
    // Get AI suggestions
    const aiSuggestions = suggestCampaignParameters(userParams);
    
    // Merge parameters: AI suggestions + user params (user takes priority)
    const finalParams = { ...aiSuggestions, ...userParams };
  
    if (options.showAISuggestions) {
      console.log('AI Suggested Parameters:', aiSuggestions);
      console.log('Final Parameters:', finalParams);
    }
  
    return executeFunction(finalParams);
  };
  
  /**
   * Tool configuration for creating a campaign using the Facebook Marketing API.
   * @type {Object}
   */
  const apiTool = {
    function: executeFunction,
    enhancedFunction: createCampaignWithAI,
    suggestParameters: suggestCampaignParameters,
    definition: {
      type: 'function',
      function: {
        name: 'create_campaign',
        description: 'Create a campaign using the Facebook Marketing API v23.0 with intelligent defaults and best practices.',
        parameters: {
          type: 'object',
          properties: {
            account_id: {
              type: 'string',
              description: 'The ID of the ad account to create the campaign under (format: without act_ prefix).'
            },
            name: {
              type: 'string',
              description: 'The name of the campaign.'
            },
            objective: {
              type: 'string',
              description: 'The objective of the campaign.',
              enum: ['OUTCOME_TRAFFIC', 'OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS'],
              default: 'OUTCOME_TRAFFIC'
            },
            status: {
              type: 'string',
              description: 'The status of the campaign.',
              enum: ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'],
              default: 'PAUSED'
            },
            special_ad_categories: {
              type: 'array',
              description: 'Special ad categories for compliance.',
              items: {
                type: 'string',
                enum: ['CREDIT', 'EMPLOYMENT', 'HOUSING', 'NONE']
              },
              default: []
            },
            buying_type: {
              type: 'string',
              description: 'The buying type for the campaign.',
              enum: ['AUCTION', 'RESERVED'],
              default: 'AUCTION'
            },
            bid_strategy: {
              type: 'string',
              description: 'The bid strategy for the campaign.',
              enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'TARGET_COST', 'COST_CAP'],
              default: 'LOWEST_COST_WITHOUT_CAP'
            },
            daily_budget: {
              type: 'number',
              description: 'Daily budget in dollars (will be converted to cents automatically).'
            },
            lifetime_budget: {
              type: 'number',
              description: 'Lifetime budget in dollars (will be converted to cents automatically).'
            },
            spend_cap: {
              type: 'number',
              description: 'Spending limit in dollars (will be converted to cents automatically).'
            },
            promoted_object: {
              type: 'object',
              description: 'Object being promoted (page_id, pixel_id, etc.).',
              properties: {
                page_id: { type: 'string' },
                pixel_id: { type: 'string' },
                application_id: { type: 'string' }
              }
            },
            campaign_budget_optimization: {
              type: 'boolean',
              description: 'Enable campaign budget optimization.',
              default: false
            },
            access_token: {
              type: 'string',
              description: 'Override access token (uses FACEBOOK_MARKETING_API_ACCESS_TOKEN env var if not provided).'
            }
          },
          required: ['account_id', 'name']
        }
      }
    }
  };
  
  export { apiTool };