/**
 * Update the budget and bid strategy for a Facebook campaign.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, campaign_id, daily_budget, lifetime_budget, bid_strategy, stop_time }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  try {
    const url = new URL(`${getBaseUrl()}/${campaign_id}`);
    if (daily_budget != null) url.searchParams.append('daily_budget', String(daily_budget));
    if (lifetime_budget != null) url.searchParams.append('lifetime_budget', String(lifetime_budget));
    if (bid_strategy) url.searchParams.append('bid_strategy', bid_strategy);
    if (stop_time) url.searchParams.append('stop_time', stop_time);

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
    console.error('Error updating budget/bid:', error);
    return { error: 'An error occurred while updating the budget and bid.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'update_budget_bid',
      description: 'Update the budget and bid strategy for a Facebook campaign.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          campaign_id: {
            type: 'string',
            description: 'The ID of the campaign to update.'
          },
          daily_budget: {
            type: 'number',
            description: 'Daily budget in cents (e.g. 50000 = 500.00). Cannot be used with lifetime_budget.'
          },
          lifetime_budget: {
            type: 'number',
            description: 'Lifetime budget in cents. Cannot be used with daily_budget.'
          },
          bid_strategy: {
            type: 'string',
            enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
            description: 'The bid strategy to use.'
          },
          stop_time: {
            type: 'string',
            description: 'The end time for the campaign (ISO 8601 format).'
          }
        },
        required: ['userId', 'campaign_id']
      }
    }
  }
};

export { apiTool };
