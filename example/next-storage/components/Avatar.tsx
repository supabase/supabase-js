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
    async function downloadImage(path: string) {
      const res = await supabase.storage.downloadFile(path)
      const url = URL.createObjectURL(res.data)
      setAvatarUrl(url)
    }

    if (avatar) {
      downloadImage(`avatars/${avatar}`)
    }
  }, [avatar])

  return avatarUrl ? (
    <img src={avatarUrl} className={styles.image} />
  ) : (
    <div className={styles.noImage} />
  )
}
