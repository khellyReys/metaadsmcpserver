/**
 * Duplicate a Facebook ad creative by fetching it and creating a new one with the same spec.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, creative_id, name_suffix = ' - Copy' }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  const base = getBaseUrl();
  try {
    const fetchUrl = `${base}/${creative_id}?fields=name,object_story_spec,asset_feed_spec,degrees_of_freedom_spec,account_id,url_tags&access_token=${token}`;
    const fetchResp = await fetch(fetchUrl);
    if (!fetchResp.ok) {
      const errorData = await fetchResp.json();
      throw new Error(safeFacebookError(errorData));
    }
    const original = await fetchResp.json();
    const accountId = original.account_id;
    if (!accountId) return { error: 'Could not determine account_id from the original creative.' };

    const body = {};
    if (original.name) body.name = original.name + name_suffix;
    if (original.object_story_spec) body.object_story_spec = JSON.stringify(original.object_story_spec);
    if (original.asset_feed_spec) body.asset_feed_spec = JSON.stringify(original.asset_feed_spec);
    if (original.degrees_of_freedom_spec) body.degrees_of_freedom_spec = JSON.stringify(original.degrees_of_freedom_spec);
    if (original.url_tags) body.url_tags = original.url_tags;

    const createUrl = `${base}/act_${accountId.replace(/^act_/, '')}/adcreatives`;
    const formData = new URLSearchParams();
    formData.append('access_token', token);
    for (const [k, v] of Object.entries(body)) formData.append(k, v);

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    if (!createResp.ok) {
      const errorData = await createResp.json();
      throw new Error(safeFacebookError(errorData));
    }
    const result = await createResp.json();
    return { success: true, original_creative_id: creative_id, new_creative_id: result.id, name: body.name };
  } catch (error) {
    console.error('Error duplicating creative:', error);
    return { error: 'An error occurred while duplicating the creative.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'duplicate_creative',
      description: 'Duplicate a Facebook ad creative by fetching its full spec and creating a new creative with the same content. Appends a name suffix to distinguish the copy. Returns both the original and new creative IDs. Useful for A/B testing different creatives. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          creative_id: { type: 'string', description: 'The ID of the creative to duplicate.' },
          name_suffix: { type: 'string', description: 'Suffix to append to the duplicated creative name (default: " - Copy").' }
        },
        required: ['userId', 'creative_id']
      }
    }
  }
};

export { apiTool };
