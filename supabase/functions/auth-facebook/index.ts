/**
 * Custom Facebook OAuth callback: no email required.
 * 1) Exchange code for token, get Facebook user id/name
 * 2) Create or find Supabase user (synthetic email fb_<id>@fb.invalid when Facebook provides no email)
 * 3) Exchange for long-lived token, save to public.users
 * 4) Generate magic link and redirect user to sign in
 *
 * Redirect URI in Facebook app must be: https://<PROJECT_REF>.supabase.co/functions/v1/auth-facebook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYNTHETIC_EMAIL_DOMAIN = 'fb.com'

function getRedirectUrl(): string {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('SUPABASE_URL not set')
  return `${url}/functions/v1/auth-facebook`
}

function getAppRedirect(state: string): string {
  try {
    const decoded = decodeURIComponent(state)
    const parsed = JSON.parse(decoded) as { redirect?: string }
    if (parsed?.redirect && (parsed.redirect.startsWith('http://') || parsed.redirect.startsWith('https://'))) {
      return parsed.redirect
    }
  } catch {
    // ignore
  }
  return 'https://metaadsmcpserver-1.onrender.com/dashboard'
}

serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''

  const appRedirect = getAppRedirect(state)
  const redirectToApp = (path: string, params?: Record<string, string>) => {
    const target = new URL(path, appRedirect)
    if (params) Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v))
    return Response.redirect(target.toString(), 302)
  }

  if (!code) {
    return redirectToApp('/dashboard', {
      error: 'server_error',
      error_description: 'Missing authorization code from Facebook',
    })
  }

  const FB_APP_ID = Deno.env.get('FACEBOOK_APP_ID')
  const FB_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!FB_APP_ID || !FB_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return redirectToApp('/dashboard', {
      error: 'server_error',
      error_description: 'Server configuration error',
    })
  }

  try {
    const redirectUri = getRedirectUrl()

    // 1) Exchange code for short-lived access token
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `client_id=${FB_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${FB_APP_SECRET}&` +
      `code=${encodeURIComponent(code)}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json() as {
      access_token?: string
      error?: { message: string }
    }
    if (tokenData.error || !tokenData.access_token) {
      return redirectToApp('/dashboard', {
        error: 'server_error',
        error_description: tokenData.error?.message ?? 'Failed to get token from Facebook',
      })
    }
    const shortLivedToken = tokenData.access_token

    // 2) Get Facebook user id, name, and picture
    const meRes = await fetch(
      `https://graph.facebook.com/v22.0/me?fields=id,name,picture.type(large)&access_token=${shortLivedToken}`
    )
    const meData = await meRes.json() as { id?: string; name?: string; picture?: { data?: { url?: string } }; error?: { message: string } }
    if (meData.error || !meData.id) {
      return redirectToApp('/dashboard', {
        error: 'server_error',
        error_description: meData.error?.message ?? 'Failed to get Facebook user',
      })
    }
    const facebookId = meData.id
    const fullName = meData.name ?? 'Facebook User'
    const pictureUrl = meData.picture?.data?.url ?? null
    const syntheticEmail = `fb_${facebookId}@${SYNTHETIC_EMAIL_DOMAIN}`

    // 3) Exchange short-lived for long-lived token
    const exchangeUrl = `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${FB_APP_ID}&` +
      `client_secret=${FB_APP_SECRET}&` +
      `fb_exchange_token=${shortLivedToken}`
    const exchangeRes = await fetch(exchangeUrl)
    const exchangeData = await exchangeRes.json() as {
      access_token?: string
      expires_in?: number
      error?: { message: string }
    }
    if (exchangeData.error || !exchangeData.access_token) {
      return redirectToApp('/dashboard', {
        error: 'server_error',
        error_description: exchangeData.error?.message ?? 'Failed to get long-lived token',
      })
    }
    const longLivedToken = exchangeData.access_token
    const expiresIn = exchangeData.expires_in ?? 5184000
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 4) Find or create auth user
    const { data: existingLink } = await supabase
      .from('fb_auth_links')
      .select('user_id')
      .eq('facebook_id', facebookId)
      .maybeSingle()

    let userId: string
    let userEmail: string
    let isNewUser: boolean

    const userMeta = {
      full_name: fullName,
      name: fullName,
      provider_id: facebookId,
      avatar_url: pictureUrl,
      picture: pictureUrl,
    }

    if (existingLink?.user_id) {
      const { data: user, error: userErr } = await supabase.auth.admin.getUserById(existingLink.user_id)
      if (userErr || !user?.user?.email) {
        return redirectToApp('/dashboard', {
          error: 'server_error',
          error_description: 'Could not find existing account',
        })
      }
      userId = user.user.id
      userEmail = user.user.email
      isNewUser = false

      // Update user_metadata with latest name/picture on every login
      await supabase.auth.admin.updateUserById(userId, { user_metadata: userMeta })
    } else {
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: userMeta,
      })
      if (createErr) {
        return redirectToApp('/dashboard', {
          error: 'server_error',
          error_description: createErr.message ?? 'Could not create account',
        })
      }
      if (!createData?.user?.id) {
        return redirectToApp('/dashboard', {
          error: 'server_error',
          error_description: 'No user returned from create',
        })
      }
      userId = createData.user.id
      userEmail = createData.user.email ?? syntheticEmail
      isNewUser = true
      // fb_auth_links insert is done after public.users upsert (FK references public.users)
    }

    // 5a) Get granted permissions for the long-lived token
    let grantedScopes: string[] = []
    try {
      const permRes = await fetch(
        `https://graph.facebook.com/v22.0/me/permissions?access_token=${longLivedToken}`
      )
      const permData = await permRes.json() as { data?: Array<{ permission: string; status: string }> }
      if (permData.data) {
        grantedScopes = permData.data
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission)
      }
    } catch {
      // Best-effort
    }

    // 5b) Upsert public.users first (fb_auth_links.user_id FK references public.users(id))
    const { error: usersErr } = await supabase.from('users').upsert(
      {
        id: userId,
        email: userEmail,
        name: fullName,
        access_token: longLivedToken,
        facebook_id: facebookId,
        facebook_name: fullName,
        facebook_email: userEmail,
        facebook_picture_url: pictureUrl,
        facebook_access_token: longLivedToken,
        facebook_long_lived_token: longLivedToken,
        facebook_token_expires_at: expiresAt.toISOString(),
        facebook_scopes: grantedScopes.length > 0 ? grantedScopes : null,
      },
      { onConflict: 'id' }
    )
    if (usersErr) {
      return redirectToApp('/dashboard', {
        error: 'server_error',
        error_description: usersErr.message ?? 'Could not save user profile',
      })
    }

    // 5c) Link Facebook ID to user so future logins reuse this account (must be after public.users upsert)
    if (isNewUser) {
      const { error: linkInsertErr } = await supabase.from('fb_auth_links').insert({
        facebook_id: facebookId,
        user_id: userId,
      })
      if (linkInsertErr) {
        return redirectToApp('/dashboard', {
          error: 'server_error',
          error_description: linkInsertErr.message ?? 'Could not link Facebook account',
        })
      }
    }

    // 6) Generate magic link and redirect so user gets a session
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: { redirectTo: `${new URL('/dashboard', appRedirect).toString()}` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return redirectToApp('/dashboard', {
        error: 'server_error',
        error_description: linkErr?.message ?? 'Could not generate sign-in link',
      })
    }
    return Response.redirect(linkData.properties.action_link, 302)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return redirectToApp('/dashboard', {
      error: 'server_error',
      error_description: message,
    })
  }
})
