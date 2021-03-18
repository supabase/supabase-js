import { useState, useEffect } from 'react'
import { supabase } from '../lib/api'
import { Session } from '@supabase/gotrue-js'
import Auth from '../components/Auth'
import styles from '../styles/Home.module.css'
import buttonStyles from '../styles/Button.module.css'

export default function Home() {
  let [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    setSession(supabase.auth.session())
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.log('Error logging out:', error.message)
  }

  function uploadAvatar() {}

  return (
    <div className={styles.container}>
      {!session ? (
        <Auth />
      ) : (
        <div style={{ minWidth: 250, maxWidth: 600, margin: 'auto' }}>
          <div className="card">
            <div className={styles.avatarContainer}>
              <img src="img.jpg" alt="John" className={styles.noImage} />
            </div>
            <button className={buttonStyles.primaryButton} onClick={uploadAvatar}>
              Upload your avatar
            </button>
            <span className={styles.text}>You're signed in</span>
            <p className={`${styles.text} ${styles.bold}`}>{`Email: ${session.user.email}`}</p>

            <a className={buttonStyles.linkButton} onClick={signOut}>
              ➔ Sign Out
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
