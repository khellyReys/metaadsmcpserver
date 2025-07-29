/**
 * Function to get insights for an ads group from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the insights request.
 * @param {string} args.ad_id - The ID of the ad for which insights are requested.
 * @param {string} [args.date_preset="maximum"] - The date preset for the insights.
 * @param {number} [args.limit=100] - The number of insights to return.
 * @param {string} [args.action_breakdowns="action_type"] - The breakdown of actions.
 * @param {string} [args.time_increment="all_days"] - The time increment for the insights.
 * @returns {Promise<Object>} - The insights data for the specified ad.
 */
const executeFunction = async ({ ad_id, date_preset = 'maximum', limit = 100, action_breakdowns = 'action_type', time_increment = 'all_days' }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0'; // Adjust version as needed
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;

  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/insights`);
    url.searchParams.append('date_preset', date_preset);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('action_breakdowns', action_breakdowns);
    url.searchParams.append('ids', ad_id);
    url.searchParams.append('fields', 'date_start,date_stop,account_id,account_name,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,actions,unique_actions,action_values,impressions,clicks,unique_clicks,spend,frequency,inline_link_clicks,inline_post_engagement,reach,website_ctr,video_thruplay_watched_actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_play_actions,video_continuous_2_sec_watched_actions,unique_video_continuous_2_sec_watched_actions,estimated_ad_recallers,estimated_ad_recall_rate,unique_outbound_clicks,outbound_clicks,conversions,conversion_values,social_spend');
    url.searchParams.append('time_increment', time_increment);

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
      method: 'GET',
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
    console.error('Error getting insights for ads group:', error);
    return { error: 'An error occurred while getting insights for ads group.' };
  }
};

/**
 * Tool configuration for getting insights for ads group from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetInsightForAdsGroup',
      description: 'Get insights for a specific ads group from Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          ad_id: {
            type: 'string',
            description: 'The ID of the ad for which insights are requested.'
          },
          date_preset: {
            type: 'string',
            description: 'The date preset for the insights.'
          },
          limit: {
            type: 'integer',
            description: 'The number of insights to return.'
          },
          action_breakdowns: {
            type: 'string',
            description: 'The breakdown of actions.'
          },
          time_increment: {
            type: 'string',
            description: 'The time increment for the insights.'
          }
        },
        required: ['ad_id']
      }
    }
  }
};

export { apiTool };