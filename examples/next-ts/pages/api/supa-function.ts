import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // Invoke your project's `hello-world` function.
  const { data, error } = await supabase.functions.invoke('hello-world', { responseType: 'text' })
  console.log('functions', data, error)

  res.status(200).json({ data, error })
}
