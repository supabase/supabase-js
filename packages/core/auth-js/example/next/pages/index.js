import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '../utils/useAuth';
import { supabase } from '../utils/initSupabase';
import SupabaseAuth from '../components/SupabaseAuth';

const fetcher = (url) =>
  fetch(url, {
    method: 'GET',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    credentials: 'same-origin',
  }).then((res) => res.json());

const Index = () => {
  const { user } = useAuth();
  const { data, error } = useSWR(user ? '/api/getUser' : null, fetcher);
  if (!user) {
    return (
      <>
        <p>Hi there!</p>
        <p>You are not signed in.</p>
        <div>
          <SupabaseAuth />
        </div>
      </>
    );
  }

  return (
    <div>
      <p
        style={{
          display: 'inline-block',
          color: 'blue',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
        onClick={() => supabase.auth.signOut()}
      >
        Log out
      </p>
      <div>
        <p>You're signed in. Email: {user.email}</p>
      </div>
      {error && <div>Failed to fetch user!</div>}
      {data && !error ? (
        <div>
          <span>User data retrieved server-side (in API route):</span>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : (
        <div>Loading...</div>
      )}

      <Link href="/profile">
        <a>SSR example with getServerSideProps</a>
      </Link>
    </div>
  );
};

export default Index;
