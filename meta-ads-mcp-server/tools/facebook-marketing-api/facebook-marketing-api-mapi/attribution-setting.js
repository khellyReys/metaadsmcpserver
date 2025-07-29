/**
 * Function to get attribution settings from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the attribution settings request.
 * @param {string} args.account_id - The Ad Account ID.
 * @param {string} args.token - The access token for authorization.
 * @returns {Promise<Object>} - The result of the attribution settings request.
 */
const executeFunction = async ({ account_id, token }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0'; // Base URL for Facebook Marketing API
  const url = `${baseUrl}/act_${account_id}/insights?use_unified_attribution_setting=true&async=true&level=ad&date_preset=this_year&breakdowns=product_id&limit=100&action_breakdowns=action_type,action_destination&action_attribution_windows=["1d_click","7d_click","28d_click","1d_view","7d_view","28d_view"]&fields=date_start,date_stop,account_id,account_name,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,actions,unique_actions,action_values,impressions,clicks,unique_clicks,spend,frequency,inline_link_clicks,inline_post_engagement,reach,website_ctr,video_thruplay_watched_actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_play_actions,video_continuous_2_sec_watched_actions,unique_video_continuous_2_sec_watched_actions,estimated_ad_recallers,estimated_ad_recall_rate,unique_outbound_clicks,outbound_clicks,conversions,conversion_values,social_spend&time_increment=1&format=json`;

  try {
    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching attribution settings:', error);
    return { error: 'An error occurred while fetching attribution settings.' };
  }
};

/**
 * Tool configuration for fetching attribution settings from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'AttributionSetting',
      description: 'Fetch attribution settings for a specific Ad Account from Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };