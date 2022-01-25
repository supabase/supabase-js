// This import is only included in the server build, because it's only used by getServerSideProps
import { supabase } from '../../lib/initSupabase'
import Layout from '../../components/layout'

function Profile({ user }) {
  return (
    <Layout user={user}>
      <h1>Profile</h1>

      <div>
        <h3>Profile (server rendered)</h3>
        <img src={user.user_metadata.picture} alt="user picture" />
        <p>nickname: {user.user_metadata.user_name}</p>
        <p>name: {user.user_metadata.name}</p>
        <p>email: {user.email}</p>
      </div>
    </Layout>
  )
}

export async function getServerSideProps({ req, res }) {
  // Here you can check authentication status directly before rendering the page,
  // however the page would be a serverless function, which is more expensive and
  // slower than a static page with client side authentication
  const { user, error } = await supabase.auth.api.getUserByCookie(req, res)
  console.log(error)

  if (!user) {
    res.writeHead(302, {
      Location: '/login',
    })
    res.end()
    return
  }

  return { props: { user } }
}

export default Profile
