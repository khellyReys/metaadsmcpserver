/**
 * Upload a video to a Facebook Ad Account by URL.
 * Meta fetches the video directly from the URL.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, video_url, name, title, description }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };
  if (!video_url) return { error: 'video_url is required' };
  try {
    const resolvedName = name || video_url.split('/').pop()?.split('?')[0] || 'video';
    const body = { file_url: video_url, access_token: token };
    if (title) body.title = title;
    if (description) body.description = description;
    body.name = resolvedName;

    const url = `${base}/act_${acctId}/advideos`;
    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) formData.append(k, v);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    const result = await response.json();
    return {
      success: true,
      video_id: result.id,
      account_id: `act_${acctId}`,
      name: resolvedName
    };
  } catch (error) {
    console.error('Error uploading video:', error);
    return { error: 'An error occurred while uploading the video.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'upload_ad_video',
      description: 'Upload a video to a Facebook Ad Account by providing a publicly accessible URL. Meta fetches the video directly from the URL (no file upload needed). Returns a video_id to use with create_ad_creative or create_ad_with_creative for video ad creatives. Supports optional title and description. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'The ad account ID (without act_ prefix).' },
          video_url: { type: 'string', description: 'Publicly accessible URL to a video file.' },
          name: { type: 'string', description: 'Optional filename (inferred from URL if omitted).' },
          title: { type: 'string', description: 'Optional video title.' },
          description: { type: 'string', description: 'Optional video description.' }
        },
        required: ['account_id', 'video_url']
      }
    }
  }
};

export { apiTool };
