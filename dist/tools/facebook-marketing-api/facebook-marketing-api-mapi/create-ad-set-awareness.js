/**
 * MCP Tool for creating Facebook ad sets - AWARENESS campaigns only
 * Optimized for brand awareness, reach, and ad recall campaigns
 */
import { getBaseUrl, resolveToken, getCampaignInfo, buildTargeting, convertPesosToCents, locationMap, genderMap, locationEnum, clean } from './_shared-helpers.js';

const executeFunction = async ({ 
  account_id,
  campaign_id,
  name = null,
  optimization_goal = 'REACH',
  page_id,
  
  cost_per_result_goal = null,
  bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
  bid_amount = null,
  
  target_frequency = 2,
  frequency_cap = '2 times every 7 days',
  
  dynamic_creative = false,
  
  budget_type = 'daily_budget',
  daily_budget = 500,
  lifetime_budget = null,
  start_time = null,
  end_time = null,
  
  location = 'PH',
  age_min = 18,
  age_max = 65,
  gender = 'all',
  detailed_targeting = 'all',
  custom_audience_id = null,
  
  status = 'ACTIVE',
  billing_event = 'IMPRESSIONS',
  targeting = null,
  promoted_object = null,
  attribution_spec = null
}) => {
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
  };

  const buildFrequencyControl = () => {
    let frequencyControlObj;
    
    if (frequency_cap && AWARENESS_CONFIG.frequencyCapOptions[frequency_cap]) {
      frequencyControlObj = AWARENESS_CONFIG.frequencyCapOptions[frequency_cap];
    } else {
      frequencyControlObj = {
        event: 'IMPRESSIONS',
        interval_days: 7,
        max_frequency: target_frequency || 2
      };
    }
    
    return [frequencyControlObj];
  };

  const baseUrl = getBaseUrl();
  
  if (!account_id) {
    return { error: 'Missing required parameter: account_id' };
  }

  if (!campaign_id) {
    return { error: 'Missing required parameter: campaign_id' };
  }

  if (!page_id) {
    return { error: 'Missing required parameter: page_id (Facebook Page ID is required for awareness campaigns)' };
  }

  if (!AWARENESS_CONFIG.validOptimizationGoals.includes(optimization_goal)) {
    return {
      error: `Invalid optimization_goal "${optimization_goal}" for awareness campaigns. Valid options: ${AWARENESS_CONFIG.validOptimizationGoals.join(', ')}`
    };
  }

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

  if (detailed_targeting === 'custom' && !custom_audience_id) {
    return { error: 'custom_audience_id is required when detailed_targeting is "custom"' };
  }

  try {
    const { token } = await resolveToken(account_id);

    const campaignInfo = await getCampaignInfo(campaign_id, token);

    const adSetName = name || AWARENESS_CONFIG.defaultName(optimization_goal);

    const builtTargeting = targeting || buildTargeting({ location, age_min, age_max, gender, custom_audience_id });

    const builtPromotedObject = promoted_object || { page_id };

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

    if (campaignInfo.cboEnabled) {
      // Campaign has CBO enabled - no budget at ad set level
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

    if (cost_per_result_goal && cost_per_result_goal > 0) {
      const costPerResultCents = convertPesosToCents(cost_per_result_goal);
      adSetParams.bid_amount = String(costPerResultCents);
    } else if (bid_amount && bid_amount > 0) {
      const bidAmountCents = convertPesosToCents(bid_amount);
      adSetParams.bid_amount = String(bidAmountCents);
    }

    adSetParams.bid_strategy = bid_strategy;

    if (dynamic_creative) {
      adSetParams.is_dynamic_creative = dynamic_creative;
    }

    adSetParams.targeting = JSON.stringify(builtTargeting);
    adSetParams.promoted_object = JSON.stringify(builtPromotedObject);
    adSetParams.frequency_control_specs = JSON.stringify(frequencyControlSpecs);

    if (attribution_spec) {
      adSetParams.attribution_spec = JSON.stringify(attribution_spec);
    }

    const cleanedParams = clean(adSetParams);
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
        error: `Awareness ad set creation failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData 
      };
    }

    const result = await response.json();
    
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
    console.error('Error in executeFunction:', error);
    return { 
      error: 'An error occurred while creating the awareness ad set.',
      details: error.message 
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_ad_set_awareness',
      description: 'Create a Facebook ad set for AWARENESS campaigns. Optimized for brand awareness, reach, and ad recall with comprehensive parameter control.',
      parameters: {
        type: 'object',
        properties: {
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

          target_frequency: {
            type: 'integer',
            description: 'Average number of times people see the ad (default: 2)'
          },
          frequency_cap: {
            type: 'string',
            enum: ['1 times every 7 days', '2 times every 7 days', '3 times every 7 days', '1 times every 1 days', '2 times every 1 days'],
            description: 'Maximum frequency cap (default: "2 times every 7 days")'
          },

          dynamic_creative: {
            type: 'boolean',
            description: 'Enable dynamic creative (default: false/Off)'
          },

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
