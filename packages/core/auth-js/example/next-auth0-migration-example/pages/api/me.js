import { supabase } from '../../lib/initSupabase'

// Example of how to verify and get user data server-side.
const getUser = async (req, res) => {
  const { user, error } = await supabase.auth.api.getUserByCookie(req, res)

  if (error) return res.status(401).json({ error: error.message })
  return res.status(200).json(user)
}

export default getUser
