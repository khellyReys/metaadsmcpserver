/**
 * Create a budget schedule for a Facebook Ads campaign.
 * Allows scheduling budget increases based on anticipated high-demand periods.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, campaign_id, budget_value, budget_value_type, time_start, time_end }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${getBaseUrl()}/${campaign_id}/budget_schedules`;
    const body = {
      budget_value: String(budget_value),
      budget_value_type,
      time_start,
      time_end
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
    console.error('Error creating budget schedule:', error);
    return { error: 'An error occurred while creating the budget schedule.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_budget_schedule',
      description: 'Create a budget schedule for a Facebook Ads campaign to automatically increase budgets during high-demand periods. Specify a time window (Unix timestamps) and either an absolute budget value or a multiplier. Useful for seasonal promotions, flash sales, or event-based campaigns. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          campaign_id: { type: 'string', description: 'The campaign ID to create the budget schedule for.' },
          budget_value: { type: 'integer', description: 'Amount of budget increase (cents for ABSOLUTE, multiplier for MULTIPLIER).' },
          budget_value_type: { type: 'string', enum: ['ABSOLUTE', 'MULTIPLIER'], description: 'Type of budget value: ABSOLUTE (fixed amount in cents) or MULTIPLIER (e.g., 2 = 2x budget).' },
          time_start: { type: 'integer', description: 'Unix timestamp for when the high-demand period starts.' },
          time_end: { type: 'integer', description: 'Unix timestamp for when the high-demand period ends.' }
        },
        required: ['userId', 'campaign_id', 'budget_value', 'budget_value_type', 'time_start', 'time_end']
      }
    }
  }
};

export { apiTool };
