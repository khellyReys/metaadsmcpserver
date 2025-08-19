/**
 * Function to get detailed campaign information including performance insights from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.campaign_id - The campaign ID to fetch details for.
 * @param {string} args.userId - The user ID to retrieve the Facebook token from Supabase.
 * @param {string} [args.date_preset='last_30d'] - The date preset for insights (e.g., 'today', 'yesterday', 'this_month', 'last_month', 'this_quarter', 'lifetime', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d', 'last_quarter', 'last_year', 'this_week', 'last_week', 'this_year').
 * @param {string} [args.time_increment='all_days'] - The time increment for insights (e.g., 'all_days', 'monthly', 'daily').
 * @param {string} [args.breakdowns=''] - Breakdowns for insights (e.g., 'age,gender', 'placement', 'country', 'publisher_platform').
 * @param {string} [args.action_breakdowns='action_type'] - Action breakdowns for insights.
 * @param {string} [args.base_url='https://graph.facebook.com/v18.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The detailed campaign information including insights.
 */
const executeFunction = async ({ 
  campaign_id, 
  userId, 
  date_preset = 'last_30d', 
  time_increment = 'all_days', 
  breakdowns = '', 
  action_breakdowns = 'action_type',
  base_url = 'https://graph.facebook.com/v18.0' 
}) => {
  // Note: This function requires environment variables to be set
  // SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
  
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const getFacebookToken = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('facebook_long_lived_token')
      .eq('id', userId)
      .single();

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data?.facebook_long_lived_token || null;
  };

  const token = await getFacebookToken(userId);
  if (!token) {
    return {
      error: 'No Facebook access token found for the user',
      details: `User ${userId} has no Facebook token`,
    };
  }

  if (!campaign_id) {
    throw new Error('campaign_id is required');
  }

  try {
    // First, get campaign metadata
    const campaignUrl = `${base_url}/${campaign_id}?fields=id,name,objective,account_id,buying_type,daily_budget,lifetime_budget,spend_cap,bid_strategy,pacing_type,status,effective_status,promoted_object,recommendations,start_time,stop_time,created_time,updated_time,adlabels,issues_info,special_ad_categories,special_ad_category_country,smart_promotion_type,is_skadnetwork_attribution`;

    const campaignResponse = await fetch(campaignUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!campaignResponse.ok) {
      const errorData = await campaignResponse.json();
      if (errorData.error) {
        throw new Error(`Facebook API Error (${errorData.error.code}): ${errorData.error.message}`);
      }
      throw new Error(`HTTP ${campaignResponse.status}: ${campaignResponse.statusText}`);
    }

    const campaignData = await campaignResponse.json();

    // Then, get campaign insights
    let insightsUrl = `${base_url}/${campaign_id}/insights?fields=date_start,date_stop,account_id,account_name,campaign_id,campaign_name,impressions,clicks,unique_clicks,spend,frequency,inline_link_clicks,inline_post_engagement,reach,website_ctr,video_thruplay_watched_actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_play_actions,video_continuous_2_sec_watched_actions,unique_video_continuous_2_sec_watched_actions,estimated_ad_recallers,estimated_ad_recall_rate,unique_outbound_clicks,outbound_clicks,conversions,conversion_values,social_spend,actions,unique_actions,action_values&date_preset=${date_preset}&time_increment=${time_increment}&action_breakdowns=${action_breakdowns}`;

    if (breakdowns) {
      insightsUrl += `&breakdowns=${breakdowns}`;
    }

    const insightsResponse = await fetch(insightsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!insightsResponse.ok) {
      const errorData = await insightsResponse.json();
      if (errorData.error) {
        throw new Error(`Facebook Insights API Error (${errorData.error.code}): ${errorData.error.message}`);
      }
      throw new Error(`HTTP ${insightsResponse.status}: ${insightsResponse.statusText}`);
    }

    const insightsData = await insightsResponse.json();

    // Get ad sets for this campaign
    const adSetsUrl = `${base_url}/${campaign_id}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,bid_amount,bid_strategy,pacing_type,targeting,optimization_goal,billing_event,created_time,updated_time`;

    const adSetsResponse = await fetch(adSetsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let adSetsData = { data: [] };
    if (adSetsResponse.ok) {
      adSetsData = await adSetsResponse.json();
    }

    // Get ads for this campaign
    const adsUrl = `${base_url}/${campaign_id}/ads?fields=id,name,status,effective_status,adset_id,creative,created_time,updated_time`;

    const adsResponse = await fetch(adsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let adsData = { data: [] };
    if (adsResponse.ok) {
      adsData = await adsResponse.json();
    }

    return {
      success: true,
      campaign_id: campaign_id,
      campaign_metadata: campaignData,
      insights: insightsData.data || [],
      insights_summary: insightsData.summary || null,
      insights_paging: insightsData.paging || null,
      ad_sets: adSetsData.data || [],
      ads: adsData.data || [],
      date_preset: date_preset,
      time_increment: time_increment,
      breakdowns: breakdowns,
      action_breakdowns: action_breakdowns,
      retrieved_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error fetching campaign details:', error.message);
    throw new Error(`Failed to fetch campaign details: ${error.message}`);
  }
};

/**
 * Tool configuration for getting detailed campaign information from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCampaignDetails2',
      description: 'Get detailed campaign information including performance insights, ad sets, and ads from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          campaign_id: {
            type: 'string',
            description: 'The campaign ID to fetch details for.'
          },
          userId: {
            type: 'string',
            description: 'The user ID to retrieve the Facebook token from Supabase.'
          },
          date_preset: {
            type: 'string',
            description: 'The date preset for insights (e.g., last_30d, this_month, lifetime).',
            default: 'last_30d'
          },
          time_increment: {
            type: 'string',
            description: 'The time increment for insights (all_days, monthly, daily).',
            default: 'all_days'
          },
          breakdowns: {
            type: 'string',
            description: 'Breakdowns for insights (e.g., age,gender, placement, country).',
            default: ''
          },
          action_breakdowns: {
            type: 'string',
            description: 'Action breakdowns for insights.',
            default: 'action_type'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API.',
            default: 'https://graph.facebook.com/v18.0'
          }
        },
        required: ['campaign_id', 'userId']
      }
    }
  }
};

export { apiTool };
