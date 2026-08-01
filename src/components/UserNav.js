'use client'

import { createClient } from '../utils/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function UserNav() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button onClick={handleSignOut} title="Sign Out" className="btn" style={{
      padding: '0.6rem',
      borderRadius: '50%',
      aspectRatio: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <LogOut size={16} />
    </button>
  )
}
