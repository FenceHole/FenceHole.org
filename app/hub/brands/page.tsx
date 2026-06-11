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
