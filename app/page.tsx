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
            {i===3&&<Link href="/login" aria-label="Enter the Hub" className="fence-hole-link" style={{position:'absolute',top:'42%',left:'50%',marginLeft:-11,marginTop:-11,display:'block'}}>
              <div className="fence-hole"/>
              <span className="fence-hole-label">ENTER</span>
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
