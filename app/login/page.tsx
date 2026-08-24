'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
export default function LoginPage() {
  const router = useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [code,setCode]=useState('')
  const [needsMfa,setNeedsMfa]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  async function finishLogin() {
    const sb=createClient()
    const {data:{user}}=await sb.auth.getUser()
    if(!user){setLoading(false);return}
    const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).single()
    const role=p?.role??'pending'
    if(role==='team')router.replace('/hub')
    else if(role==='client')router.replace('/client')
    else setError("Your access request is pending. We'll be in touch.")
    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();setLoading(true);setError('')
    const sb=createClient()
    const {error:err}=await sb.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
    if(err){setError(err.message);setLoading(false);return}
    const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel()
    if(aal && aal.nextLevel==='aal2' && aal.nextLevel!==aal.currentLevel){
      setNeedsMfa(true);setLoading(false);return
    }
    await finishLogin()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();setLoading(true);setError('')
    const sb=createClient()
    const {data:list,error:listErr}=await sb.auth.mfa.listFactors()
    const totp=list?.totp?.find(f=>f.status==='verified')
    if(listErr || !totp){setError('No authenticator found.');setLoading(false);return}
    const {data:ch,error:chErr}=await sb.auth.mfa.challenge({factorId:totp.id})
    if(chErr){setError(chErr.message);setLoading(false);return}
    const {error:vErr}=await sb.auth.mfa.verify({factorId:totp.id,challengeId:ch.id,code:code.trim()})
    if(vErr){setError(vErr.message);setLoading(false);return}
    await finishLogin()
  }

  return (
    <div className="hq-bg" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:360}}>
        <Link href="/" style={{display:'block',marginBottom:40,fontSize:14,color:'#44445a'}}>← Back</Link>
        <div style={{marginBottom:32}}>
          <img src="/nessie-emblem.jpg" alt="" className="emblem-ring" style={{width:48,height:48,borderRadius:'50%',objectFit:'cover',marginBottom:20}}/>
          <h1 className="font-display" style={{fontSize:32,fontWeight:600,color:'#f0f0f4',marginBottom:8}}>Fence Hole Hub</h1>
          <p style={{fontSize:14,color:'#8888aa'}}>Team access only.</p>
        </div>
        {!needsMfa ? (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@fencehole.com" required/></div>
            <div>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
                <label className="label">Password</label>
                <Link href="/reset" style={{fontSize:11,color:'#8888aa',textDecoration:'none'}}>Forgot?</Link>
              </div>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/>
            </div>
            {error&&<div style={{color:'#fb7185',background:'rgba(251,113,133,0.08)',padding:12,borderRadius:8,fontSize:13}}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>{loading?'Entering…':'Enter the Hub'}</button>
            <Link href="/request-access" style={{textAlign:'center',fontSize:13,color:'#44445a'}}>Not on the team? Request access →</Link>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{display:'flex',flexDirection:'column',gap:16}}>
            <p style={{fontSize:14,color:'#8888aa'}}>Enter the 6-digit code from your authenticator app.</p>
            <div><label className="label">Code</label><input className="input" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" required autoFocus/></div>
            {error&&<div style={{color:'#fb7185',background:'rgba(251,113,133,0.08)',padding:12,borderRadius:8,fontSize:13}}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>{loading?'Verifying…':'Verify'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
