import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import { Session } from '@supabase/gotrue-js'
import Auth from '../components/Auth'
import UploadButton from '../components/UploadButton'
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

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length == 0) {
      alert('You must select an image to upload')
      return
    }

    const file = event.target.files[0]
    console.log('upload file', file)
    const filePath = `avatars/${file.name}`
    const res = await supabase.storage.api.uploadFile(filePath, file)
    console.log('upload file', res)
  }

  return (
    <div className={styles.container}>
      {!session ? (
        <Auth />
      ) : (
        <div style={{ minWidth: 250, maxWidth: 600, margin: 'auto' }}>
          <div className={styles.card}>
            <div className={styles.avatarContainer}>
              <div className={styles.noImage} />
            </div>
            <UploadButton onUpload={uploadAvatar} />
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
