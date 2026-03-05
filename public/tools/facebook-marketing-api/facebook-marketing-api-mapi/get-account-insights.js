/**
 * Get account-level insights from the Facebook Marketing API.
 * Supports flexible date ranges, breakdowns, and field selection.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'account_id,account_name,spend,impressions,clicks,unique_clicks,ctr,cpc,cpm,cpp,reach,frequency,actions,action_values,conversions,conversion_values,cost_per_action_type,cost_per_unique_click,inline_link_clicks,inline_link_click_ctr,outbound_clicks,unique_outbound_clicks,social_spend,account_currency';

const executeFunction = async ({
  account_id,
  date_preset,
  time_range,
  fields,
  level = 'account',
  time_increment = 'all_days',
  breakdowns,
  action_breakdowns,
  filtering,
  limit = 100
}) => {
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = new URL(`${getBaseUrl()}/act_${acctId}/insights`);
    url.searchParams.append('fields', fields || DEFAULT_FIELDS);
    url.searchParams.append('level', level);
    url.searchParams.append('time_increment', time_increment);
    url.searchParams.append('limit', String(limit));

    if (date_preset) {
      url.searchParams.append('date_preset', date_preset);
    } else if (time_range && time_range.since && time_range.until) {
      url.searchParams.append('time_range', JSON.stringify(time_range));
    } else {
      url.searchParams.append('date_preset', 'last_30d');
    }

    if (breakdowns) url.searchParams.append('breakdowns', breakdowns);
    if (action_breakdowns) url.searchParams.append('action_breakdowns', action_breakdowns);
    if (filtering) url.searchParams.append('filtering', JSON.stringify(filtering));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching account insights:', error);
    return { error: 'An error occurred while fetching account insights.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_account_insights',
      description: 'Get performance insights for a Facebook Ad Account. Supports flexible date ranges, reporting levels, breakdowns, and field selection.',
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
            description: 'Date preset (default: last_30d). Cannot be used with time_range.'
          },
          time_range: {
            type: 'object',
            properties: {
              since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              until: { type: 'string', description: 'End date (YYYY-MM-DD)' }
            },
            description: 'Custom date range. Cannot be used with date_preset.'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated fields (optional, uses comprehensive defaults including spend, impressions, clicks, reach, conversions, etc.).'
          },
          level: {
            type: 'string',
            enum: ['account', 'campaign', 'adset', 'ad'],
            description: 'Reporting level (default: account).'
          },
          time_increment: {
            type: 'string',
            description: 'Time granularity: "1" for daily, "7" for weekly, "monthly", or "all_days" for aggregate (default: all_days).'
          },
          breakdowns: {
            type: 'string',
            description: 'Optional breakdowns (e.g. "age", "gender", "country", "placement", "device_platform").'
          },
          action_breakdowns: {
            type: 'string',
            description: 'Optional action breakdowns (e.g. "action_type", "action_destination").'
          },
          filtering: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: { type: 'string' },
                value: { type: 'string' }
              }
            },
            description: 'Optional filtering rules.'
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default: 100).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
