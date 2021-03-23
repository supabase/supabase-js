import { Profile } from '../lib/constants'
import Avatar from './Avatar'

export default function ProfileCard({ profile }: { profile: Profile }) {
  const lastUpdated = profile.updated_at ? new Date(profile.updated_at) : null
  return (
    <div className="card">
      <Avatar url={profile.avatar_url} size={50} />
      <p>Username: {profile.username}</p>
      <p>Website: {profile.website}</p>
      <p>
        <small>
          Last updated{' '}
          {lastUpdated
            ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`
            : 'Never'}
        </small>
      </p>
    </div>
  )
}
