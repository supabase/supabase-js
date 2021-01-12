import { useEffect, useState } from 'react'
import { supabase } from './initSupabase'

const postData = (url, data = {}) =>
  fetch(url, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    credentials: 'same-origin',
    body: JSON.stringify(data),
  }).then((res) => res.json())

const useAuth = () => {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const supabaseAuthSession = supabase.auth.session()
    setSession(supabaseAuthSession)
    setUser(supabaseAuthSession?.user ?? null)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, supabaseAuthSession) => {
        console.log(`Supbase auth event: ${event}`)

        await postData('/api/auth', {
          event,
          session: supabaseAuthSession,
        })

        setSession(supabaseAuthSession)
        setUser(supabaseAuthSession?.user ?? null)
      }
    )
    return () => {
      authListener.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { user, session }
}

export { useAuth }
