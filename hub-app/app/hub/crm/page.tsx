'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {BRANDS,DEAL_STATUSES} from '@/lib/constants'
interface Deal{id:string;title:string;brand:string;status:string;value:number|null;due_date:string|null;notes:string|null}
interface Contact{id:string;name:string;email:string|null;company:string|null;title:string|null}
export default function CRMPage() {
  const [tab,setTab]=useState<'deals'|'contacts'|'requests'>('deals')
  const [deals,setDeals]=useState<Deal[]>([])
  const [contacts,setContacts]=useState<Contact[]>([])
  const [requests,setRequests]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [showDeal,setShowDeal]=useState(false)
  const [showContact,setShowContact]=useState(false)
  useEffect(()=>{fetchAll()},[])
  async function fetchAll(){
    setLoading(true);const sb=createClient()
    const [{data:d},{data:c},{data:r}]=await Promise.all([
      sb.from('deals').select('*').order('created_at',{ascending:false}),
      sb.from('contacts').select('id,name,email,company,title').order('created_at',{ascending:false}),
      sb.from('access_requests').select('*').order('created_at',{ascending:false}),
    ])
    setDeals(d??[]);setContacts(c??[]);setRequests(r??[]);setLoading(false)
  }
  const statusMap=Object.fromEntries(DEAL_STATUSES.map(s=>[s.id,s]))
  const brandMap=Object.fromEntries(BRANDS.map(b=>[b.id,b]))
  return(
    <div style={{padding:32,maxWidth:900}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#44445a',marginBottom:4}}>WORKSPACE</p><h1 style={{fontSize:28,fontWeight:700,color:'#f0f0f4'}}>CRM & Brand Deals</h1></div>
        <div style={{display:'flex',gap:8}}>
          {tab==='deals'&&<button className="btn-primary" style={{fontSize:13}} onClick={()=>setShowDeal(true)}>+ New Deal</button>}
          {tab==='contacts'&&<button className="btn-primary" style={{fontSize:13}} onClick={()=>setShowContact(true)}>+ New Contact</button>}
        </div>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:24,padding:4,background:'#111120',borderRadius:10,width:'fit-content'}}>
        {(['deals','contacts','requests'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 16px',borderRadius:8,border:'none',background:tab===t?'#1e1e3a':'transparent',color:tab===t?'#f0f0f4':'#8888aa',fontWeight:500,fontSize:13,cursor:'pointer',textTransform:'capitalize'}}>
            {t==='requests'?`Requests${requests.filter(r=>r.status==='pending').length>0?` (${requests.filter(r=>r.status==='pending').length})`:''}`:t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      {loading?<p style={{color:'#44445a',fontSize:14}}>Loading…</p>:(
        <>
          {tab==='deals'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {deals.length===0&&<p style={{color:'#44445a',fontSize:14}}>No deals yet. Add your first one.</p>}
              {deals.map(deal=>{
                const st=statusMap[deal.status];const br=brandMap[deal.brand as keyof typeof brandMap]
                return(
                  <div key={deal.id} className="card" style={{padding:16,display:'flex',gap:12}}>
                    {br&&<div style={{width:3,borderRadius:2,background:br.color,flexShrink:0}}/>}
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <p style={{fontWeight:600,fontSize:14,color:'#f0f0f4'}}>{deal.title}</p>
                        {st&&<span className="chip" style={{background:st.color+'20',color:st.color}}>{st.label}</span>}
                      </div>
                      <div style={{display:'flex',gap:12,fontSize:12,color:'#8888aa'}}>
                        {br&&<span style={{color:br.color}}>{br.name}</span>}
                        {deal.value&&<span style={{color:'#34d399',fontWeight:600}}>${deal.value.toLocaleString()}</span>}
                        {deal.due_date&&<span>Due {new Date(deal.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                      </div>
                      {deal.notes&&<p style={{fontSize:12,color:'#44445a',marginTop:6}}>{deal.notes}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {tab==='contacts'&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
              {contacts.length===0&&<p style={{color:'#44445a',fontSize:14,gridColumn:'span 2'}}>No contacts yet.</p>}
              {contacts.map(c=>(
                <div key={c.id} className="card" style={{padding:16}}>
                  <div style={{display:'flex',gap:12}}>
                    <div style={{width:32,height:32,borderRadius:16,background:'#1e1e3a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:'#a78bfa',flexShrink:0}}>{c.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <p style={{fontWeight:600,fontSize:14,color:'#f0f0f4'}}>{c.name}</p>
                      {c.title&&<p style={{fontSize:12,color:'#a78bfa'}}>{c.title}</p>}
                      {c.company&&<p style={{fontSize:12,color:'#8888aa'}}>{c.company}</p>}
                      {c.email&&<p style={{fontSize:11,color:'#44445a',marginTop:4}}>{c.email}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==='requests'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {requests.length===0&&<p style={{color:'#44445a',fontSize:14}}>No access requests.</p>}
              {requests.map(r=>(
                <div key={r.id} className="card" style={{padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontWeight:600,fontSize:14,color:'#f0f0f4'}}>{r.full_name}</p>
                    <p style={{fontSize:12,color:'#8888aa'}}>{r.email}{r.company?` · ${r.company}`:''}</p>
                    {r.reason&&<p style={{fontSize:12,color:'#44445a',marginTop:4}}>{r.reason}</p>}
                  </div>
                  <span className="chip" style={{background:r.status==='pending'?'rgba(240,180,41,0.1)':r.status==='approved'?'rgba(52,211,153,0.1)':'rgba(68,68,90,0.2)',color:r.status==='pending'?'#f0b429':r.status==='approved'?'#34d399':'#44445a'}}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {showDeal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
          <div className="card" style={{width:'100%',maxWidth:440,padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}><h2 style={{fontWeight:700,fontSize:18,color:'#f0f0f4'}}>New Deal</h2><button onClick={()=>setShowDeal(false)} style={{color:'#44445a',background:'none',border:'none',fontSize:20,cursor:'pointer'}}>×</button></div>
            <NewDealForm contacts={contacts} onSaved={()=>{setShowDeal(false);fetchAll()}} onClose={()=>setShowDeal(false)}/>
          </div>
        </div>
      )}
      {showContact&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
          <div className="card" style={{width:'100%',maxWidth:440,padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}><h2 style={{fontWeight:700,fontSize:18,color:'#f0f0f4'}}>New Contact</h2><button onClick={()=>setShowContact(false)} style={{color:'#44445a',background:'none',border:'none',fontSize:20,cursor:'pointer'}}>×</button></div>
            <NewContactForm onSaved={()=>{setShowContact(false);fetchAll()}} onClose={()=>setShowContact(false)}/>
          </div>
        </div>
      )}
    </div>
  )
}
function NewDealForm({contacts,onSaved,onClose}:{contacts:Contact[];onSaved:()=>void;onClose:()=>void}) {
  const [title,setTitle]=useState('');const [brand,setBrand]=useState<string>(BRANDS[0].id);const [status,setStatus]=useState('new');const [value,setValue]=useState('');const [dueDate,setDueDate]=useState('');const [notes,setNotes]=useState('');const [loading,setLoading]=useState(false)
  async function save(e:React.FormEvent){
    e.preventDefault();setLoading(true);const sb=createClient()
    await sb.from('deals').insert({title,brand,status,value:value?parseFloat(value):null,due_date:dueDate||null,notes:notes||null})
    setLoading(false);onSaved()
  }
  return(
    <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><label className="label">Deal Title *</label><input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Royal Canin Sponsorship" required/></div>
      <div><label className="label">Brand *</label><select className="input" value={brand} onChange={e=>setBrand(e.target.value)}>{BRANDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div><label className="label">Status</label><select className="input" value={status} onChange={e=>setStatus(e.target.value)}>{DEAL_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div><label className="label">Value ($)</label><input className="input" type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="0"/></div>
        <div><label className="label">Due Date</label><input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Context, deliverables, links…"/></div>
      <div style={{display:'flex',gap:8}}><button type="button" className="btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" style={{flex:1}} disabled={loading}>{loading?'Saving…':'Save Deal'}</button></div>
    </form>
  )
}
function NewContactForm({onSaved,onClose}:{onSaved:()=>void;onClose:()=>void}) {
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [company,setCompany]=useState('');const [title,setTitle]=useState('');const [notes,setNotes]=useState('');const [loading,setLoading]=useState(false)
  async function save(e:React.FormEvent){
    e.preventDefault();setLoading(true);const sb=createClient()
    await sb.from('contacts').insert({name,email:email||null,company:company||null,title:title||null,notes:notes||null})
    setLoading(false);onSaved()
  }
  return(
    <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><label className="label">Name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" required/></div>
      <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="their@email.com"/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div><label className="label">Company</label><input className="input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="Brand / Agency"/></div>
        <div><label className="label">Title</label><input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Marketing Mgr"/></div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="How you met, context…"/></div>
      <div style={{display:'flex',gap:8}}><button type="button" className="btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" style={{flex:1}} disabled={loading}>{loading?'Saving…':'Save Contact'}</button></div>
    </form>
  )
}
