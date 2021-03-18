import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import { Session } from '@supabase/gotrue-js'
import Auth from '../components/Auth'
import UploadButton from '../components/UploadButton'
import Avatar from '../components/Avatar'
import styles from '../styles/Home.module.css'
import buttonStyles from '../styles/Button.module.css'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    const temp = supabase.auth.session()
    setSession(temp)
    setAvatar(temp?.user.user_metadata.avatar)
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAvatar(session?.user.user_metadata.avatar)
    })
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
    const fileExt = file.name.split('.').pop()
    const fileName = `${session?.user.id}.${fileExt}`
    const filePath = `avatars/${fileName}`

    let uploadRes
    if (avatar) uploadRes = await supabase.storage.updateFile(filePath, file)
    else uploadRes = await supabase.storage.uploadFile(filePath, file)
    if (uploadRes.error) alert(uploadRes.error.message)

    await supabase.auth.update({
      data: {
        avatar: fileName,
      },
    })
    setAvatar(null)
    setAvatar(fileName)
  }

  return (
    <div className={styles.container}>
      {!session ? (
        <Auth />
      ) : (
        <div style={{ minWidth: 250, maxWidth: 600, margin: 'auto' }}>
          <div className={styles.card}>
            <div className={styles.avatarContainer}>
              <Avatar avatar={avatar} />
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
