import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import NessieDock from '@/components/NessieDock'
import {listPages} from '@/lib/hub/modules'
export default async function HubLayout({children}:{children:React.ReactNode}) {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user)redirect('/login')
  const {data:p}=await sb.from('profiles').select('role,full_name').eq('id',user.id).single()
  if(p?.role!=='team')redirect('/client')
  // Pages Nessie has built appear alongside the built-in ones.
  const built=await listPages().catch(()=>[])
  return(
    <div className="hq-bg" style={{display:'flex',minHeight:'100vh'}}>
      <Sidebar userName={p?.full_name?.split(' ')[0]??'Team'} builtPages={built.map(b=>({href:`/hub/x/${b.slug}`,label:b.title,icon:b.icon??'◆'}))}/>
      <main className="pt-14 md:pt-0 md:ml-[220px]" style={{flex:1,overflowY:'auto'}}>{children}</main>
      <NessieDock/>
    </div>
  )
}
