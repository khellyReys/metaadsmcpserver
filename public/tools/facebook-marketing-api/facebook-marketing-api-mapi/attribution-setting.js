/**
 * Fetch insights with attribution windows for a Facebook Ad Account.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'date_start,date_stop,account_id,account_name,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,actions,unique_actions,action_values,impressions,clicks,unique_clicks,spend,frequency,inline_link_clicks,inline_post_engagement,reach,website_ctr,video_thruplay_watched_actions,conversions,conversion_values,social_spend';

const executeFunction = async ({
  account_id,
  date_preset = 'last_30d',
  level = 'ad',
  fields,
  time_increment = '1',
  breakdowns,
  action_attribution_windows
}) => {
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = new URL(`${getBaseUrl()}/act_${acctId}/insights`);
    url.searchParams.append('use_unified_attribution_setting', 'true');
    url.searchParams.append('level', level);
    url.searchParams.append('date_preset', date_preset);
    url.searchParams.append('fields', fields || DEFAULT_FIELDS);
    url.searchParams.append('time_increment', time_increment);
    url.searchParams.append('limit', '100');
    url.searchParams.append('action_breakdowns', 'action_type,action_destination');

    if (breakdowns) url.searchParams.append('breakdowns', breakdowns);
    if (action_attribution_windows) {
      url.searchParams.append('action_attribution_windows', action_attribution_windows);
    } else {
      url.searchParams.append('action_attribution_windows', '["1d_click","7d_click","1d_view"]');
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching attribution insights:', error);
    return { error: 'An error occurred while fetching attribution insights.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_attribution_insights',
      description: 'Fetch performance insights with custom attribution windows for a Facebook Ad Account. Configure click-through and view-through attribution windows (1d, 7d, 28d) to measure conversion impact across different timeframes. Returns spend, impressions, clicks, conversions, and action values. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID (without act_ prefix).'
          },
          date_preset: {
            type: 'string',
            enum: ['today', 'yesterday', 'this_month', 'last_month', 'this_quarter', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d', 'last_week_mon_sun', 'last_week_sun_sat', 'last_quarter', 'last_year', 'this_week_mon_today', 'this_week_sun_today', 'this_year'],
            description: 'Date preset for the report (default: last_30d).'
          },
          level: {
            type: 'string',
            enum: ['account', 'campaign', 'adset', 'ad'],
            description: 'Reporting level (default: ad).'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated fields to include (optional, uses comprehensive defaults).'
          },
          time_increment: {
            type: 'string',
            description: 'Time increment: "1" for daily, "7" for weekly, "monthly", or "all_days" (default: 1).'
          },
          breakdowns: {
            type: 'string',
            description: 'Optional breakdowns (e.g. "product_id", "age", "gender", "country").'
          },
          action_attribution_windows: {
            type: 'string',
            description: 'JSON array of attribution windows (default: ["1d_click","7d_click","1d_view"]).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
