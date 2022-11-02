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

  const onSaveComplete = () => {
    console.log('complete')
  }

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
        <div style={{ width: '50%' }}>
          <p className="mainHeader">
            Let's set up a simple profile
            <span style={{ display: 'block', opacity: '50%', marginTop: '5px' }}>
              And watch it update on the right
            </span>
          </p>
          <div className="flex" style={{ gap: 10, width: '100%', justifyContent: 'space-between' }}>
            <div className="flex column" style={{ width: '45%' }}>
              <Account key={session.user.id} session={session} onSaveComplete={onSaveComplete} />
            </div>
            <div className="flex column" style={{ gap: 20, width: '45%' }}>
              <ProfileList />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
