'use client'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
interface Project{id:string;name:string;brand:string;status:string;description:string|null}
interface Message{id:string;content:string;created_at:string;is_team:boolean;author_name:string}
const STATUS:Record<string,{label:string;color:string}>={in_progress:{label:'In Progress',color:'#f0b429'},review:{label:'In Review',color:'#3b9eff'},complete:{label:'Complete',color:'#34d399'},on_hold:{label:'On Hold',color:'#44445a'}}
export default function ClientPage(){
  const router=useRouter()
  const [userName,setUserName]=useState('');const [isTeam,setIsTeam]=useState(false);const [projects,setProjects]=useState<Project[]>([]);const [selected,setSelected]=useState<Project|null>(null);const [messages,setMessages]=useState<Message[]>([]);const [newMsg,setNewMsg]=useState('');const [loading,setLoading]=useState(true);const [sending,setSending]=useState(false)
  useEffect(()=>{
    const sb=createClient()
    sb.auth.getUser().then(async({data:{user}})=>{
      if(!user){router.replace('/login');return}
      setUserName(user.user_metadata?.full_name?.split(' ')[0]??'there')
      const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).single()
      const team=p?.role==='team';setIsTeam(team)
      const q=sb.from('client_projects').select('*').order('updated_at',{ascending:false})
      if(!team)q.eq('client_id',user.id)
      const {data:list}=await q
      const ps=list??[];setProjects(ps)
      if(ps.length>0){setSelected(ps[0]);fetchMessages(ps[0].id)}
      setLoading(false)
    })
  },[])
  async function fetchMessages(pid:string){
    const sb=createClient()
    const {data}=await sb.from('client_messages').select('id,content,created_at,is_team,profiles(full_name)').eq('project_id',pid).order('created_at',{ascending:true}).limit(100)
    setMessages((data??[]).map((m:any)=>({id:m.id,content:m.content,created_at:m.created_at,is_team:m.is_team,author_name:m.profiles?.full_name??(m.is_team?'Fence Hole Team':'Client')})))
  }
  async function sendMessage(e:React.FormEvent){
    e.preventDefault();if(!newMsg.trim()||!selected)return;setSending(true)
    const sb=createClient();const {data:{user}}=await sb.auth.getUser()
    await sb.from('client_messages').insert({project_id:selected.id,content:newMsg.trim(),author_id:user?.id,is_team:isTeam})
    setNewMsg('');setSending(false);fetchMessages(selected.id)
  }
  if(loading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#08080f'}}><p style={{color:'#44445a',fontSize:14}}>Loading…</p></div>
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'#08080f'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div>
          {isTeam&&<button onClick={()=>router.replace('/hub')} style={{fontSize:11,color:'#a78bfa',background:'none',border:'none',cursor:'pointer',display:'block',marginBottom:4}}>← Team Hub</button>}
          <p style={{fontSize:9,fontWeight:700,letterSpacing:3,color:'#a78bfa',marginBottom:2}}>CLIENT PORTAL</p>
          <p style={{fontSize:20,fontWeight:700,color:'#f0f0f4'}}>Hey, {userName}</p>
        </div>
        <button onClick={async()=>{const sb=createClient();await sb.auth.signOut();router.replace('/')}} style={{fontSize:13,color:'#44445a',background:'none',border:'none',cursor:'pointer',marginTop:4}}>Sign out</button>
      </div>
      {projects.length===0?(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:40}}>
          <div style={{fontSize:48}}>🛠️</div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#f0f0f4'}}>No projects yet</h2>
          <p style={{fontSize:14,color:'#8888aa',textAlign:'center',maxWidth:280,lineHeight:1.6}}>Your Fence Hole team will add your project here soon.</p>
        </div>
      ):(
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',gap:8,padding:'12px 16px',overflowX:'auto',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            {projects.map(p=>{const st=STATUS[p.status];return(
              <button key={p.id} onClick={()=>{setSelected(p);fetchMessages(p.id)}} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,border:`1px solid ${selected?.id===p.id?'#a78bfa':'rgba(255,255,255,0.06)'}`,background:selected?.id===p.id?'#16162a':'#111120',color:selected?.id===p.id?'#f0f0f4':'#44445a',fontSize:13,fontWeight:500,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                {p.name}{st&&<div style={{width:6,height:6,borderRadius:3,background:st.color}}/>}
              </button>
            )})}
          </div>
          {selected&&<>
            <div className="card" style={{margin:'12px 16px',padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:'#44445a',marginBottom:2}}>{selected.brand.toUpperCase()}</p><p style={{fontWeight:600,color:'#f0f0f4'}}>{selected.name}</p></div>
              {STATUS[selected.status]&&<span className="chip" style={{background:STATUS[selected.status].color+'20',color:STATUS[selected.status].color,border:`1px solid ${STATUS[selected.status].color}40`}}>{STATUS[selected.status].label}</span>}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 16px',display:'flex',flexDirection:'column',gap:8}}>
              {messages.length===0&&<p style={{textAlign:'center',color:'#44445a',fontSize:13,marginTop:32}}>No messages yet. Say hi below.</p>}
              {messages.map(m=>(
                <div key={m.id} style={{maxWidth:'75%',padding:12,borderRadius:12,alignSelf:m.is_team?'flex-start':'flex-end',background:m.is_team?'#16162a':'#1a1508'}}>
                  <p style={{fontSize:10,fontWeight:700,color:m.is_team?'#a78bfa':'#f0b429',marginBottom:4}}>{m.author_name}</p>
                  <p style={{fontSize:14,color:'#f0f0f4',lineHeight:1.5}}>{m.content}</p>
                  <p style={{fontSize:10,color:'#44445a',marginTop:4}}>{new Date(m.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} style={{display:'flex',gap:8,padding:12,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <input className="input" style={{flex:1}} value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Message your team…" maxLength={1000}/>
              <button type="submit" className="btn-primary" disabled={!newMsg.trim()||sending}>{sending?'…':'Send'}</button>
            </form>
          </>}
        </div>
      )}
    </div>
  )
}
