import { useState, useEffect } from 'react'
import { supabase } from '../lib/api'
import Auth from '../components/Auth'
import TodoList from '../components/TodoList'

export default function IndexPage() {
  let [session, setSession] = useState(null)

  useEffect(() => {
    setSession(supabase.auth.currentSession)
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    // console.log('supabase.auth.currentUser', supabase.auth.currentUser)
    // console.log('supabase.auth.currentSession', supabase.auth.currentSession)
  }, [])

  return (
    <div className="w-full h-full bg-gray-900">
      {!session ? (
        <div className="w-full h-full flex justify-center items-center p-4">
          <Auth onLoggedIn={(session) => setSession(session)} />
        </div>
      ) : (
        <div
          className="w-full h-full flex flex-col justify-center items-center p-4"
          style={{ minWidth: 250, maxWidth: 600, margin: 'auto' }}
        >
          <TodoList user={supabase.auth.currentUser} />
          <button className="btn-black w-full mt-12" onClick={() => supabase.auth.signOut()}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
