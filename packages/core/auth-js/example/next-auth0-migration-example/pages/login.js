import SupabaseAuth from '../components/SupabaseAuth'
import Layout from '../components/layout'

export default function Login() {
  return (
    <Layout user={null} loading={false}>
      <SupabaseAuth />
    </Layout>
  )
}
