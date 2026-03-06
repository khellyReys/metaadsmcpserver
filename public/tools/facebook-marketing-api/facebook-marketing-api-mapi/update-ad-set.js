/**
 * General-purpose ad set update tool.
 * Supports updating name, status, budget, bid, targeting, and schedule.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({
  userId,
  adset_id,
  name,
  status,
  daily_budget,
  lifetime_budget,
  bid_amount,
  bid_strategy,
  optimization_goal,
  start_time,
  end_time,
  targeting
}) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  if (!adset_id) return { error: 'adset_id is required' };

  try {
    const url = new URL(`${getBaseUrl()}/${adset_id}`);

    if (name) url.searchParams.append('name', name);
    if (status) url.searchParams.append('status', status);
    if (daily_budget != null) url.searchParams.append('daily_budget', String(daily_budget));
    if (lifetime_budget != null) url.searchParams.append('lifetime_budget', String(lifetime_budget));
    if (bid_amount != null) url.searchParams.append('bid_amount', String(bid_amount));
    if (bid_strategy) url.searchParams.append('bid_strategy', bid_strategy);
    if (optimization_goal) url.searchParams.append('optimization_goal', optimization_goal);
    if (start_time) url.searchParams.append('start_time', start_time);
    if (end_time) url.searchParams.append('end_time', end_time);
    if (targeting) url.searchParams.append('targeting', JSON.stringify(targeting));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: `Ad set update failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData
      };
    }

    const result = await response.json();
    return {
      success: true,
      adset_id,
      result,
    };
  } catch (error) {
    console.error('Error updating ad set:', error);
    return { error: 'An error occurred while updating the ad set.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'update_ad_set',
      description: 'Update an existing Facebook ad set by its ID. Supports changing name, status (ACTIVE, PAUSED, ARCHIVED), daily or lifetime budget, bid amount, targeting criteria, start/end time, and optimization goal. Only provided fields are updated. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          adset_id: {
            type: 'string',
            description: 'The ID of the ad set to update.'
          },
          name: {
            type: 'string',
            description: 'New ad set name.'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'],
            description: 'New ad set status.'
          },
          daily_budget: {
            type: 'number',
            description: 'New daily budget in cents. Cannot be used with lifetime_budget.'
          },
          lifetime_budget: {
            type: 'number',
            description: 'New lifetime budget in cents. Cannot be used with daily_budget.'
          },
          bid_amount: {
            type: 'number',
            description: 'New bid amount in cents.'
          },
          bid_strategy: {
            type: 'string',
            enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
            description: 'New bid strategy.'
          },
          optimization_goal: {
            type: 'string',
            description: 'New optimization goal (e.g. REACH, LINK_CLICKS, IMPRESSIONS, LEAD_GENERATION, etc.).'
          },
          start_time: {
            type: 'string',
            description: 'New start time (ISO 8601 format).'
          },
          end_time: {
            type: 'string',
            description: 'New end time (ISO 8601 format).'
          },
          targeting: {
            type: 'object',
            description: 'New targeting spec object (geo_locations, age_min, age_max, genders, etc.).'
          }
        },
        required: ['userId', 'adset_id']
      }
    }
  }
};

export { apiTool };
