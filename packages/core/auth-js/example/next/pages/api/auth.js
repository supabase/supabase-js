import { supabase } from '../../utils/initSupabase'

export default function handler(req, res) {
  // Option 1: (supported for Next.js & Express)
  // supabase.auth.api.setAuthCookie(req, res)

  // Option 2: (use this when `setAuthCookie` is not supported)
  const cookieStr = supabase.auth.api.getAuthCookieString(req, res)
  res.setHeader('Set-Cookie', cookieStr)
  res.json({})
}
