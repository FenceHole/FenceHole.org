'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  drawFrame, STAGE_W, STAGE_H,
  type StageProduct, type StageState, type Layout,
} from '@/lib/studio/compositor'

// The Studio — OBS-style scene compositing in the browser, with live-shopping
// product overlays baked into the outgoing frame.
//
// On going live: browsers cannot open the raw TCP socket RTMP needs, so the
// last hop runs through a relay (see the Broadcast panel). Everything up to
// that point — capture, compositing, overlays, recording — is local and works
// with no external service at all.

const PRODUCT_STORE = 'fh_studio_products'

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<HTMLVideoElement | null>(null)
  const screenRef = useRef<HTMLVideoElement | null>(null)
  const productImgRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [camOn, setCamOn] = useState(false)
  const [screenOn, setScreenOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const [shelf, setShelf] = useState<StageProduct[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<StageProduct[]>([])
  const [searchNote, setSearchNote] = useState<string | null>(null)

  const [stage, setStage] = useState<StageState>({
    layout: 'camera',
    featured: null,
    fullscreen: false,
    headline: null,
  })
  const stageRef = useRef(stage)
  useEffect(() => { stageRef.current = stage }, [stage])

  // Load the shelf from this browser so a stream setup survives a refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_STORE)
      if (raw) setShelf(JSON.parse(raw))
    } catch { /* private mode, or nothing stored */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(PRODUCT_STORE, JSON.stringify(shelf)) } catch { /* ignore */ }
  }, [shelf])

  // Preload the featured product's image so the compositor can draw it.
  useEffect(() => {
    const url = stage.featured?.imageUrl
    if (!url) { productImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    productImgRef.current = img
  }, [stage.featured])

  // The render loop. Runs continuously so the canvas is always a live frame —
  // which is what captureStream() hands to the recorder or the relay.
  const loop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      drawFrame(ctx, {
        camera: cameraRef.current,
        screen: screenRef.current,
        productImage: productImgRef.current,
      }, stageRef.current)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [loop])

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  async function startCamera() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      })
      const v = document.createElement('video')
      v.srcObject = stream
      v.muted = true
      v.playsInline = true
      await v.play()
      cameraRef.current = v
      setCamOn(true)
      setMicOn(stream.getAudioTracks().some((t) => t.enabled))
    } catch (err) {
      setError(err instanceof Error ? `Camera blocked: ${err.message}` : 'Camera blocked')
    }
  }

  function stopCamera() {
    const v = cameraRef.current
    ;(v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
    cameraRef.current = null
    setCamOn(false)
    setMicOn(false)
  }

  async function startScreen() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false })
      const v = document.createElement('video')
      v.srcObject = stream
      v.muted = true
      v.playsInline = true
      await v.play()
      screenRef.current = v
      setScreenOn(true)
      setStage((s) => ({ ...s, layout: 'screen' }))
      // Ending the share from the browser's own bar should tidy up here too.
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenRef.current = null
        setScreenOn(false)
        setStage((s) => ({ ...s, layout: 'camera' }))
      })
    } catch (err) {
      setError(err instanceof Error ? `Screen share cancelled: ${err.message}` : 'Screen share cancelled')
    }
  }

  function stopScreen() {
    const v = screenRef.current
    ;(v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
    screenRef.current = null
    setScreenOn(false)
    setStage((s) => ({ ...s, layout: 'camera' }))
  }

  function toggleMic() {
    const stream = cameraRef.current?.srcObject as MediaStream | null
    const track = stream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicOn(track.enabled)
  }

  /** The composited canvas plus mic audio — this is the broadcast feed. */
  function buildOutputStream(): MediaStream | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const out = (canvas as HTMLCanvasElement).captureStream(30)
    const mic = (cameraRef.current?.srcObject as MediaStream | null)?.getAudioTracks() ?? []
    mic.forEach((t) => out.addTrack(t))
    return out
  }

  function startRecording() {
    setError(null)
    setDownloadUrl(null)
    const stream = buildOutputStream()
    if (!stream) return
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m))
    if (!mime) { setError('This browser cannot record webm.'); return }

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      setDownloadUrl(URL.createObjectURL(blob))
    }
    rec.start(1000)
    recorderRef.current = rec
    setElapsed(0)
    setRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchNote(null)
    setResults([])
    try {
      const res = await fetch(`/api/studio/products?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.products ?? [])
      if (data.note) setSearchNote(data.note)
    } catch {
      setSearchNote('Search failed.')
    } finally {
      setSearching(false)
    }
  }

  function addToShelf(p: StageProduct) {
    setShelf((s) => (s.some((x) => x.id === p.id) ? s : [...s, p]))
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div style={{ padding: '24px 18px 80px', maxWidth: 1250, margin: '0 auto' }}>
      <header style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429' }}>FENCE HOLE · STUDIO</p>
        <h1 className="font-display" style={{ fontSize: 28, color: '#f0f0f4', marginTop: 4 }}>Go Live</h1>
        <div className="gold-divider" style={{ width: 70, marginTop: 12 }} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 18 }} className="studio-grid">
        <div>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', background: '#08080f' }}>
            <canvas
              ref={canvasRef}
              width={STAGE_W}
              height={STAGE_H}
              style={{ width: '100%', display: 'block', aspectRatio: '16 / 9' }}
            />
            {recording && (
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(200,30,30,.85)', padding: '4px 10px', borderRadius: 20 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>REC {mmss}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn-ghost" onClick={camOn ? stopCamera : startCamera}>
              {camOn ? 'Stop camera' : 'Start camera'}
            </button>
            <button className="btn-ghost" onClick={screenOn ? stopScreen : startScreen}>
              {screenOn ? 'Stop share' : 'Share screen'}
            </button>
            <button className="btn-ghost" onClick={toggleMic} disabled={!camOn}>
              {micOn ? 'Mute mic' : 'Unmute mic'}
            </button>
            {(['camera', 'screen', 'side-by-side'] as Layout[]).map((l) => (
              <button
                key={l}
                onClick={() => setStage((s) => ({ ...s, layout: l }))}
                className="btn-ghost"
                style={stage.layout === l ? { borderColor: 'rgba(240,180,41,.5)', color: '#ffd97a' } : undefined}
              >
                {l}
              </button>
            ))}
            <button
              className="btn-primary"
              onClick={recording ? stopRecording : startRecording}
              style={recording ? { background: '#c81e1e', color: '#fff' } : undefined}
            >
              {recording ? 'Stop recording' : 'Record'}
            </button>
          </div>

          {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 10 }}>{error}</p>}
          {downloadUrl && (
            <p style={{ fontSize: 13, marginTop: 10 }}>
              <a href={downloadUrl} download={`fencehole-stream-${Date.now()}.webm`} style={{ color: '#f0b429' }}>
                Download the recording
              </a>
            </p>
          )}

          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8888aa', marginBottom: 8 }}>
              Broadcast
            </p>
            <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>
              Everything above is live and local — compositing, overlays, and recording need no
              external service. Pushing to YouTube, Twitch, TikTok, X, LinkedIn or Instagram
              needs a relay, because browsers can&apos;t open the raw socket RTMP requires. The
              stage feed is already in the right shape to hand to one; see{' '}
              <span style={{ color: '#f0b429', fontFamily: 'monospace' }}>STUDIO.md</span> for the
              two options and what each costs.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8888aa', marginBottom: 10 }}>
              On screen
            </p>
            <input
              className="input"
              placeholder="Headline (optional)"
              value={stage.headline ?? ''}
              onChange={(e) => setStage((s) => ({ ...s, headline: e.target.value || null }))}
              style={{ fontSize: 13, marginBottom: 10 }}
            />
            {stage.featured ? (
              <>
                <p style={{ fontSize: 13, color: '#f0f0f4', marginBottom: 8 }}>{stage.featured.title}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost"
                    onClick={() => setStage((s) => ({ ...s, fullscreen: !s.fullscreen }))}
                    style={stage.fullscreen ? { borderColor: 'rgba(240,180,41,.5)', color: '#ffd97a' } : undefined}
                  >
                    {stage.fullscreen ? 'Shrink to card' : 'Full screen'}
                  </button>
                  <button className="btn-ghost" onClick={() => setStage((s) => ({ ...s, featured: null, fullscreen: false }))}>
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: '#5a5a72' }}>No product on screen. Pick one below.</p>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8888aa', marginBottom: 10 }}>
              Product search
            </p>
            <form onSubmit={search} style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="cat tree, laser toy…"
                style={{ fontSize: 13 }}
              />
              <button className="btn-primary" type="submit" disabled={searching} style={{ padding: '8px 12px' }}>
                {searching ? '…' : 'Go'}
              </button>
            </form>
            {searchNote && <p style={{ fontSize: 11, color: '#8888aa', marginTop: 8, lineHeight: 1.5 }}>{searchNote}</p>}
            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToShelf(p)}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 8, cursor: 'pointer' }}
                  >
                    <p style={{ fontSize: 12, color: '#e2e2ea' }}>{p.title}</p>
                    {p.price && <p style={{ fontSize: 11, color: '#ffd97a' }}>{p.price}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8888aa', marginBottom: 10 }}>
              Shelf ({shelf.length})
            </p>
            {shelf.length === 0 ? (
              <p style={{ fontSize: 12, color: '#5a5a72' }}>Search above, or add products by hand.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shelf.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#e2e2ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                      {p.price && <p style={{ fontSize: 11, color: '#ffd97a' }}>{p.price}</p>}
                    </div>
                    <button
                      onClick={() => setStage((s) => ({ ...s, featured: p, fullscreen: false }))}
                      className="btn-ghost"
                      style={{ padding: '4px 9px', fontSize: 11 }}
                    >
                      Show
                    </button>
                    <button
                      onClick={() => setShelf((s) => s.filter((x) => x.id !== p.id))}
                      style={{ background: 'none', border: 'none', color: '#5a5a72', cursor: 'pointer', fontSize: 14 }}
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 940px) { .studio-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
