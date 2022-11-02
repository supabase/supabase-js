import { Profile } from '../lib/constants'
import Avatar from './Avatar'

export default function ProfileCard({ profile }: { profile: Profile }) {
  const lastUpdated = profile.updated_at ? new Date(profile.updated_at) : null
  return (
    <>
      <div className="profileCard">
        <div className="avatarContainer">
          <Avatar url={profile.avatar_url} size={200} />
        </div>
        <div className="userInfo">
          <p className="username">{profile.username}</p>
          <a href={profile.website} target="_blank" className="website">
            {profile.website}
          </a>
        </div>
      </div>
      <p style={{ marginTop: '0px' }}>
        <small>
          Last updated{' '}
          {lastUpdated
            ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`
            : 'Never'}
        </small>
      </p>
    </>
  )
}
