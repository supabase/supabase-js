import { supabase } from '../../utils/initSupabase'

export default function handler(req, res) {
  supabase.auth.api.setAuthCookie(req, res)
}
