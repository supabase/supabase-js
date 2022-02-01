import Layout from '../components/layout'
import { useFetchUser } from '../lib/user'

function Home() {
  const { user, loading } = useFetchUser()
  console.log(user)
  return (
    <Layout user={user} loading={loading}>
      <h1>Next.js and Auth0 Example</h1>

      {loading && <p>Loading login info...</p>}

      {!loading && !user && (
        <>
          <p>
            To test the login click in <i>Login</i>
          </p>
          <p>
            Once you have logged in you should be able to click in <i>Profile</i> and <i>Logout</i>
          </p>
        </>
      )}

      {user && (
        <>
          <h4>Rendered user info on the client</h4>
          <img src={user.user_metadata.picture} alt="user picture" />
          <p>nickname: {user.user_metadata.user_name}</p>
          <p>name: {user.user_metadata.name}</p>
          <p>email: {user.email}</p>
        </>
      )}
    </Layout>
  )
}

export default Home
