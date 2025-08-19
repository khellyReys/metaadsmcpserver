// tools/create-ad-creative-from-post.js
/**
 * MCP Tool: Create Ad Creative from Existing Post (Node.js ESM)
 * - Uses object_story_id = <PAGE_ID>_<POST_ID>
 * - POST /act_<account_id>/adcreatives
 * - Works for image or video posts; uses the post as-is (no link_data/CTA overrides)
 */

import { createClient } from "@supabase/supabase-js";

const executeFunction = async ({
  account_id,
  userId,
  page_id,
  post_id,
  name = null,                 // optional creative name; auto-generated if missing
  access_token = null,         // optional override
  graph_version = "v21.0",
  base_url,                    // optional Graph base URL override
}) => {
  try {
    if (!account_id) throw new Error("Missing required: account_id");
    if (!userId) throw new Error("Missing required: userId");
    if (!page_id) throw new Error("Missing required: page_id");
    if (!post_id) throw new Error("Missing required: post_id");

    // Build and validate object_story_id
    let object_story_id = post_id.includes("_") ? post_id : `${page_id}_${post_id}`;
    if (post_id.includes("_")) {
      const [pageFromPost] = post_id.split("_");
      if (pageFromPost !== page_id) {
        return {
          error: "PAGE_ID_MISMATCH",
          details: `Provided post_id belongs to Page ${pageFromPost}, which does not match page_id ${page_id}.`,
        };
      }
    }

    // Resolve token (override or Supabase)
    let token = access_token;
    if (!token) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data, error } = await supabase
        .from("users")
        .select("facebook_long_lived_token")
        .eq("id", userId)
        .single();

      if (error) throw new Error(`Supabase query failed: ${error.message}`);
      token = data?.facebook_long_lived_token || null;
      if (!token) {
        return {
          error: "NO_FACEBOOK_TOKEN",
          details:
            "No Facebook access token found for this user. Ensure OAuth saved facebook_long_lived_token, or pass access_token.",
        };
      }
    }

    const graphBase = base_url || `https://graph.facebook.com/${graph_version}`;
    const url = `${graphBase}/act_${account_id}/adcreatives`;

    // Use x-www-form-urlencoded for Node reliability
    const form = new URLSearchParams();
    form.set("access_token", token);
    form.set("object_story_id", object_story_id); // use the existing post as-is
    form.set("name", name || `Boost ${object_story_id}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const json = await res.json();

    if (!res.ok) {
      const fbErr = json?.error || json;
      // Helpful hints for common pitfalls
      let hint = "";
      if (fbErr?.code === 190) hint = "Token invalid/expired. Refresh the user token.";
      if (fbErr?.code === 200) hint = "Missing permissions. Ensure ads_management and Page access.";
      if (fbErr?.code === 1487390 || fbErr?.code === 2446431) {
        hint =
          "When using object_story_id, do NOT include link_data/CTA overrides. The post is used as-is.";
      }
      return {
        error: "Ad creative creation failed",
        status: res.status,
        details: fbErr,
        hint,
      };
    }

    // Success: { id: "<CREATIVE_ID>" }
    return {
      success: true,
      creative_id: json.id,
      object_story_id,
      name: name || `Boost ${object_story_id}`,
      raw: json,
    };
  } catch (err) {
    return {
      error: "Unexpected error while creating ad creative from post.",
      details: err?.message || String(err),
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "create-ad-creative-from-post",
      description:
        "Create a Facebook Ad Creative that uses an existing Page post via object_story_id (<PAGE_ID>_<POST_ID>). Returns creative_id.",
      parameters: {
        type: "object",
        properties: {
          account_id: {
            type: "string",
            description: "Ad Account ID without 'act_'. Example: 123456789012345",
          },
          userId: {
            type: "string",
            description:
              "Your platform user ID; used to fetch the saved facebook_long_lived_token from Supabase.",
          },
          page_id: {
            type: "string",
            description: "The Page ID that owns the post.",
          },
          post_id: {
            type: "string",
            description:
              "The Page post ID. You may pass either the raw post id or '<PAGE_ID>_<POST_ID>'.",
          },
          name: {
            type: "string",
            nullable: true,
            description: "Optional ad creative name. Default: 'Boost <PAGE_ID>_<POST_ID>'.",
          },
          access_token: {
            type: "string",
            nullable: true,
            description: "Optional token override; otherwise pulled from Supabase.",
          },
          graph_version: {
            type: "string",
            default: "v21.0",
            description: "Graph API version.",
          },
          base_url: {
            type: "string",
            nullable: true,
            description: "Override the Graph base URL if needed.",
          },
        },
        required: ["account_id", "userId", "page_id", "post_id"],
        additionalProperties: false,
      },
    },
  },
};

export default apiTool;
