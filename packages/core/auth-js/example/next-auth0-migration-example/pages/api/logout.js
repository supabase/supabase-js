import { supabase } from '../../lib/initSupabase'

export default function handler(req, res) {
  supabase.auth.api.deleteAuthCookie(req, res, { redirectTo: '/' })
}
