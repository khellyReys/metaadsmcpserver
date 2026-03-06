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
import { getBaseUrl, resolveToken, getCampaignInfo, buildTargeting, convertPesosToCents, locationMap, genderMap, locationEnum, clean } from './_shared-helpers.js';

const executeFunction = async ({
    account_id,
    campaign_id,
    name = null,
    conversion_location = 'message_destinations',
    performance_goal = 'maximize_conversations',
    application_id,
    page_id,
    pixel_id = null,
  
    cost_per_result_goal = null,
    bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
    bid_amount = 2.5,
  
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
  
    custom_event_type = null,
  
    status = 'ACTIVE',
  }) => {
    const ENGAGEMENT_CONFIG = {
      objective: 'OUTCOME_ENGAGEMENT',
      billingEvent: 'IMPRESSIONS',
      defaultName: (loc, goal) =>
        `Engagement ${loc} ${goal} ${new Date().toISOString().split('T')[0]}`,
  
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
          validOptimizationGoals: [
            'POST_ENGAGEMENT',
            'THRUPLAY',
            'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
          ],
          requiredFields: ['page_id'],
        },
        calls: {
          validPerformanceGoals: ['maximize_calls', 'cost_per_call'],
          validOptimizationGoals: ['QUALITY_CALL'],
          requiredFields: ['page_id'],
        },
        website: {
          validPerformanceGoals: ['link_clicks', 'landing_page_views', 'post_engagement'],
          validOptimizationGoals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'POST_ENGAGEMENT'],
          requiredFields: [],
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
        },
      },
  
      performanceGoals: {
        maximize_conversations: 'CONVERSATIONS',
        cost_per_conversation: 'CONVERSATIONS',
        post_engagement: 'POST_ENGAGEMENT',
        video_views: 'THRUPLAY',
        thruplay: 'THRUPLAY',
        two_second_continuous_video_views: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
        maximize_calls: 'QUALITY_CALL',
        cost_per_call: 'QUALITY_CALL',
        link_clicks: 'LINK_CLICKS',
        landing_page_views: 'LANDING_PAGE_VIEWS',
      },
    };
  
    const buildPromotedObject = () => ({
      ...(page_id ? { page_id } : {}),
      ...(pixel_id ? { pixel_id } : {}),
      ...(application_id ? { application_id } : {}),
      ...(custom_event_type ? { custom_event_type } : {}),
    });
  
    const baseUrl = getBaseUrl();
  
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
  
    if (!locationConfig.validPerformanceGoals.includes(performance_goal)) {
      return {
        error: `Invalid performance_goal "${performance_goal}" for conversion location "${conversion_location}". Valid options: ${locationConfig.validPerformanceGoals.join(
          ', '
        )}`,
      };
    }
  
    for (const field of locationConfig.requiredFields) {
      if (field === 'page_id' && !page_id) {
        return { error: `page_id is required for conversion location "${conversion_location}"` };
      }
      if (field === 'application_id' && !application_id) {
        return { error: `application_id is required for conversion location "${conversion_location}"` };
      }
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
    } else {
      return { error: 'budget_type must be either "daily_budget" or "lifetime_budget"' };
    }
  
    try {
      const { token } = await resolveToken(account_id);
  
      const campaignInfo = await getCampaignInfo(campaign_id, token);
  
      const adSetName = name || ENGAGEMENT_CONFIG.defaultName(conversion_location, performance_goal);
      const optimization_goal = ENGAGEMENT_CONFIG.performanceGoals[performance_goal];
      const builtTargeting = buildTargeting({ location, age_min, age_max, gender, custom_audience_id });
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
  
      if (locationConfig.destinationType) {
        adSetParams.destination_type = locationConfig.destinationType;
      }
  
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
  
      // Engagement-specific bid strategy normalization
      const normalizeBidStrategy = (v) => {
        const s = String(v || '').toLowerCase().replace(/\s+/g, '');
        if (s.includes('withbidcap') || s.includes('cap')) return 'LOWEST_COST_WITH_BID_CAP';
        if (s.includes('costcap')) return 'COST_CAP';
        if (s.includes('minroas') || s.includes('roas')) return 'LOWEST_COST_WITH_MIN_ROAS';
        if (s.includes('targetcost')) return 'TARGET_COST';
        return 'LOWEST_COST_WITHOUT_CAP';
      };

      const strategy = normalizeBidStrategy(bid_strategy);

      if (strategy === 'LOWEST_COST_WITHOUT_CAP') {
        delete adSetParams.bid_strategy;
        delete adSetParams.bid_amount;
      } else {
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

      if (
        Object.prototype.hasOwnProperty.call(adSetParams, 'bid_amount') &&
        (adSetParams.bid_amount === '' || adSetParams.bid_amount === '0' || Number(adSetParams.bid_amount) <= 0)
      ) {
        delete adSetParams.bid_amount;
      }
  
      adSetParams.targeting = JSON.stringify(builtTargeting);
      adSetParams.promoted_object = JSON.stringify(builtPromotedObject);
  
      const cleanedParams = clean(adSetParams);
      const body = new URLSearchParams(cleanedParams);
  
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
  
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create_ad_set_engagement',
        description:
          'Create a Facebook ad set for ENGAGEMENT campaigns. Supports conversion locations (MESSAGING, WEBSITE, APP, PAGE) with validation of required fields per location. Optimizes for post engagement, page likes, event responses, or messaging conversations. Handles targeting, budgets, scheduling, and bid strategy. The account_id and page_id are auto-filled from server workspace if not provided.',
        parameters: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Ad account ID (without act_)' },
            campaign_id: { type: 'string', description: 'Parent campaign ID (OUTCOME_ENGAGEMENT)' },
            name: { type: 'string', description: 'Ad set name' },
  
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
  
            performance_goal: {
              type: 'string',
              enum: [
                'maximize_conversations',
                'cost_per_conversation',
                'post_engagement',
                'video_views',
                'thruplay',
                'two_second_continuous_video_views',
                'maximize_calls',
                'cost_per_call',
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
  
          required: [
            'account_id',
            'campaign_id',
            'conversion_location',
            'performance_goal',
            'page_id',
          ],
  
          allOf: [
            {
              if: { properties: { conversion_location: { const: 'app' } } },
              then: { required: ['application_id'] }
            },
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
            {
              if: { properties: { detailed_targeting: { const: 'custom' } } },
              then: { required: ['custom_audience_id'] }
            },
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
