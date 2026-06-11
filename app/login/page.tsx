'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
export default function LoginPage() {
  const router = useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();setLoading(true);setError('')
    const sb=createClient()
    const {error:err}=await sb.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
    if(err){setError(err.message);setLoading(false);return}
    const {data:{user}}=await sb.auth.getUser()
    if(!user){setLoading(false);return}
    const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).single()
    const role=p?.role??'pending'
    if(role==='team')router.replace('/hub')
    else if(role==='client')router.replace('/client')
    else setError("Your access request is pending. We'll be in touch.")
    setLoading(false)
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'#08080f'}}>
      <div style={{width:'100%',maxWidth:360}}>
        <Link href="/" style={{display:'block',marginBottom:40,fontSize:14,color:'#44445a'}}>← Back</Link>
        <div style={{marginBottom:32}}>
          <div style={{width:10,height:10,background:'#f0b429',marginBottom:20}}/>
          <h1 style={{fontSize:32,fontWeight:700,color:'#f0f0f4',marginBottom:8}}>Fence Hole Hub</h1>
          <p style={{fontSize:14,color:'#8888aa'}}>Team access only.</p>
        </div>
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@fencehole.com" required/></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></div>
          {error&&<div style={{color:'#fb7185',background:'rgba(251,113,133,0.08)',padding:12,borderRadius:8,fontSize:13}}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading?'Entering…':'Enter the Hub'}</button>
          <Link href="/request-access" style={{textAlign:'center',fontSize:13,color:'#44445a'}}>Not on the team? Request access →</Link>
        </form>
      </div>
    </div>
  )
}
