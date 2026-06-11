import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
export default async function AccountLayout({children}:{children:React.ReactNode}) {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user)redirect('/login')
  return <div style={{minHeight:'100vh',background:'#08080f'}}>{children}</div>
}
