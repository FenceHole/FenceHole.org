#!/bin/bash
set -e

echo "🏗️  Setting up Fence Hole Hub..."

mkdir -p app/login app/request-access app/hub/crm "app/hub/brands/[id]" app/hub/content app/client components lib/supabase supabase

cat > package.json << 'EOF'
{
  "name": "fence-hole-hub",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "next": "15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
EOF

cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = { images: { unoptimized: true } };
export default nextConfig;
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

cat > postcss.config.mjs << 'EOF'
const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
export default config;
EOF

cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:"#08080f",card:"#111120",hover:"#16162a",
        gold:"#f0b429",blue:"#3b9eff",green:"#34d399",
        teal:"#22d3ee",purple:"#a78bfa",coral:"#fb7185",
        ink:"#f0f0f4",ink2:"#8888aa",ink3:"#44445a",
      },
    },
  },
  plugins: [],
};
export default config;
EOF

cat > .gitignore << 'EOF'
.env*.local
.env
.next/
node_modules/
*.tsbuildinfo
out/
.DS_Store
EOF

cat > .env.example << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

cat > middleware.ts << 'EOF'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'

export async function middleware(request: NextRequest) {
  let res = NextResponse.next({ request })
  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(s) {
        s.forEach(({ name, value }) => request.cookies.set(name, value))
        res = NextResponse.next({ request })
        s.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (request.nextUrl.pathname.startsWith('/hub') && !user)
    return NextResponse.redirect(new URL('/login', request.url))
  if (request.nextUrl.pathname.startsWith('/client') && !user)
    return NextResponse.redirect(new URL('/login', request.url))
  return res
}
export const config = { matcher: ['/hub/:path*', '/client/:path*'] }
EOF

cat > lib/supabase/client.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'
export function createClient() { return createBrowserClient(URL, KEY) }
EOF

cat > lib/supabase/server.ts << 'EOF'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'
export async function createClient() {
  const c = await cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() { return c.getAll() },
      setAll(s) { try { s.forEach(({ name, value, options }) => c.set(name, value, options)) } catch {} },
    },
  })
}
EOF

cat > lib/constants.ts << 'EOF'
export const BRANDS = [
  { id:'frances-and-family', name:'Frances & Family', tag:'The Heart', color:'#f0b429', url:'https://francesandfamily.com', description:'Authentic cat lifestyle content.' },
  { id:'cool-cat-stuff', name:'Cool Cat Stuff', tag:'The Commerce Engine', color:'#3b9eff', url:'https://coolcatstuff.com', description:'#1 Amazon Live cat product channel.' },
  { id:'the-good-meow', name:'The Good Meow', tag:'The Voice', color:'#34d399', url:'https://thegoodmeow.com', description:'Satirical cat news. Daily stories.' },
  { id:'vet-van-fleet', name:'Vet Van Fleet', tag:'The Mission', color:'#22d3ee', url:'https://vetvanfleet.com', description:'Nonprofit free mobile vet care.' },
  { id:'vibecode-cat', name:'Vibecode Cat', tag:'The Agency', color:'#a78bfa', url:'https://vibecodecat.com', description:'Web/app dev and digital marketing.' },
  { id:'user-generated-cats', name:'User Generated Cats', tag:'The Creator Hub', color:'#fb7185', url:'https://usergeneratedcats.com', description:"The world's first cats-only creator agency." },
] as const
export const DEAL_STATUSES = [
  { id:'new', label:'New', color:'#8888aa' },
  { id:'in_talks', label:'In Talks', color:'#f0b429' },
  { id:'negotiating', label:'Negotiating', color:'#3b9eff' },
  { id:'active', label:'Active', color:'#34d399' },
  { id:'complete', label:'Complete', color:'#a78bfa' },
  { id:'passed', label:'Passed', color:'#44445a' },
] as const
export const CONTENT_STATUSES = [
  { id:'idea', label:'Idea' },
  { id:'writing', label:'Writing' },
  { id:'review', label:'Review' },
  { id:'published', label:'Published' },
] as const
EOF

cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
*{box-sizing:border-box;margin:0;padding:0}
body{background:#08080f;color:#f0f0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#08080f}
::-webkit-scrollbar-thumb{background:#44445a;border-radius:3px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.card{background:#111120;border:1px solid rgba(255,255,255,0.07);border-radius:12px}
.btn-primary{background:#f0b429;color:#08080f;font-weight:700;padding:10px 20px;border-radius:8px;font-size:14px;transition:opacity .15s;cursor:pointer;border:none}
.btn-primary:hover{opacity:.9}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{background:transparent;color:#8888aa;font-weight:500;padding:8px 16px;border-radius:8px;font-size:14px;cursor:pointer;border:1px solid rgba(255,255,255,0.07)}
.btn-ghost:hover{background:#16162a;color:#f0f0f4}
.input{width:100%;background:#111120;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px 14px;font-size:14px;color:#f0f0f4;outline:none;transition:border-color .15s}
.input:focus{border-color:rgba(240,180,41,0.4)}
.input::placeholder{color:#44445a}
.label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#44445a;margin-bottom:6px;display:block}
textarea.input{resize:vertical;min-height:80px}
select.input{cursor:pointer}
EOF

cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title:'Fence Hole Hub', description:'Private workspace for the Fence Hole LLC team.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
EOF

cat > app/page.tsx << 'EOF'
import Link from 'next/link'
export default function FencePage() {
  const boards = [68,72,64,74,66,70,65]
  return (
    <div style={{position:'relative',width:'100%',height:'100vh',overflow:'hidden',background:'#030308'}}>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,#020208,#050510 60%,#0a0814)'}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:64,background:'#0c0a06'}}/>
      <div style={{position:'absolute',top:'38%',left:0,right:0,height:14,background:'#1e1508',zIndex:10}}/>
      <div style={{position:'absolute',top:'55%',left:0,right:0,height:14,background:'#1e1508',zIndex:10}}/>
      <div style={{position:'absolute',bottom:56,left:0,right:0,display:'flex',gap:3}}>
        {boards.map((h,i)=>(
          <div key={i} style={{flex:1,height:`${h}vh`,background:i%2===0?'#2a1f0e':'#221a0c',borderTopLeftRadius:4,borderTopRightRadius:4,position:'relative',overflow:'hidden',alignSelf:'flex-end'}}>
            {[12,30,50,70].map(t=><div key={t} style={{position:'absolute',top:`${t}%`,left:'20%',right:'15%',height:1,background:'rgba(0,0,0,0.25)'}}/>)}
            <div style={{position:'absolute',top:14,left:'50%',marginLeft:-3,width:6,height:6,borderRadius:3,background:'#555'}}/>
            <div style={{position:'absolute',bottom:14,left:'50%',marginLeft:-3,width:6,height:6,borderRadius:3,background:'#555'}}/>
            {i===3&&<Link href="/login" style={{position:'absolute',top:'42%',left:'50%',marginLeft:-11,marginTop:-11,display:'block'}}>
              <div style={{width:22,height:22,borderRadius:11,background:'#000',border:'2px solid #1a1208',boxShadow:'0 0 12px rgba(240,180,41,0.4)'}}/>
            </Link>}
          </div>
        ))}
      </div>
      <Link href="/request-access" style={{position:'absolute',bottom:'26%',right:16,zIndex:20}}>
        <div style={{width:62,background:'#f5f0e0',borderRadius:3,padding:'14px 8px 8px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)',transform:'rotate(4deg)'}}>
          <div style={{position:'absolute',top:4,left:'50%',marginLeft:-5,width:10,height:10,borderRadius:5,background:'#c0392b'}}/>
          <p style={{fontFamily:'monospace',fontSize:10,color:'#1a1a1a',textAlign:'center',lineHeight:'14px',fontWeight:700}}>Request{'\n'}Access</p>
        </div>
      </Link>
      <div style={{position:'absolute',bottom:12,left:0,right:0,display:'flex',justifyContent:'center'}}>
        <span style={{color:'rgba(255,255,255,0.06)',fontSize:10,fontWeight:700,letterSpacing:4}}>FENCE HOLE LLC</span>
      </div>
    </div>
  )
}
EOF

cat > app/login/page.tsx << 'EOF'
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
EOF

cat > app/request-access/page.tsx << 'EOF'
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
EOF

cat > components/Sidebar.tsx << 'EOF'
'use client'
import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
const NAV=[
  {href:'/hub',label:'Dashboard',icon:'⊞'},
  {href:'/hub/crm',label:'CRM',icon:'🤝'},
  {href:'/hub/brands',label:'Brands',icon:'📦'},
  {href:'/hub/content',label:'Content',icon:'✍️'},
  {href:'/client',label:'Client Portal',icon:'👤'},
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
          const active=item.href==='/hub'?pathname==='/hub':pathname.startsWith(item.href)
          return<Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,color:active?'#f0f0f4':'#8888aa',background:active?'#16162a':'transparent',fontWeight:active?600:400,fontSize:14,textDecoration:'none'}}>
            <span>{item.icon}</span><span>{item.label}</span>
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
EOF

cat > app/hub/layout.tsx << 'EOF'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
export default async function HubLayout({children}:{children:React.ReactNode}) {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user)redirect('/login')
  const {data:p}=await sb.from('profiles').select('role,full_name').eq('id',user.id).single()
  if(p?.role!=='team')redirect('/client')
  return(
    <div style={{display:'flex',minHeight:'100vh',background:'#08080f'}}>
      <Sidebar userName={p?.full_name?.split(' ')[0]??'Team'}/>
      <main style={{flex:1,overflowY:'auto',marginLeft:220}}>{children}</main>
    </div>
  )
}
EOF

cat > app/hub/page.tsx << 'EOF'
import {createClient} from '@/lib/supabase/server'
import {BRANDS} from '@/lib/constants'
import Link from 'next/link'
export default async function DashboardPage() {
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  const [{data:p},{data:deals},{data:tasks},{data:ideas}]=await Promise.all([
    sb.from('profiles').select('full_name').eq('id',user!.id).single(),
    sb.from('deals').select('id').in('status',['new','in_talks','negotiating']),
    sb.from('tasks').select('id').eq('status','todo'),
    sb.from('content_ideas').select('id').eq('status','idea'),
  ])
  const name=p?.full_name?.split(' ')[0]??'Team'
  return(
    <div style={{padding:32,maxWidth:900}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#f0b429',marginBottom:4}}>FENCE HOLE HUB</p>
      <h1 style={{fontSize:32,fontWeight:700,color:'#f0f0f4',marginBottom:32}}>Hey, {name} 👋</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:32}}>
        {[{label:'Active Deals',value:deals?.length??0,color:'#f0b429',href:'/hub/crm'},{label:'Open Tasks',value:tasks?.length??0,color:'#3b9eff',href:'/hub/brands'},{label:'Story Ideas',value:ideas?.length??0,color:'#34d399',href:'/hub/content'}].map(s=>(
          <Link key={s.label} href={s.href} className="card" style={{padding:20,display:'block',textDecoration:'none'}}>
            <p style={{fontSize:28,fontWeight:700,color:s.color,marginBottom:4}}>{s.value}</p>
            <p style={{fontSize:12,color:'#8888aa'}}>{s.label}</p>
          </Link>
        ))}
      </div>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#44445a',marginBottom:16}}>BRAND WORKSPACES</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
        {BRANDS.map(b=>(
          <Link key={b.id} href={`/hub/brands/${b.id}`} className="card" style={{padding:20,display:'block',textDecoration:'none',borderTop:`2px solid ${b.color}`}}>
            <p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:b.color,marginBottom:4}}>{b.tag}</p>
            <p style={{fontSize:16,fontWeight:700,color:'#f0f0f4',marginBottom:4}}>{b.name}</p>
            <p style={{fontSize:12,color:'#8888aa',lineHeight:1.5}}>{b.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
EOF

cat > app/hub/brands/page.tsx << 'EOF'
import {BRANDS} from '@/lib/constants'
import Link from 'next/link'
export default function BrandsPage() {
  return(
    <div style={{padding:32,maxWidth:900}}>
      <p style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'#44445a',marginBottom:4}}>WORKSPACE</p>
      <h1 style={{fontSize:28,fontWeight:700,color:'#f0f0f4',marginBottom:24}}>Brand Workspaces</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
        {BRANDS.map(b=>(
          <Link key={b.id} href={`/hub/brands/${b.id}`} className="card" style={{padding:24,display:'block',textDecoration:'none',borderTop:`2px solid ${b.color}`}}>
            <p style={{fontSize:9,fontWeight:700,letterSpacing:2,color:b.color,marginBottom:6}}>{b.tag}</p>
            <p style={{fontSize:18,fontWeight:700,color:'#f0f0f4',marginBottom:6}}>{b.name}</p>
            <p style={{fontSize:13,color:'#8888aa',lineHeight:1.5,marginBottom:12}}>{b.description}</p>
            <p style={{fontSize:12,fontWeight:600,color:b.color}}>Open workspace →</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
EOF

cat > "app/hub/brands/[id]/page.tsx" << 'EOF'
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
  if(!brand)return<div style={{padding:32}}><p style={{color:'#8888aa'}}>Brand not found.</p><Link href="/hub/brands" style={{color:'#f0b429',fontSize:14}}>← Back</Link></div>
  return(
    <div style={{padding:32,maxWidth:800}}>
      <Link href="/hub/brands" style={{fontSize:12,color:'#44445a',display:'block',marginBottom:16,textDecoration:'none'}}>← All Brands</Link>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
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
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
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
EOF

cat > app/hub/crm/page.tsx << 'EOF'
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
  const [title,setTitle]=useState('');const [brand,setBrand]=useState(BRANDS[0].id);const [status,setStatus]=useState('new');const [value,setValue]=useState('');const [dueDate,setDueDate]=useState('');const [notes,setNotes]=useState('');const [loading,setLoading]=useState(false)
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
EOF

cat > app/hub/content/page.tsx << 'EOF'
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
    <div style={{padding:32,height:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:24}}>
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
EOF

cat > app/client/page.tsx << 'EOF'
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
EOF

cat > supabase/schema.sql << 'EOF'
create table if not exists public.profiles (id uuid references auth.users on delete cascade primary key,email text not null,full_name text,avatar_url text,role text not null default 'pending' check (role in ('team','client','pending')),company text,created_at timestamptz default now());
alter table public.profiles enable row level security;
create policy "Team sees all" on profiles for select using (exists (select 1 from profiles where id=auth.uid() and role='team') or auth.uid()=id);
create policy "Users update own" on profiles for update using (auth.uid()=id);
create or replace function public.handle_new_user() returns trigger as $$ begin insert into public.profiles(id,email,full_name,role) values(new.id,new.email,new.raw_user_meta_data->>'full_name',coalesce(new.raw_user_meta_data->>'role','pending')); return new; end; $$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create table if not exists public.access_requests (id uuid default gen_random_uuid() primary key,email text not null,full_name text not null,company text,reason text,status text not null default 'pending' check (status in ('pending','approved','rejected')),created_at timestamptz default now());
alter table public.access_requests enable row level security;
create policy "Anyone can insert" on access_requests for insert with check (true);
create policy "Team can view" on access_requests for select using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.contacts (id uuid default gen_random_uuid() primary key,name text not null,email text,company text,title text,phone text,notes text,tags text[],source text,created_by uuid references public.profiles(id),created_at timestamptz default now(),updated_at timestamptz default now());
alter table public.contacts enable row level security;
create policy "Team full access contacts" on contacts for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.deals (id uuid default gen_random_uuid() primary key,title text not null,contact_id uuid references public.contacts(id),brand text not null,status text not null default 'new' check (status in ('new','in_talks','negotiating','active','complete','passed')),value numeric,currency text default 'USD',deliverables text,due_date date,notes text,created_at timestamptz default now(),updated_at timestamptz default now());
alter table public.deals enable row level security;
create policy "Team full access deals" on deals for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.notes (id uuid default gen_random_uuid() primary key,brand_id text not null,content text not null,author_id uuid references public.profiles(id),created_at timestamptz default now());
alter table public.notes enable row level security;
create policy "Team full access notes" on notes for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.tasks (id uuid default gen_random_uuid() primary key,title text not null,description text,brand_id text,deal_id uuid references public.deals(id),assignee_id uuid references public.profiles(id),status text not null default 'todo' check (status in ('todo','in_progress','done')),priority text not null default 'medium' check (priority in ('low','medium','high')),due_date date,created_by uuid references public.profiles(id),created_at timestamptz default now(),updated_at timestamptz default now());
alter table public.tasks enable row level security;
create policy "Team full access tasks" on tasks for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.content_ideas (id uuid default gen_random_uuid() primary key,title text not null,source_url text,source_type text default 'manual',brand_id text default 'the-good-meow',status text not null default 'idea' check (status in ('idea','writing','review','published')),assigned_to uuid references public.profiles(id),notes text,published_url text,created_at timestamptz default now());
alter table public.content_ideas enable row level security;
create policy "Team full access content" on content_ideas for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create table if not exists public.client_projects (id uuid default gen_random_uuid() primary key,name text not null,brand text not null,client_id uuid references public.profiles(id) on delete cascade,status text not null default 'in_progress' check (status in ('in_progress','review','complete','on_hold')),description text,updated_at timestamptz default now(),created_at timestamptz default now());
alter table public.client_projects enable row level security;
create policy "Team sees all projects" on client_projects for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create policy "Client sees own" on client_projects for select using (client_id=auth.uid());
create table if not exists public.client_messages (id uuid default gen_random_uuid() primary key,project_id uuid references public.client_projects(id) on delete cascade,content text not null,author_id uuid references public.profiles(id),is_team boolean not null default false,created_at timestamptz default now());
alter table public.client_messages enable row level security;
create policy "Team sees all messages" on client_messages for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));
create policy "Client sees own messages" on client_messages for all using (exists (select 1 from client_projects where id=project_id and client_id=auth.uid()));
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table client_messages;
EOF

git add -A
git commit -m "Phase 1: Fence Hole Hub — Next.js workspace with CRM, brands, content pipeline, client portal"
git push origin main

echo ""
echo "✅ Done! All files pushed to GitHub."
echo "Vercel will auto-deploy in about 60 seconds."
