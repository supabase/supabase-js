import { useEffect, useState } from 'react'
import { supabase } from '../lib/api'
import styles from '../styles/Avatar.module.css'

export type UploadButtonProps = {
  avatar?: string | null
}

export default function Avatar(props: UploadButtonProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { avatar } = props

  useEffect(() => {
    if (avatar) {
      console.log('avatar', avatar)
      downloadImage(`avatars/${avatar}`)
    }
  }, [avatar])

  async function downloadImage(path: string) {
    try {
      const { data, error } = await supabase.storage.downloadFile(path)
      if (error) {
        throw error
      }
      const url = URL.createObjectURL(data)
      setAvatarUrl(url)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  return avatarUrl ? (
    <img src={avatarUrl} className={styles.image} />
  ) : (
    <div className={styles.noImage} />
  )
}
