'use client'
import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
const NAV=[
  {href:'/hub',label:'Dashboard',icon:'⊞'},
  {href:'/hub/crm',label:'CRM',icon:'🤝'},
  {href:'/hub/brands',label:'Brands',icon:'📦'},
  {href:'/hub/content',label:'Content',icon:'✍️'},
  {href:'/hq',label:'HQ / AI Agents',icon:'⊕'},
  {href:'/hq/nessie',label:'Nessie',icon:'/nessie-emblem.jpg'},
  {href:'/client',label:'Client Portal',icon:'👤'},
  {href:'/account/security',label:'Security',icon:'🔒'},
]
export default function Sidebar({userName}:{userName:string}) {
  const pathname=usePathname()
  const router=useRouter()
  async function signOut(){const sb=createClient();await sb.auth.signOut();router.replace('/')}
  return(
    <aside style={{position:'fixed',left:0,top:0,bottom:0,width:220,background:'#0d0d1a',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',zIndex:20}}>
      <div style={{padding:'20px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:8,height:8,background:'#f0b429'}}/>
        <span style={{fontWeight:700,fontSize:13,color:'#f0f0f4',letterSpacing:1}}>FENCE HOLE HUB</span>
      </div>
      <nav style={{flex:1,padding:'12px 12px',display:'flex',flexDirection:'column',gap:2}}>
        {NAV.map(item=>{
          const active=item.href==='/hub'||item.href==='/hq'?pathname===item.href:pathname.startsWith(item.href)
          return<Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,color:active?'#f0f0f4':'#8888aa',background:active?'#16162a':'transparent',fontWeight:active?600:400,fontSize:14,textDecoration:'none'}}>
            {item.icon.startsWith('/')
              ? <img src={item.icon} alt="" style={{width:18,height:18,borderRadius:'50%',objectFit:'cover',boxShadow:active?'0 0 0 1px rgba(240,180,41,.5)':'none'}}/>
              : <span>{item.icon}</span>}
            <span>{item.label}</span>
          </Link>
        })}
      </nav>
      <div style={{padding:'16px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:14,background:'#f0b429',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,color:'#08080f'}}>{userName.charAt(0).toUpperCase()}</div>
          <span style={{fontSize:13,fontWeight:500,color:'#f0f0f4'}}>{userName}</span>
        </div>
        <button onClick={signOut} style={{color:'#44445a',background:'none',border:'none',cursor:'pointer',fontSize:16}}>⏏</button>
      </div>
    </aside>
  )
}
