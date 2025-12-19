import { useEffect, useRef, useState } from 'react'
import { AuthClient } from '@supabase/auth-js'
import type { Session, UserIdentity, Provider } from '@supabase/auth-js'

const supabaseURL = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

const auth = new AuthClient({
  url: `${supabaseURL}/auth/v1`,
  headers: {
    accept: 'json',
    apikey: supabasePublishableKey,
  },
})

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState(localStorage.getItem('email') ?? '')
  const [phone, setPhone] = useState(localStorage.getItem('phone') ?? '')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const modalRef = useRef<HTMLDialogElement>(null)
  const [showModal, setShowModal] = useState(false)

  async function getSession() {
    const { data, error } = await auth.getSession()
    if (error || !data) {
      setSession(null)
    } else {
      setSession(data.session)
    }
  }

  useEffect(() => {
    // Check for token_hash in URL (magic link callback)
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (token_hash) {
      auth
        .verifyOtp({
          token_hash,
          type: (type as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email') || 'email',
        })
        .then(({ error }) => {
          if (error) {
            console.error('Error verifying token:', error.message)
          }
          // Clear URL params
          window.history.replaceState({}, document.title, '/')
        })
    }

    getSession()
  }, [])

  useEffect(() => {
    const { data: subscription } = auth.onAuthStateChange((event, session) => {
      console.log(event, session)
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        setSession(session)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function handleOAuthLogin(provider: Provider) {
    const { error } = await auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/welcome`,
      },
    })
    if (error) console.log('Error: ', error.message)
  }

  async function handleVerifyOtp() {
    await auth.verifyOtp({ phone: phone, token: otp, type: 'sms' })
  }

  async function handleSendOtp() {
    await auth.signInWithOtp({ phone: phone })
  }

  async function handleEmailSignIn() {
    if (rememberMe) {
      localStorage.setItem('email', email)
    } else {
      localStorage.removeItem('email')
    }

    const { error, data } = password
      ? await auth.signInWithPassword({ email, password })
      : await auth.signInWithOtp({ email })
    if (!error && !data) alert('Check your email for the login link!')
    if (error) console.log('Error: ', error.message)
  }

  async function handleEmailSignUp() {
    const { error } = await auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/welcome` },
    })
    if (error) console.log('Error: ', error.message)
  }

  async function handleSignOut() {
    const { error } = await auth.signOut()
    if (error) console.log('Error: ', error)
  }

  async function handleSignInAnonymously(data: Record<string, unknown>) {
    const { error } = await auth.signInAnonymously({ options: { data } })
    if (error) alert(error.message)
  }

  async function forgotPassword() {
    const userEmail = prompt('Please enter your email:')
    if (userEmail === null || userEmail === '') {
      window.alert('You must enter your email.')
    } else {
      const { error } = await auth.resetPasswordForEmail(userEmail)
      if (error) {
        console.log('Error: ', error.message)
      } else {
        alert('Password recovery email has been sent.')
      }
    }
  }

  const showIdentities = () => {
    return session?.user?.identities?.map((identity: UserIdentity) => {
      return (
        <div key={identity.identity_id} className="flex flex-row p-2 my-2 bg-gray-200 max-h-100 rounded">
          <div className="basis-1/4 p-2">
            {identity.provider[0].toUpperCase() + identity.provider.slice(1)}
          </div>
          <div className="w-full basis-1/2 p-2">{identity?.identity_data?.email}</div>
          <div>
            <button
              className="w-full basis-1/4 p-2 font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:border-gray-700 active:bg-gray-700 transition duration-150 ease-in-out"
              onClick={() => handleUnlinkIdentity(identity)}
              type="button"
            >
              Unlink
            </button>
          </div>
        </div>
      )
    })
  }

  const showLinkingOptions = () => {
    setShowModal(!showModal)
    if (showModal && !modalRef.current?.open) {
      modalRef.current?.showModal()
    } else {
      modalRef.current?.close()
    }
  }

  const linkingOptionsModal = () => {
    return (
      <dialog className="bg-white shadow sm:rounded-lg" ref={modalRef}>
        <p className="block text-sm font-medium leading-5 text-gray-700">Continue linking with:</p>
        <div className="mt-6">
          <div className="m-2">
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => auth.linkIdentity({ provider: 'github' })}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                GitHub
              </button>
            </span>
          </div>
          <div className="m-2">
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => auth.linkIdentity({ provider: 'google' })}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                Google
              </button>
            </span>
          </div>
        </div>
        <button
          className="text-sm font-medium leading-5 text-gray-700"
          type="button"
          onClick={showLinkingOptions}
        >
          Close
        </button>
      </dialog>
    )
  }

  async function handleUnlinkIdentity(identity: UserIdentity) {
    const { error } = await auth.unlinkIdentity(identity)
    if (error) {
      alert(error.message)
    } else {
      alert(`successfully unlinked ${identity.provider} identity`)
      const { data, error: refreshSessionError } = await auth.refreshSession()
      if (refreshSessionError) alert(refreshSessionError.message)
      setSession(data.session)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white p-4 shadow sm:rounded-lg mb-10">
          <p className="block text-sm font-medium leading-5 text-gray-700">Active session</p>
          <pre
            className="p-2 text-xs overflow-scroll bg-gray-200 max-h-100 rounded"
            style={{ maxHeight: 150 }}
          >
            {!session ? 'None' : JSON.stringify(session, null, 2)}
          </pre>
          {session && (
            <div className="mt-2">
              <span className="block w-full rounded-md shadow-sm">
                <button
                  onClick={() => handleSignOut()}
                  type="button"
                  className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:border-gray-700 active:bg-gray-700 transition duration-150 ease-in-out"
                >
                  Sign out
                </button>
              </span>
            </div>
          )}
        </div>

        <div className="bg-white p-4 shadow sm:rounded-lg mb-10">
          <p className="block text-sm font-medium leading-5 text-gray-700">Identities</p>
          {showIdentities()}
          <button
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:border-gray-700 active:bg-gray-700 transition duration-150 ease-in-out"
            type="button"
            onClick={showLinkingOptions}
          >
            Link Identity
          </button>
          {linkingOptionsModal()}
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-5 text-gray-700">
              Email address
            </label>
            <div className="mt-1 rounded-md shadow-sm">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm sm:leading-5"
              />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="password" className="block text-sm font-medium leading-5 text-gray-700">
              Password
            </label>
            <div className="mt-1 rounded-md shadow-sm">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm sm:leading-5"
              />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="phone" className="block text-sm font-medium leading-5 text-gray-700">
              Phone (for OTP)
            </label>
            <div className="mt-1 rounded-md shadow-sm">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm sm:leading-5"
              />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="otp" className="block text-sm font-medium leading-5 text-gray-700">
              OTP Code
            </label>
            <div className="mt-1 rounded-md shadow-sm">
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm sm:leading-5"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
              />
              <label htmlFor="remember_me" className="ml-2 block text-sm leading-5 text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm leading-5">
              <button
                onClick={forgotPassword}
                type="button"
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline transition ease-in-out duration-150"
              >
                Forgot your password?
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => handleEmailSignIn()}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                {password.length ? 'Sign in' : 'Send magic link'}
              </button>
            </span>
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => handleEmailSignUp()}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                Sign Up
              </button>
            </span>
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => handleSendOtp()}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                Send OTP
              </button>
            </span>
            <span className="block w-full rounded-md shadow-sm">
              <button
                onClick={() => handleVerifyOtp()}
                type="button"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
              >
                Verify OTP
              </button>
            </span>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm leading-5">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <span className="block w-full rounded-md shadow-sm">
                <button
                  onClick={() => handleOAuthLogin('github')}
                  type="button"
                  className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
                >
                  GitHub
                </button>
              </span>
              <span className="block w-full rounded-md shadow-sm">
                <button
                  onClick={() => handleOAuthLogin('google')}
                  type="button"
                  className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
                >
                  Google
                </button>
              </span>
              <span className="block w-full rounded-md shadow-sm">
                <button
                  onClick={() => handleSignInAnonymously({ color: 'blue' })}
                  type="button"
                  className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 active:bg-indigo-700 transition duration-150 ease-in-out"
                >
                  Sign In Anonymously
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
