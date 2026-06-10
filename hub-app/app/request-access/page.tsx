'use client'
import {useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
export default function RequestAccessPage() {
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [company,setCompany]=useState('')
  const [reason,setReason]=useState('')
  const [loading,setLoading]=useState(false)
  const [done,setDone]=useState(false)
  const [error,setError]=useState('')
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();setLoading(true);setError('')
    const sb=createClient()
    const {error:err}=await sb.from('access_requests').insert({full_name:name.trim(),email:email.trim().toLowerCase(),company:company.trim()||null,reason:reason.trim()||null})
    if(err){setError('Something went wrong. Email team@fencehole.com.');setLoading(false);return}
    setDone(true);setLoading(false)
  }
  if(done)return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#08080f'}}>
      <div style={{textAlign:'center',maxWidth:320}}>
        <div style={{fontSize:48,marginBottom:20}}>📬</div>
        <h2 style={{fontSize:24,fontWeight:700,color:'#f0f0f4',marginBottom:12}}>Request Sent</h2>
        <p style={{fontSize:14,color:'#8888aa',lineHeight:1.6}}>We'll send your login to <span style={{color:'#f0b429'}}>{email}</span> if it's a fit.</p>
      </div>
    </div>
  )
  return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'#08080f'}}>
      <div style={{width:'100%',maxWidth:360}}>
        <Link href="/" style={{display:'block',marginBottom:40,fontSize:14,color:'#44445a'}}>← Back</Link>
        <h1 style={{fontSize:32,fontWeight:700,color:'#f0f0f4',marginBottom:8}}>Request Access</h1>
        <p style={{fontSize:14,color:'#8888aa',marginBottom:32,lineHeight:1.6}}>This is a private workspace. Tell us who you are.</p>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
          <div><label className="label">Your Name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" required/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yourcompany.com" required/></div>
          <div><label className="label">Company (optional)</label><input className="input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="What are we working on?"/></div>
          <div><label className="label">Why do you want access?</label><textarea className="input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Tell us about yourself…"/></div>
          {error&&<div style={{color:'#fb7185',fontSize:13}}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading?'Sending…':'Send Request'}</button>
        </form>
      </div>
    </div>
  )
}
