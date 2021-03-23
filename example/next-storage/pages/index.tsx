import Auth from '../components/Auth'
import Account from '../components/Account'
import ProfileList from '../components/ProfileList'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/api'
import { AuthSession } from '@supabase/supabase-js'

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    setSession(supabase.auth.session())

    supabase.auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      setSession(session)
    })
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {!session ? (
        <Auth />
      ) : (
        <div className="flex w-half" style={{ gap: 10 }}>
          <div className="flex column w-half">
            <Account key={session.user.id} session={session} />
          </div>
          <div className="flex column w-half" style={{ gap: 20 }}>
            <ProfileList />
          </div>
        </div>
      )}
    </div>
  )
}
