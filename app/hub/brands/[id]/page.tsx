'use client'
import {useParams} from 'next/navigation'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
import {BRANDS} from '@/lib/constants'
interface Note{id:string;content:string;created_at:string;author_name:string}
interface Task{id:string;title:string;status:string;due_date:string|null}
export default function BrandPage() {
  const {id}=useParams<{id:string}>()
  const brand=BRANDS.find(b=>b.id===id)
  const [tab,setTab]=useState<'notes'|'tasks'>('notes')
  const [notes,setNotes]=useState<Note[]>([])
  const [tasks,setTasks]=useState<Task[]>([])
  const [newNote,setNewNote]=useState('')
  const [newTask,setNewTask]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  useEffect(()=>{if(brand)fetchAll()},[brand?.id])
  async function fetchAll(){
    if(!brand)return;setLoading(true)
    const sb=createClient()
    const [{data:n},{data:t}]=await Promise.all([
      sb.from('notes').select('id,content,created_at,profiles(full_name)').eq('brand_id',brand.id).order('created_at',{ascending:false}).limit(50),
      sb.from('tasks').select('id,title,status,due_date').eq('brand_id',brand.id).order('created_at',{ascending:false}),
    ])
    setNotes((n??[]).map((x:any)=>({...x,author_name:x.profiles?.full_name??'Team'})))
    setTasks(t??[]);setLoading(false)
  }
  async function addNote(e:React.FormEvent){
    e.preventDefault();if(!newNote.trim()||!brand)return;setSaving(true)
    const sb=createClient();const {data:{user}}=await sb.auth.getUser()
    await sb.from('notes').insert({brand_id:brand.id,content:newNote.trim(),author_id:user?.id})
    setNewNote('');setSaving(false);fetchAll()
  }
  async function addTask(e:React.FormEvent){
    e.preventDefault();if(!newTask.trim()||!brand)return;setSaving(true)
    const sb=createClient();const {data:{user}}=await sb.auth.getUser()
    await sb.from('tasks').insert({title:newTask.trim(),brand_id:brand.id,status:'todo',priority:'medium',assignee_id:user?.id})
    setNewTask('');setSaving(false);fetchAll()
  }
  async function toggleTask(t:Task){
    const sb=createClient()
    const next=t.status==='done'?'todo':t.status==='todo'?'in_progress':'done'
    await sb.from('tasks').update({status:next}).eq('id',t.id);fetchAll()
  }
  if(!brand)return<div className="page-pad"><p style={{color:'#8888aa'}}>Brand not found.</p><Link href="/hub/brands" style={{color:'#f0b429',fontSize:14}}>← Back</Link></div>
  return(
    <div className="page-pad" style={{maxWidth:800}}>
      <Link href="/hub/brands" style={{fontSize:12,color:'#44445a',display:'block',marginBottom:16,textDecoration:'none'}}>← All Brands</Link>
      <div className="header-row" style={{marginBottom:24}}>
        <div><p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:brand.color,marginBottom:4}}>{brand.tag}</p><h1 style={{fontSize:24,fontWeight:700,color:'#f0f0f4'}}>{brand.name}</h1></div>
        <a href={brand.url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:brand.color,textDecoration:'none'}}>{brand.url.replace('https://','')}&nbsp;↗</a>
      </div>
      <div style={{display:'flex',gap:0,marginBottom:24,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        {(['notes','tasks'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'10px 20px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?brand.color:'transparent'}`,color:tab===t?brand.color:'#8888aa',fontWeight:600,fontSize:13,cursor:'pointer',textTransform:'capitalize',marginBottom:-1}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      {loading?<p style={{color:'#44445a',fontSize:14}}>Loading…</p>:(
        <>
          {tab==='notes'&&(
            <div>
              <form onSubmit={addNote} style={{display:'flex',gap:8,marginBottom:16}}>
                <input className="input" style={{flex:1}} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Add a note, idea, or update…" maxLength={1000}/>
                <button type="submit" className="btn-primary" style={{background:brand.color}} disabled={!newNote.trim()||saving}>{saving?'…':'Post'}</button>
              </form>
              {notes.length===0&&<p style={{color:'#44445a',fontSize:14}}>No notes yet.</p>}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {notes.map(n=>(
                  <div key={n.id} className="card" style={{padding:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:brand.color}}>{n.author_name}</span>
                      <span style={{fontSize:10,color:'#44445a'}}>{new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <p style={{fontSize:14,color:'#f0f0f4',lineHeight:1.5}}>{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==='tasks'&&(
            <div>
              <form onSubmit={addTask} style={{display:'flex',gap:8,marginBottom:16}}>
                <input className="input" style={{flex:1}} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task…"/>
                <button type="submit" className="btn-primary" style={{background:brand.color}} disabled={!newTask.trim()||saving}>{saving?'…':'Add'}</button>
              </form>
              <div className="grid-3">
                {(['todo','in_progress','done'] as const).map(status=>(
                  <div key={status}>
                    <p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:'#44445a',marginBottom:12}}>{status==='todo'?'TO DO':status==='in_progress'?'IN PROGRESS':'DONE'} ({tasks.filter(t=>t.status===status).length})</p>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {tasks.filter(t=>t.status===status).map(task=>(
                        <div key={task.id} className="card" style={{padding:12,cursor:'pointer'}} onClick={()=>toggleTask(task)}>
                          <p style={{fontSize:13,color:status==='done'?'#44445a':'#f0f0f4',textDecoration:status==='done'?'line-through':'none'}}>{task.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
