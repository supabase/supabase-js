import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import Auth from '../components/Auth'
import Account, { Profile } from '../components/Account'
import styles from '../styles/Home.module.css'
import { AuthSession } from '../../../dist/main'

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profiles, setProfiles] = useState<Profile[] | null>(null)

  useEffect(() => {
    setSession(supabase.auth.session())
    getPublicProfiles()

    // TODO: listen to changes in profile table
    // const mySubscription = supabase
    //   .from('profiles')
    //   .on('*', (payload) => {
    //     console.log('Change received!', payload)
    //   })
    //   .subscribe()

    supabase.auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      setSession(session)
    })
  }, [])

  async function getPublicProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, dob')
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
              <div key={profile.id}>
                <p>{profile.id}</p>
                <p>{profile.username}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
