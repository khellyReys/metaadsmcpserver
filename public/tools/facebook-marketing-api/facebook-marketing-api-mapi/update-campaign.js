/**
 * General-purpose campaign update tool.
 * Supports updating name, status, budget, bid strategy, and end time.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({
  userId,
  campaign_id,
  name,
  status,
  daily_budget,
  lifetime_budget,
  bid_strategy,
  end_time,
  special_ad_categories
}) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  if (!campaign_id) return { error: 'campaign_id is required' };

  try {
    const url = new URL(`${getBaseUrl()}/${campaign_id}`);

    if (name) url.searchParams.append('name', name);
    if (status) url.searchParams.append('status', status);
    if (daily_budget != null) url.searchParams.append('daily_budget', String(daily_budget));
    if (lifetime_budget != null) url.searchParams.append('lifetime_budget', String(lifetime_budget));
    if (bid_strategy) url.searchParams.append('bid_strategy', bid_strategy);
    if (end_time) url.searchParams.append('end_time', end_time);
    if (special_ad_categories) {
      url.searchParams.append('special_ad_categories', JSON.stringify(special_ad_categories));
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: `Campaign update failed: ${errorData.error?.message || 'Unknown error'}`,
        details: errorData
      };
    }

    const result = await response.json();
    return {
      success: true,
      campaign_id,
      result,
    };
  } catch (error) {
    console.error('Error updating campaign:', error);
    return { error: 'An error occurred while updating the campaign.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'update_campaign',
      description: 'Update an existing Facebook campaign by its ID. Supports changing the campaign name, status (ACTIVE, PAUSED, ARCHIVED), daily or lifetime budget, bid strategy (LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, COST_CAP), and end time. Only provided fields are updated. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          campaign_id: {
            type: 'string',
            description: 'The ID of the campaign to update.'
          },
          name: {
            type: 'string',
            description: 'New campaign name.'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'],
            description: 'New campaign status.'
          },
          daily_budget: {
            type: 'number',
            description: 'New daily budget in cents (e.g. 50000 = 500.00). Cannot be used with lifetime_budget.'
          },
          lifetime_budget: {
            type: 'number',
            description: 'New lifetime budget in cents. Cannot be used with daily_budget.'
          },
          bid_strategy: {
            type: 'string',
            enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
            description: 'New bid strategy.'
          },
          end_time: {
            type: 'string',
            description: 'New end time (ISO 8601 format).'
          },
          special_ad_categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['NONE', 'EMPLOYMENT', 'HOUSING', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS', 'ONLINE_GAMBLING_AND_GAMING', 'FINANCIAL_PRODUCTS_SERVICES']
            },
            description: 'Updated special ad categories.'
          }
        },
        required: ['userId', 'campaign_id']
      }
    }
  }
};

export { apiTool };
