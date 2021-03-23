import { useState, useEffect } from 'react'
import { supabase } from '../lib/api'
import Auth from '../components/Auth'
import Account from '../components/Account'
import ProfileCard from '../components/ProfileCard'
import styles from '../styles/Home.module.css'
import { AuthSession, Subscription, SupabaseRealtimePayload } from '../../../dist/main'
import { Profile } from '../lib/constants'

var realtimeProfiles: Subscription | null

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => {
    setSession(supabase.auth.session())
    getPublicProfiles()

    supabase.auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      setSession(session)
    })

    realtimeProfiles = supabase
      .from('profiles')
      .on('*', (payload: SupabaseRealtimePayload<Profile>) => {
        setProfiles([payload.new, ...profiles?.filter((x) => x.id != payload.new.id)])
      })
      .subscribe()

    return () => {
      supabase.removeSubscription(realtimeProfiles)
      realtimeProfiles = null
    }
  }, [])

  async function getPublicProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, website, updated_at')
        .order('updated_at', { ascending: false })
      if (error) {
        throw error
      }
      console.log('data', data)
      setProfiles(data)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  return (
    <div className={styles.container}>
      {!session ? (
        <Auth />
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <Account key={session.user.id} session={session} />
          </div>
          <div>
            {profiles?.map((profile) => (
              <ProfileCard profile={profile} key={profile.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
