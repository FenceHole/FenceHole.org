'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'

export default function SecurityPage(){
  const [loading,setLoading]=useState(true)
  const [factor,setFactor]=useState<{id:string}|null>(null)
  const [enrolling,setEnrolling]=useState(false)
  const [qr,setQr]=useState('')
  const [secret,setSecret]=useState('')
  const [factorId,setFactorId]=useState('')
  const [code,setCode]=useState('')
  const [error,setError]=useState('')
  const [faceLocked,setFaceLocked]=useState<boolean|null>(null)
  const [locking,setLocking]=useState(false)

  async function refresh(){
    const sb=createClient()
    const {data}=await sb.auth.mfa.listFactors()
    const totp=data?.totp?.find(f=>f.status==='verified')
    setFactor(totp?{id:totp.id}:null)
    setLoading(false)
  }
  async function refreshCamera(){
    const res=await fetch('/api/call/policy')
    if(res.ok){const d=await res.json();setFaceLocked(Boolean(d.policy?.faceLocked))}
  }
  useEffect(()=>{refresh();refreshCamera()},[])

  async function lockCamera(){
    if(!confirm('Lock your camera permanently?\n\nYour face will never be sent on a team call. Blurred and initials-only stay available. This cannot be undone from here — reversing it needs a direct database change.'))return
    setLocking(true)
    try{
      const res=await fetch('/api/call/policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lock:true})})
      if(res.ok)setFaceLocked(true)
    }finally{setLocking(false)}
  }

  async function startEnroll(){
    setError('');setEnrolling(true)
    const sb=createClient()
    const {data:list}=await sb.auth.mfa.listFactors()
    for(const f of list?.totp??[]){ if(f.status!=='verified') await sb.auth.mfa.unenroll({factorId:f.id}) }
    const {data,error:err}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Authenticator app'})
    if(err){setError(err.message);setEnrolling(false);return}
    setQr(data.totp.qr_code);setSecret(data.totp.secret);setFactorId(data.id)
  }

  async function verify(e:React.FormEvent){
    e.preventDefault();setError('')
    const sb=createClient()
    const {data:ch,error:chErr}=await sb.auth.mfa.challenge({factorId})
    if(chErr){setError(chErr.message);return}
    const {error:vErr}=await sb.auth.mfa.verify({factorId,challengeId:ch.id,code:code.trim()})
    if(vErr){setError(vErr.message);return}
    setEnrolling(false);setQr('');setCode('');refresh()
  }

  async function disable(){
    if(!factor)return
    setError('')
    const sb=createClient()
    const {error:err}=await sb.auth.mfa.unenroll({factorId:factor.id})
    if(err){setError(err.message);return}
    refresh()
  }

  if(loading)return null
  return(
    <div style={{maxWidth:480,margin:'0 auto',padding:'60px 16px'}}>
      <Link href="/hub" style={{display:'block',marginBottom:32,fontSize:14,color:'#44445a'}}>← Back to Hub</Link>
      <h1 style={{fontSize:28,fontWeight:700,color:'#f0f0f4',marginBottom:8}}>Security</h1>
      <p style={{fontSize:14,color:'#8888aa',marginBottom:32,lineHeight:1.6}}>Two-factor authentication adds a one-time code from your phone on top of your password. Use Google Authenticator, 1Password, or Authy.</p>
      {error&&<div style={{color:'#fb7185',background:'rgba(251,113,133,0.08)',padding:12,borderRadius:8,fontSize:13,marginBottom:16}}>{error}</div>}
      {factor && !enrolling && (
        <div>
          <div style={{color:'#34d399',marginBottom:16,fontSize:14}}>✓ Two-factor authentication is ON.</div>
          <button onClick={disable} className="btn-primary" style={{background:'#3a1a22',color:'#fb7185'}}>Turn off 2FA</button>
        </div>
      )}
      {!factor && !enrolling && (
        <button onClick={startEnroll} className="btn-primary">Set up two-factor authentication</button>
      )}
      {enrolling && qr && (
        <form onSubmit={verify} style={{display:'flex',flexDirection:'column',gap:16}}>
          <p style={{fontSize:13,color:'#8888aa'}}>Scan this QR code with your authenticator app:</p>
          <div style={{background:'#fff',padding:16,borderRadius:8,width:'fit-content'}} dangerouslySetInnerHTML={{__html:qr}}/>
          <p style={{fontSize:12,color:'#44445a'}}>Or enter this key manually: <code>{secret}</code></p>
          <label className="label">Enter the 6-digit code from your app</label>
          <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" required/>
          <button type="submit" className="btn-primary">Verify & Enable</button>
        </form>
      )}
      <div className="card" style={{padding:20,marginTop:16}}>
        <h2 style={{fontSize:15,fontWeight:600,color:'#f0f0f4',marginBottom:6}}>Camera privacy</h2>
        <p style={{fontSize:13,color:'#8888aa',lineHeight:1.6,marginBottom:12}}>
          Team calls always start protected: your picture is blurred on this device before
          anything is sent, and showing your face is a deliberate click. Locking removes that
          click entirely.
        </p>
        {faceLocked===null?(
          <p style={{fontSize:13,color:'#5a5a72'}}>Checking…</p>
        ):faceLocked?(
          <p style={{fontSize:13,color:'#4ad3a0'}}>
            ✓ Locked. Your face is never transmitted — clear video is not offered on this account.
          </p>
        ):(
          <button className="btn-ghost" onClick={lockCamera} disabled={locking}>
            {locking?'Locking…':'Lock my camera permanently'}
          </button>
        )}
      </div>
    </div>
  )
}
