import {createClient} from '@/lib/supabase/server'
import {BRANDS} from '@/lib/constants'
import Link from 'next/link'
export default async function DashboardPage() {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  const [{data:p},{data:deals},{data:tasks},{data:ideas}]=await Promise.all([
    sb.from('profiles').select('full_name').eq('id',user!.id).single(),
    sb.from('deals').select('id').in('status',['new','in_talks','negotiating']),
    sb.from('tasks').select('id').eq('status','todo'),
    sb.from('content_ideas').select('id').eq('status','idea'),
  ])
  const name=p?.full_name?.split(' ')[0]??'Team'
  return(
    <div style={{padding:32,maxWidth:900}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#f0b429',marginBottom:4}}>FENCE HOLE HUB</p>
      <h1 className="font-display" style={{fontSize:32,fontWeight:600,color:'#f0f0f4',marginBottom:12}}>Hey, {name}</h1>
      <div className="gold-divider" style={{width:64,marginBottom:32}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:32}}>
        {[{label:'Active Deals',value:deals?.length??0,color:'#f0b429',href:'/hub/crm'},{label:'Open Tasks',value:tasks?.length??0,color:'#3b9eff',href:'/hub/brands'},{label:'Story Ideas',value:ideas?.length??0,color:'#34d399',href:'/hub/content'}].map(s=>(
          <Link key={s.label} href={s.href} className="card" style={{padding:20,display:'block',textDecoration:'none'}}>
            <p style={{fontSize:28,fontWeight:700,color:s.color,marginBottom:4}}>{s.value}</p>
            <p style={{fontSize:12,color:'#8888aa'}}>{s.label}</p>
          </Link>
        ))}
      </div>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#44445a',marginBottom:16}}>BRAND WORKSPACES</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
        {BRANDS.map(b=>(
          <Link key={b.id} href={`/hub/brands/${b.id}`} className="card" style={{padding:20,display:'block',textDecoration:'none',borderTop:`2px solid ${b.color}`}}>
            <p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:b.color,marginBottom:4}}>{b.tag}</p>
            <p style={{fontSize:16,fontWeight:700,color:'#f0f0f4',marginBottom:4}}>{b.name}</p>
            <p style={{fontSize:12,color:'#8888aa',lineHeight:1.5}}>{b.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
