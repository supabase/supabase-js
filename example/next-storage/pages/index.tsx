import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import { Session } from '@supabase/gotrue-js'
import Auth from '../components/Auth'
import UploadButton from '../components/UploadButton'
import Avatar from '../components/Avatar'
import styles from '../styles/Home.module.css'
import buttonStyles from '../styles/Button.module.css'
import { AuthUser } from '../../../dist/main'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    setSession(supabase.auth.session())
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session?.user)
      } else {
        setSession(null)
        setAvatar(null)
      }
    })
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.log('Error logging out:', error.message)
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    try {
      if (!event.target.files || event.target.files.length == 0) {
        alert('You must select an image to upload')
        return
      }

      const file = event.target.files[0]
      console.log('file', file)
      const fileExt = file.name.split('.').pop()
      const fileName = `${session?.user.id}${Math.random()}.${fileExt}`
      console.log('fileName', fileName)
      const filePath = `avatars/${fileName}`

      let { data, error } = avatar
        ? await supabase.storage.uploadFile(filePath, file) // change this to update
        : await supabase.storage.uploadFile(filePath, file)

      if (error) {
        throw error
      }

      await supabase.from('profiles').update({ avatar_url: fileName })

      // await supabase.auth.update({
      //   data: {
      //     avatar: fileName,
      //   },
      // })
      setAvatar(null)
      setAvatar(fileName)
    } catch (error) {
      alert(error.message)
    }
  }

  async function fetchProfile(user: AuthUser) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select()
        .eq(user.id, user.id)
        .single()

      if (error) {
        throw error
      }
      setAvatar(profile.avatar_url)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  return (
    <div className={styles.container}>
      {!session ? (
        <Auth />
      ) : (
        <div
          style={{
            minWidth: 250,
            maxWidth: 600,
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div className={styles.card}>
            <div className={styles.avatarContainer}>
              <Avatar avatar={avatar} />
            </div>
            <UploadButton onUpload={uploadAvatar} />
          </div>

          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="text" value={session.user.email} disabled />
          </div>
          <div>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" />
          </div>
          <div>
            <label htmlFor="dob">Date of birth</label>
            <input id="dob" type="date" />
          </div>

          <div>
            <button className="button block primary" onClick={signOut}>
              Update profile
            </button>
          </div>

          <div>
            <button className="button block" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
