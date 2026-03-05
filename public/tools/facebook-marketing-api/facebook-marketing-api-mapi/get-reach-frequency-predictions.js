/**
 * Get reach frequency predictions for a Facebook Ad Account.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'id,name,account_id,status,prediction_mode,prediction_progress,reservation_status,audience_size_lower_bound,audience_size_upper_bound,external_budget,external_reach,external_impression,external_minimum_budget,external_maximum_budget,external_minimum_reach,external_maximum_reach,external_minimum_impression,external_maximum_impression,frequency_cap,holdout_percentage,campaign_id,campaign_group_id,campaign_time_start,campaign_time_stop,time_created,time_updated,expiration_time,target_spec,destination_id,instagram_destination_id,interval_frequency_cap_reset_period,pause_periods,story_event_type';

const executeFunction = async ({ account_id, fields }) => {
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = new URL(`${getBaseUrl()}/act_${acctId}/reachfrequencypredictions`);
    url.searchParams.append('fields', fields || DEFAULT_FIELDS);

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
    console.error('Error fetching reach frequency predictions:', error);
    return { error: 'An error occurred while fetching reach frequency predictions.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_reach_frequency_predictions',
      description: 'Get reach frequency predictions for a specific ad account from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID (without act_ prefix).'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated fields to retrieve (optional, uses comprehensive defaults).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
