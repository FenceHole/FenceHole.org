'use client'
import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
const NAV=[
  {href:'/hub',label:'Dashboard',icon:'⊞'},
  {href:'/hub/me',label:'My Desk',icon:'★'},
  {href:'/hub/chat',label:'Team Chat',icon:'💬'},
  {href:'/hub/todo',label:'Daily To-Do',icon:'✓'},
  {href:'/hub/inbox',label:'Inbox',icon:'✉️'},
  {href:'/hub/calendar',label:'Calendar',icon:'📅'},
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
  const [open,setOpen]=useState(false)
  useEffect(()=>{setOpen(false)},[pathname])
  async function signOut(){const sb=createClient();await sb.auth.signOut();router.replace('/')}
  return(
    <>
      <div className="md:hidden" style={{position:'fixed',top:0,left:0,right:0,height:56,background:'#0d0d1a',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12,padding:'0 16px',zIndex:30}}>
        <button onClick={()=>setOpen(true)} aria-label="Open menu" style={{background:'none',border:'none',color:'#f0f0f4',fontSize:22,cursor:'pointer',padding:4,lineHeight:1}}>☰</button>
        <img src="/nessie-emblem.jpg" alt="" className="emblem-ring" style={{width:22,height:22,borderRadius:'50%',objectFit:'cover'}}/>
        <span className="font-display" style={{fontWeight:700,fontSize:12,color:'#f0f0f4',letterSpacing:2}}>FENCE HOLE HUB</span>
      </div>

      {open && (
        <div
          className="md:hidden"
          onClick={()=>setOpen(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:35}}
        />
      )}

      <aside
        className={`md:translate-x-0 ${open?'translate-x-0':'-translate-x-full'}`}
        style={{position:'fixed',left:0,top:0,bottom:0,width:220,background:'#0d0d1a',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',zIndex:40,transition:'transform .2s ease'}}
      >
        <div style={{padding:'20px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:10}}>
          <img src="/nessie-emblem.jpg" alt="" className="emblem-ring" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}}/>
          <span className="font-display" style={{fontWeight:700,fontSize:12,color:'#f0f0f4',letterSpacing:2}}>FENCE HOLE HUB</span>
          <button onClick={()=>setOpen(false)} className="md:hidden" aria-label="Close menu" style={{marginLeft:'auto',background:'none',border:'none',color:'#8888aa',fontSize:18,cursor:'pointer',padding:4}}>✕</button>
        </div>
        <nav style={{flex:1,padding:'12px 12px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
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
    </>
  )
}
