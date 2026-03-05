/**
 * MCP Tool for creating Facebook campaigns for engagement/conversations
 */
import { getBaseUrl, normalizeAccountId, resolveToken, clean } from './_shared-helpers.js';

/**
 * Create a Facebook campaign for driving conversations/engagement
 */
const executeFunction = async ({ 
  account_id, 
  name,
  objective,
  status = 'ACTIVE',
  special_ad_categories = ['NONE'],
  buying_type = 'AUCTION',
  bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
  daily_budget = 50000,
  lifetime_budget = null,
  campaign_budget_optimization = true
}) => {
  const baseUrl = getBaseUrl();

  // Validate required params
  if (!account_id) {
    return { 
      error: 'Missing required parameter: account_id' 
    };
  }

  if (!objective) {
    return { 
      error: 'Missing required parameter: objective. Please choose from: OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_APP_PROMOTION' 
    };
  }

  // Validate objective is one of the allowed values
  const validObjectives = [
    'OUTCOME_ENGAGEMENT', 
    'OUTCOME_LEADS', 
    'OUTCOME_SALES', 
    'OUTCOME_AWARENESS', 
    'OUTCOME_TRAFFIC', 
    'OUTCOME_APP_PROMOTION'
  ];
  
  if (!validObjectives.includes(objective)) {
    return {
      error: `Invalid objective: ${objective}. Must be one of: ${validObjectives.join(', ')}`
    };
  }

  // Normalize the objective (trim whitespace)
  const normalizedObjective = objective.trim();

  if (campaign_budget_optimization === true) {
    const hasLifetime = Number(lifetime_budget) > 0;
    const hasDaily = Number(daily_budget) > 0;
  
    if (!hasLifetime && !hasDaily) {
      return {
        error: 'Validation error: When campaign_budget_optimization is true, you must provide either lifetime_budget or daily_budget (> 0).',
        details: { campaign_budget_optimization, daily_budget, lifetime_budget }
      };
    }
  }

  try {
    const { token } = await resolveToken(account_id);

    // Generate campaign name with timestamp if not provided
    const campaignName = name || `Campaign ${normalizedObjective} ${new Date().toISOString()}`;
    
    // Calculate stop_time (7 days from now)
    const stopTime = new Date();
    stopTime.setDate(stopTime.getDate() + 7);

    const acctId = normalizeAccountId(account_id);
    const url = `${baseUrl}/act_${acctId}/campaigns`;

    const campaignParams = {
      name: campaignName,
      objective: normalizedObjective,
      status,
      buying_type,
      stop_time: stopTime.toISOString(),
      access_token: token
    };

    // Handle special_ad_categories
    const specialAdCategoriesForApi =
    Array.isArray(special_ad_categories) && special_ad_categories.length > 0
      ? JSON.stringify(special_ad_categories)
      : JSON.stringify(['NONE']);
    campaignParams.special_ad_categories = specialAdCategoriesForApi;

    // Campaign Budget Optimization (CBO) Logic
    if (campaign_budget_optimization) {
      campaignParams.bid_strategy = bid_strategy;
      if (lifetime_budget && Number(lifetime_budget) > 0) {
        campaignParams.lifetime_budget = String(lifetime_budget);
      } else if (daily_budget && Number(daily_budget) > 0) {
        campaignParams.daily_budget = String(daily_budget);
      }
    }

    const cleanedParams = clean(campaignParams);
    const body = new URLSearchParams(cleanedParams);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook API error:', errorData);
      return { 
        error: `Campaign creation failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData 
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      campaign: result,
      account_id,
      objective_used: normalizedObjective,
      budget_optimization: {
        cbo_enabled: campaign_budget_optimization,
        budget_level: campaign_budget_optimization ? 'campaign' : 'ad_set',
        budget_type: lifetime_budget && campaign_budget_optimization ? 'lifetime' : 'daily',
        budget_amount: campaign_budget_optimization ? (lifetime_budget || daily_budget) : null
      },
    };
  } catch (error) {
    console.error('Error in executeFunction:', error);
    return { 
      error: 'An error occurred while creating the campaign.',
      details: error.message 
    };
  }
};

/**
 * Tool configuration for creating Facebook engagement campaigns
 * Definition is kept pure with no Node-only dependencies
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_campaign',
      description: 'Create a Facebook campaign with the specified objective. Choose the appropriate objective based on your campaign goals.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'Facebook ad account ID (without act_ prefix) - automatically provided from MCP context'
          },
          objective: {
            type: 'string',
            enum: [
              'OUTCOME_ENGAGEMENT', 
              'OUTCOME_LEADS', 
              'OUTCOME_SALES', 
              'OUTCOME_AWARENESS', 
              'OUTCOME_TRAFFIC', 
              'OUTCOME_APP_PROMOTION'
            ],
            description: 'REQUIRED: Campaign objective. OUTCOME_ENGAGEMENT for messages/conversations, OUTCOME_LEADS for lead generation, OUTCOME_SALES for conversions, OUTCOME_AWARENESS for brand awareness, OUTCOME_TRAFFIC for website visits, OUTCOME_APP_PROMOTION for app installs/engagement'
          },
          name: {
            type: 'string',
            description: 'Campaign name (defaults to "Campaign {objective} {timestamp}")'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED'],
            description: 'Campaign status (default: ACTIVE)'
          },
          special_ad_categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['NONE', 'EMPLOYMENT', 'HOUSING', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS', 'ONLINE_GAMBLING_AND_GAMING', 'FINANCIAL_PRODUCTS_SERVICES']
            },
            description: 'Special ad categories (default: ["NONE"])'
          },
          buying_type: {
            type: 'string',
            enum: ['AUCTION', 'RESERVED'],
            description: 'Buying type (default: AUCTION)'
          },
          bid_strategy: {
            type: 'string',
            enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
            description: 'Bid strategy (default: LOWEST_COST_WITHOUT_CAP)'
          },
          daily_budget: {
            type: 'integer',
            description: 'Daily budget in cents (ex. 50000 cents = 500.00). Used when campaign_budget_optimization is true and no lifetime_budget is set.'
          },
          lifetime_budget: {
            type: 'integer',
            description: 'Lifetime budget in cents. If set and campaign_budget_optimization is true, this overrides daily_budget.'
          },
          campaign_budget_optimization: {
            type: 'boolean',
            description: 'Enable Campaign Budget Optimization (CBO). When true, budget is set at campaign level and Facebook optimizes distribution across ad sets. When false, budgets must be set at ad set level. (default: true)'
          }
        },
        required: ['account_id', 'objective']
      }
    }
  }
};

export { apiTool };
