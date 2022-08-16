import ProfileCard from '../components/ProfileCard'
import { Profile } from '../lib/constants'
import { supabase } from '../lib/api'
import { useState, useEffect } from 'react'

export default function ProfileList() {
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => {
    // getPublicProfiles()
    getUserProfile()

    const realtimeProfiles = supabase
      .channel('profiles-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload: { [key: string]: any }) => profileUpdated(profiles, payload.new)
      )
      .subscribe()

    return () => {
      if (realtimeProfiles) supabase.removeChannel(realtimeProfiles)
    }
  }, [])

  function profileUpdated(profileList: Profile[], updated: Profile) {
    const otherProfiles = profileList.filter((x) => x.id != updated.id)
    setProfiles([updated, ...otherProfiles])
  }

  async function getUserProfile() {
    const { user } = await supabase.auth.getUser()
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, website, updated_at')
        .eq('id', user?.id)
        .order('updated_at', { ascending: false })
      if (error) {
        throw error
      }
      setProfiles(data)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  async function getPublicProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, website, updated_at')
        .order('updated_at', { ascending: false })
      if (error) {
        throw error
      }
      setProfiles(data)
    } catch (error) {
      console.log('error', error.message)
    }
  }

  return (
    <>
      {profiles?.map((profile) => (
        <ProfileCard profile={profile} key={profile.id} />
      ))}
    </>
  )
}
