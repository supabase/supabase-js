import { Profile } from '../lib/constants'
import Avatar from './Avatar'

export default function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="card">
      <Avatar url={profile.avatar_url} size={50} />
      <p>{profile.id}</p>
      <p>{profile.username}</p>
    </div>
  )
}
