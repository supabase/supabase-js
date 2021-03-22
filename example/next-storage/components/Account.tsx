import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '../lib/api'
import UploadButton from '../components/UploadButton'
import Avatar from '../components/Avatar'
import styles from '../styles/Home.module.css'
import { AuthSession } from '../../../dist/main'
import { DEFAULT_AVATARS_BUCKET } from '../lib/constants'

type Profile = {
  avatar_url: string
  username: string
  dob: string
}

export default function Account({ session }: { session: AuthSession }) {
  const [avatar, setAvatar] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [dob, setDob] = useState<string | null>(null)

  useEffect(() => {
    getProfile()
  }, [session])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.log('Error logging out:', error.message)
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    try {
      const user = supabase.auth.user()

      if (!event.target.files || event.target.files.length == 0) {
        throw 'You must select an image to upload.'
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${session?.user.id}${Math.random()}.${fileExt}`
      const filePath = `${DEFAULT_AVATARS_BUCKET}/${fileName}`

      let { error: uploadError } = await supabase.storage.uploadFile(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      let { error: updateError } = await supabase.from('profiles').upsert({
        id: user.id,
        avatar_url: fileName,
      })

      if (updateError) {
        throw updateError
      }

      setAvatar(null)
      setAvatar(fileName)
    } catch (error) {
      alert(error.message)
    }
  }

  function setProfile(profile: Profile) {
    setAvatar(profile.avatar_url)
    setUsername(profile.username)
    setDob(profile.dob)
  }

  async function getProfile() {
    try {
      const user = supabase.auth.user()

      let { data, error } = await supabase
        .from('profiles')
        .select(`username, dob, avatar_url`)
        .eq('id', user.id)
        .single()

      if (error) {
        throw error
      }

      setProfile(data)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  async function updateProfile() {
    try {
      const user = supabase.auth.user()

      const updates = {
        id: user.id,
        username,
        dob,
      }

      let { error } = await supabase.from('profiles').upsert(updates, {
        returning: 'minimal', // Don't return the value after inserting
      })

      if (error) {
        throw error
      }
    } catch (error) {
      alert(error.message)
    }
  }

  return (
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
        <input
          id="username"
          type="text"
          value={username || ''}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="dob">Date of birth</label>
        <input id="dob" type="date" value={dob || ''} onChange={(e) => setDob(e.target.value)} />
      </div>

      <div>
        <button className="button block primary" onClick={() => updateProfile()}>
          Update profile
        </button>
      </div>

      <div>
        <button className="button block" onClick={() => signOut()}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
