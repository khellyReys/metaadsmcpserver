/**
 * Generate an async report breakdown for Facebook Ads insights.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = '["actions","action_values","ad_id","clicks","impressions","reach","spend","account_currency","unique_clicks","video_thruplay_watched_actions","video_30_sec_watched_actions","video_avg_time_watched_actions","video_p100_watched_actions","video_p25_watched_actions","video_p50_watched_actions","video_p75_watched_actions","video_p95_watched_actions"]';

const executeFunction = async ({
  account_id,
  level = 'ad',
  time_range,
  breakdowns = 'hourly_stats_aggregated_by_advertiser_time_zone',
  action_breakdowns = '["action_type"]',
  action_attribution_windows = '["1d_click","7d_click","1d_view"]',
  fields,
  time_increment = '1'
}) => {
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = `${getBaseUrl()}/act_${acctId}/insights`;

    const body = {
      level,
      time_range: time_range || { since: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], until: new Date().toISOString().split('T')[0] },
      breakdowns,
      action_breakdowns,
      action_attribution_windows,
      fields: fields || DEFAULT_FIELDS,
      time_increment,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating report breakdown:', error);
    return { error: 'An error occurred while generating the report breakdown.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'generate_report_breakdown',
      description: 'Generate an async report breakdown for Facebook Ads with configurable fields, breakdowns, and attribution windows.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID (without act_ prefix).'
          },
          level: {
            type: 'string',
            enum: ['account', 'campaign', 'adset', 'ad'],
            description: 'Reporting level (default: ad).'
          },
          time_range: {
            type: 'object',
            properties: {
              since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              until: { type: 'string', description: 'End date (YYYY-MM-DD)' }
            },
            description: 'Time range for the report (default: last 30 days).'
          },
          breakdowns: {
            type: 'string',
            description: 'Breakdowns (default: hourly_stats_aggregated_by_advertiser_time_zone).'
          },
          action_breakdowns: {
            type: 'string',
            description: 'Action breakdowns as JSON array (default: ["action_type"]).'
          },
          action_attribution_windows: {
            type: 'string',
            description: 'Attribution windows as JSON array (default: ["1d_click","7d_click","1d_view"]).'
          },
          fields: {
            type: 'string',
            description: 'Fields as JSON array (optional, uses comprehensive defaults).'
          },
          time_increment: {
            type: 'string',
            description: 'Time increment: "1" for daily, "7" for weekly (default: 1).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
