import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
export default async function HubLayout({children}:{children:React.ReactNode}) {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user)redirect('/login')
  const {data:p}=await sb.from('profiles').select('role,full_name').eq('id',user.id).single()
  if(p?.role!=='team')redirect('/client')
  return(
    <div style={{display:'flex',minHeight:'100vh',background:'#08080f'}}>
      <Sidebar userName={p?.full_name?.split(' ')[0]??'Team'}/>
      <main style={{flex:1,overflowY:'auto',marginLeft:220}}>{children}</main>
    </div>
  )
}
