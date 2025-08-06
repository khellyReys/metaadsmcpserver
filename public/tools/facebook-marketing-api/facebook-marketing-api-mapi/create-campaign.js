/**
 * Function to create a campaign using the Facebook Marketing API v23.0.
 * Provides intelligent defaults based on common usage patterns and best practices.
 *
 * @param {Object} args - Arguments for creating a campaign.
 * @param {string} args.account_id - The ID of the ad account to create the campaign under.
 * @param {string} args.name - The name of the campaign.
 * @param {string} [args.objective="OUTCOME_TRAFFIC"] - The objective of the campaign. Most common objectives: OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS
 * @param {string} [args.status="PAUSED"] - The status of the campaign. Recommended to start PAUSED for safety.
 * @param {Array} [args.special_ad_categories=[]] - Special ad categories for compliance (e.g., ['CREDIT', 'EMPLOYMENT', 'HOUSING']).
 * @param {string} [args.buying_type="AUCTION"] - The buying type for the campaign.
 * @param {string} [args.bid_strategy="LOWEST_COST_WITHOUT_CAP"] - The bid strategy for the campaign.
 * @param {number} [args.daily_budget] - Daily budget in dollars (will be converted to cents).
 * @param {number} [args.lifetime_budget] - Lifetime budget in dollars (will be converted to cents).
 * @param {string} [args.spend_cap] - Spending limit in dollars (will be converted to cents).
 * @param {Object} [args.promoted_object] - Object being promoted (page_id, pixel_id, etc.).
 * @param {boolean} [args.campaign_budget_optimization=false] - Enable campaign budget optimization.
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
    bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
    daily_budget,
    lifetime_budget,
    spend_cap,
    promoted_object,
    campaign_budget_optimization = false,
    access_token
  }) => {
    const baseUrl = 'https://graph.facebook.com/v23.0';
    const token = access_token || process.env.FACEBOOK_MARKETING_API_ACCESS_TOKEN;
  
    // Validation
    if (!account_id) {
      return { success: false, error: 'account_id is required' };
    }
    if (!name) {
      return { success: false, error: 'name is required' };
    }
    if (!token) {
      return { success: false, error: 'Access token is required (env: FACEBOOK_MARKETING_API_ACCESS_TOKEN)' };
    }
  
    try {
      // Construct the URL for the campaign creation
      const url = `${baseUrl}/act_${account_id}/campaigns`;
  
      // Build request body parameters
      const params = new URLSearchParams();
      params.append('name', name);
      params.append('objective', objective);
      params.append('status', status);
      params.append('buying_type', buying_type);
      params.append('bid_strategy', bid_strategy);
      params.append('special_ad_categories', JSON.stringify(special_ad_categories));
      params.append('access_token', token);
  
      // Handle budget parameters (convert dollars to cents)
      if (daily_budget) {
        params.append('daily_budget', (parseFloat(daily_budget) * 100).toString());
      }
      if (lifetime_budget) {
        params.append('lifetime_budget', (parseFloat(lifetime_budget) * 100).toString());
      }
      if (spend_cap) {
        params.append('spend_cap', (parseFloat(spend_cap) * 100).toString());
      }
  
      // Add promoted object if provided
      if (promoted_object) {
        params.append('promoted_object', JSON.stringify(promoted_object));
      }
  
      // Add campaign budget optimization
      if (campaign_budget_optimization) {
        params.append('campaign_budget_optimization', campaign_budget_optimization.toString());
      }
  
      // Set up headers for the request
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
  
      // Perform the fetch request
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params
      });
  
      // Parse response
      const data = await response.json();
  
      // Check if the response was successful
      if (!response.ok) {
        console.error('Error creating campaign:', JSON.stringify(data, null, 2));
        return { 
          success: false, 
          error: data,
          status: response.status,
          message: data.error?.message || 'Failed to create campaign'
        };
      }
  
      // Success response
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
   * Provides intelligent defaults based on campaign objective and other inputs
   */
  const suggestCampaignParameters = (userInput) => {
    const suggestions = {};
  
    // Objective-based suggestions
    const objectiveDefaults = {
      'OUTCOME_TRAFFIC': {
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION'
      },
      'OUTCOME_SALES': {
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION',
        promoted_object: { pixel_id: 'RECOMMENDED' } // User should replace with actual pixel
      },
      'OUTCOME_LEADS': {
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION'
      },
      'OUTCOME_ENGAGEMENT': {
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION'
      },
      'OUTCOME_AWARENESS': {
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION'
      }
    };
  
    if (userInput.objective && objectiveDefaults[userInput.objective]) {
      Object.assign(suggestions, objectiveDefaults[userInput.objective]);
    }
  
    // Budget-based suggestions
    if (userInput.daily_budget) {
      const dailyBudget = parseFloat(userInput.daily_budget);
      if (dailyBudget >= 100) {
        suggestions.bid_strategy = 'LOWEST_COST_WITH_BID_CAP';
        suggestions.campaign_budget_optimization = true;
      }
    }
  
    // Smart campaign naming if not provided
    if (!userInput.name) {
      const objective = userInput.objective || 'TRAFFIC';
      const date = new Date().toISOString().split('T')[0];
      suggestions.name = `${objective.replace('OUTCOME_', '')} Campaign - ${date}`;
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
        name: 'create_campaign_test',
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