import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import Auth from '../components/Auth'
import Account from '../components/Account'
import Avatar from '../components/Avatar'
import styles from '../styles/Home.module.css'
import { AuthSession } from '../../../dist/main'
import { DEFAULT_AVATARS_BUCKET } from '../lib/constants'

type Profile = {
  avatar_url: string
  username: string
  dob: string
}

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    setSession(supabase.auth.session())

    supabase.auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      setSession(session)
    })
  }, [])

  return (
    <div className={styles.container}>
      {!session ? <Auth /> : <Account key={session.user.id} session={session} />}
    </div>
  )
}
