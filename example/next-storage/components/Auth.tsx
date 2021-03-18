import { useState } from 'react'
import { supabase } from '../lib/api'
import styles from '../styles/Auth.module.css'
import buttonStyles from '../styles/Button.module.css'

export default function Auth({}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (type: 'LOGIN' | 'SIGNUP', email: string, password: string) => {
    try {
      const { error, user } =
        type === 'LOGIN'
          ? await supabase.auth.signIn({ email, password })
          : await supabase.auth.signUp({ email, password })
      console.log(error)
      console.log(user)
      if ((!error && !user) || (user && !user.confirmed_at))
        alert('Check your email for the login link!')
      if (error) alert(error.message)
    } catch (error) {
      console.log('Error thrown:', error.message)
      alert(error.error_description || error)
    }
  }

  async function forgotPassword(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault()
    var email = prompt('Please enter your email:')
    if (email === null || email === '') {
      window.alert('You must enter your email.')
    } else {
      let { error } = await supabase.auth.api.resetPasswordForEmail(email)
      if (error) {
        console.log('Error: ', error.message)
      } else {
        alert('Password recovery email has been sent.')
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.containerInner}>
        <div className={styles.inputContainer}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className={styles.input}
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={styles.inputContainer}>
          <label className={styles.label}>Password</label>
          <input
            type="password"
            className={styles.input}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.buttonContainer}>
          <button
            onClick={(e) => {
              e.preventDefault()
              handleLogin('SIGNUP', email, password)
            }}
            className={buttonStyles.primaryButton}
          >
            Sign up
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              handleLogin('LOGIN', email, password)
            }}
            className={buttonStyles.primaryButton}
          >
            {password.length ? 'Sign in' : 'Send magic link'}
          </button>

          <a onClick={forgotPassword} className={buttonStyles.linkButton}>
            Forgot your password?
          </a>
        </div>
      </div>
    </div>
  )
}
