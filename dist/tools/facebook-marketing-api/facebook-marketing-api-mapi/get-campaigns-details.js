/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.account_id - The ad account ID to fetch campaigns from.
 * @returns {Promise<Object>} - The details of the campaigns.
 */
import { getSupabaseClient } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, resolveToken, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id }) => {
  if (!account_id) {
    throw new Error('account_id is required');
  }

  const acctId = normalizeAccountId(account_id);

  try {
    const { token } = await resolveToken(acctId);

    const base = getBaseUrl();
    const url = `${base}/act_${acctId}/campaigns?fields=id,name,objective,account_id,buying_type,daily_budget,lifetime_budget,spend_cap,bid_strategy,pacing_type,status,effective_status,promoted_object,recommendations,start_time,stop_time,created_time,updated_time,adlabels,issues_info,special_ad_categories,special_ad_category_country,smart_promotion_type,is_skadnetwork_attribution`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    if (!response.ok) {
      if (data.error) {
        const err = data.error;
        if (err.code === 190) {
          throw new Error(`Facebook OAuth Error (${err.code}): ${err.message}. Please refresh your access token.`);
        } else if (err.code === 200) {
          throw new Error(`Facebook Permission Error (${err.code}): ${err.message}. Check your app permissions for account ${acctId}.`);
        } else if (err.code === 100) {
          throw new Error(`Facebook Parameter Error (${err.code}): ${err.message}. Check your account_id: ${acctId}.`);
        } else {
          throw new Error(`Facebook API Error (${err.code}): ${err.message}`);
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (data.error) {
      throw new Error(`Facebook API Error (${data.error.code}): ${data.error.message}`);
    }

    return {
      success: true,
      account_id: acctId,
      campaigns: data.data || [],
      paging: data.paging || null,
      summary: data.summary || null
    };

  } catch (error) {
    console.error('Error fetching campaign details:', error.message);
    throw new Error(`Failed to fetch campaign details: ${error.message}`);
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_campaigns_details',
      description: 'Get details of campaigns from the specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID to fetch campaigns from (without act_ prefix).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
