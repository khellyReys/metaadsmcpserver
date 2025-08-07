/**
 * Function to generate a report breakdown for Facebook Ads.
 *
 * @param {Object} args - Arguments for generating the report.
 * @param {string} args.account_id - The Ad Account ID.
 * @param {string} args.report_attribution_id2 - The report attribution ID.
 * @param {string} args.token - The access token for authorization.
 * @param {string} [args.level="ad"] - The level of breakdown (e.g., ad, campaign).
 * @param {Object} [args.time_range] - The time range for the report.
 * @param {string} [args.breakdowns="hourly_stats_aggregated_by_advertiser_time_zone"] - The breakdowns for the report.
 * @param {string} [args.action_breakdowns='["action_type"]'] - The action breakdowns for the report.
 * @param {string} [args.action_attribution_windows='["1d_click","7d_click","28d_click","1d_view","7d_view","28d_view"]'] - The action attribution windows.
 * @param {string} [args.fields='["actions","action_values","ad_id","clicks","impressions","reach","spend","account_currency","unique_clicks","video_thruplay_watched_actions","video_30_sec_watched_actions","video_avg_time_watched_actions","video_p100_watched_actions","video_p25_watched_actions","video_p50_watched_actions","video_p75_watched_actions","video_p95_watched_actions"]'] - The fields to include in the report.
 * @param {string} [args.time_increment="1"] - The time increment for the report.
 * @returns {Promise<Object>} - The result of the report generation.
 */
const executeFunction = async ({ account_id, report_attribution_id2, token, level = 'ad', time_range = { since: '2023-04-26', until: '2023-05-28' }, breakdowns = 'hourly_stats_aggregated_by_advertiser_time_zone', action_breakdowns = '["action_type"]', action_attribution_windows = '["1d_click","7d_click","28d_click","1d_view","7d_view","28d_view"]', fields = '["actions","action_values","ad_id","clicks","impressions","reach","spend","account_currency","unique_clicks","video_thruplay_watched_actions","video_30_sec_watched_actions","video_avg_time_watched_actions","video_p100_watched_actions","video_p25_watched_actions","video_p50_watched_actions","video_p75_watched_actions","video_p95_watched_actions"]', time_increment = "1" }) => {
  const baseUrl = ''; // Base URL will be provided by the user
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/act_${account_id}/insights?${report_attribution_id2}`;
    
    // Set up the request body
    const body = {
      level,
      time_range,
      breakdowns,
      action_breakdowns,
      action_attribution_windows,
      fields,
      time_increment,
      graphapi_sample: true,
      graphapi_user: '511439423'
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error generating report breakdown:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating report breakdown:', error);
    return { error: 'An error occurred while generating the report breakdown.' };
  }
};

/**
 * Tool configuration for generating report breakdowns for Facebook Ads.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'ReportidBreakdownGenerate',
      description: 'Generate a report breakdown for Facebook Ads.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID.'
          },
          report_attribution_id2: {
            type: 'string',
            description: 'The report attribution ID.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
          },
          level: {
            type: 'string',
            description: 'The level of breakdown (e.g., ad, campaign).'
          },
          time_range: {
            type: 'object',
            description: 'The time range for the report.'
          },
          breakdowns: {
            type: 'string',
            description: 'The breakdowns for the report.'
          },
          action_breakdowns: {
            type: 'string',
            description: 'The action breakdowns for the report.'
          },
          action_attribution_windows: {
            type: 'string',
            description: 'The action attribution windows.'
          },
          fields: {
            type: 'string',
            description: 'The fields to include in the report.'
          },
          time_increment: {
            type: 'string',
            description: 'The time increment for the report.'
          }
        },
        required: ['account_id', 'report_attribution_id2', 'token']
      }
    }
  }
};

export { apiTool };