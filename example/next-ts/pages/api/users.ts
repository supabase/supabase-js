import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

type User = {
  id: string
  username: string
  status: 'ONLINE' | 'OFFLINE'
  group: number
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // Get all users
  const { data: users } = await supabase.from<User>('users').select()

  // Get just one OFFLINE user
  const { data: user } = await supabase
    .from<User>('users')
    .select('*')
    .eq('status', 'OFFLINE')
    .limit(1)
    .single()
  res.status(200).json({ one_id: user.id, many_users: users })
}
