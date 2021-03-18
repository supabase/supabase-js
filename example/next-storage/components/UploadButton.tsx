import { ChangeEventHandler } from 'react'
import styles from '../styles/UploadButton.module.css'

export type UploadButtonProps = {
  onUpload: ChangeEventHandler<HTMLInputElement>
}

export default function UploadButton(props: UploadButtonProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="single">
        Upload your avatar
      </label>
      <input
        className={styles.input}
        type="file"
        id="single"
        accept="image/*"
        onChange={props.onUpload}
      />
    </div>
  )
}
