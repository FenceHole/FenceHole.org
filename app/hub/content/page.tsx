'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {CONTENT_STATUSES} from '@/lib/constants'
interface Idea{id:string;title:string;source_url:string|null;status:string;notes:string|null}
export default function ContentPage() {
  const [ideas,setIdeas]=useState<Idea[]>([])
  const [loading,setLoading]=useState(true)
  const [showModal,setShowModal]=useState(false)
  useEffect(()=>{fetchIdeas()},[])
  async function fetchIdeas(){
    setLoading(true);const sb=createClient()
    const {data}=await sb.from('content_ideas').select('id,title,source_url,status,notes').order('created_at',{ascending:false})
    setIdeas(data??[]);setLoading(false)
  }
  async function move(id:string,status:string){
    const sb=createClient();await sb.from('content_ideas').update({status}).eq('id',id)
    setIdeas(p=>p.map(i=>i.id===id?{...i,status}:i))
  }
  return(
    <div className="page-pad" style={{height:'100vh',display:'flex',flexDirection:'column'}}>
      <div className="header-row" style={{marginBottom:24}}>
        <div><p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#44445a',marginBottom:4}}>THE GOOD MEOW</p><h1 style={{fontSize:28,fontWeight:700,color:'#f0f0f4'}}>Content Pipeline</h1></div>
        <button className="btn-primary" onClick={()=>setShowModal(true)}>+ Add Story Idea</button>
      </div>
      {loading?<p style={{color:'#44445a',fontSize:14}}>Loading…</p>:(
        <div style={{display:'flex',gap:16,flex:1,overflowX:'auto',paddingBottom:16}}>
          {CONTENT_STATUSES.map(col=>(
            <div key={col.id} style={{width:260,flexShrink:0,display:'flex',flexDirection:'column'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:2,color:'#44445a'}}>{col.label.toUpperCase()}</p>
                <span style={{fontSize:11,color:'#44445a',background:'#111120',padding:'1px 6px',borderRadius:10}}>{ideas.filter(i=>i.status===col.id).length}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8,flex:1}}>
                {ideas.filter(i=>i.status===col.id).map(idea=>(
                  <div key={idea.id} className="card" style={{padding:12}}>
                    <p style={{fontSize:13,fontWeight:500,color:'#f0f0f4',lineHeight:1.4,marginBottom:6}}>{idea.title}</p>
                    {idea.source_url&&<a href={idea.source_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#34d399',textDecoration:'none'}}>Source ↗</a>}
                    {idea.notes&&<p style={{fontSize:11,color:'#44445a',marginTop:6,lineHeight:1.4}}>{idea.notes}</p>}
                    <div style={{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}}>
                      {CONTENT_STATUSES.filter(s=>s.id!==idea.status).map(s=>(
                        <button key={s.id} onClick={()=>move(idea.id,s.id)} style={{fontSize:10,padding:'2px 6px',background:'#1a1a2a',color:'#44445a',border:'none',borderRadius:4,cursor:'pointer'}}>→ {s.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {ideas.filter(i=>i.status===col.id).length===0&&<div style={{border:'1px dashed rgba(255,255,255,0.06)',borderRadius:8,padding:'24px 0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#44445a'}}>Empty</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
          <div className="card" style={{width:'100%',maxWidth:420,padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}><h2 style={{fontWeight:700,fontSize:18,color:'#f0f0f4'}}>New Story Idea</h2><button onClick={()=>setShowModal(false)} style={{color:'#44445a',background:'none',border:'none',fontSize:20,cursor:'pointer'}}>×</button></div>
            <NewIdeaForm onSaved={()=>{setShowModal(false);fetchIdeas()}} onClose={()=>setShowModal(false)}/>
          </div>
        </div>
      )}
    </div>
  )
}
function NewIdeaForm({onSaved,onClose}:{onSaved:()=>void;onClose:()=>void}){
  const [title,setTitle]=useState('');const [url,setUrl]=useState('');const [notes,setNotes]=useState('');const [loading,setLoading]=useState(false)
  async function save(e:React.FormEvent){
    e.preventDefault();setLoading(true);const sb=createClient()
    await sb.from('content_ideas').insert({title,source_url:url||null,notes:notes||null,status:'idea',source_type:'manual',brand_id:'the-good-meow'})
    setLoading(false);onSaved()
  }
  return(
    <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><label className="label">Headline *</label><input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Why cats knock things off tables" required/></div>
      <div><label className="label">Source URL</label><input className="input" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></div>
      <div><label className="label">Notes</label><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Angle, tone, key points…"/></div>
      <div style={{display:'flex',gap:8}}><button type="button" className="btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" style={{flex:1,background:'#34d399',color:'#08080f'}} disabled={loading}>{loading?'Saving…':'Add to Pipeline'}</button></div>
    </form>
  )
}
