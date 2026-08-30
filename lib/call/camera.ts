// Protected camera pipeline.
//
// The rule this exists to enforce: some people on this team must never have
// their face transmitted. So the raw camera track is NEVER handed to a peer
// connection. It is drawn to a canvas, transformed, and only the canvas
// stream is published.
//
// Two properties matter more than features here:
//
//   1. Default-deny. A call starts protected. Showing your face is an
//      explicit action, not the absence of one — so nobody is ever exposed by
//      forgetting a setting or by a page loading before their preference does.
//   2. Fail closed. If the canvas or the transform can't start, we publish no
//      video at all. A broken blur must never degrade into a clear picture.

export type CameraMode =
  | 'blur'      // heavy whole-frame blur; presence without identity
  | 'avatar'    // no camera pixels at all, just initials
  | 'off'       // no video track
  | 'clear'     // raw camera — only for accounts allowed to show their face

export const PROTECTED_MODES: CameraMode[] = ['blur', 'avatar', 'off']

export interface CameraHandle {
  /** The stream to publish. Never contains the raw camera video track. */
  stream: MediaStream
  mode: CameraMode
  stop: () => void
  setMode: (mode: CameraMode) => void
}

const W = 640
const H = 360

// Deliberately whole-frame, not face-tracking. Face detection that loses the
// face exposes it; a blur over everything cannot fail that way.
const BLUR_PX = 28

export interface CameraOptions {
  mode: CameraMode
  /** Modes this account is permitted to use. 'clear' absent = face locked. */
  allowed: CameraMode[]
  initials: string
  onError?: (message: string) => void
}

/**
 * Opens the camera and returns a publishable stream that respects `mode`.
 * Audio passes through untouched; only video is transformed.
 */
export async function openProtectedCamera(opts: CameraOptions): Promise<CameraHandle> {
  const { allowed, initials, onError } = opts

  // An account that isn't allowed a mode can never be put into it, whatever
  // the caller asks for.
  let mode: CameraMode = allowed.includes(opts.mode) ? opts.mode : (allowed[0] ?? 'off')

  const raw = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: W }, height: { ideal: H }, frameRate: { ideal: 24 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  })

  const video = document.createElement('video')
  video.srcObject = new MediaStream(raw.getVideoTracks())
  video.muted = true
  video.playsInline = true
  await video.play().catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Fail closed: with no canvas there is no safe way to transform the picture,
  // so publish audio only rather than falling back to the raw camera.
  if (!ctx) {
    onError?.('Could not start the privacy filter — publishing audio only.')
    raw.getVideoTracks().forEach((t) => t.stop())
    return {
      stream: new MediaStream(raw.getAudioTracks()),
      mode: 'off',
      stop: () => raw.getTracks().forEach((t) => t.stop()),
      setMode: () => {},
    }
  }

  let raf = 0
  const draw = () => {
    ctx.clearRect(0, 0, W, H)

    if (mode === 'clear') {
      ctx.filter = 'none'
      drawCover(ctx, video)
    } else if (mode === 'blur') {
      // The blur is applied as the pixels are drawn, so unblurred pixels never
      // exist on this canvas — and the canvas is the only thing published.
      ctx.filter = `blur(${BLUR_PX}px)`
      drawCover(ctx, video)
      ctx.filter = 'none'
      badge(ctx, 'CAMERA PROTECTED')
    } else {
      // avatar / off: nothing from the camera is drawn at all.
      ctx.fillStyle = '#12121c'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#f0b429'
      ctx.font = '600 84px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initials.slice(0, 2).toUpperCase(), W / 2, H / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      badge(ctx, mode === 'off' ? 'CAMERA OFF' : 'CAMERA PROTECTED')
    }

    raf = requestAnimationFrame(draw)
  }
  draw()

  const out = canvas.captureStream(24)
  raw.getAudioTracks().forEach((t) => out.addTrack(t))

  // The raw video track is kept alive only as the canvas source; it is never
  // added to `out`, so it cannot reach a peer connection.
  return {
    stream: out,
    mode,
    stop: () => {
      cancelAnimationFrame(raf)
      raw.getTracks().forEach((t) => t.stop())
      out.getTracks().forEach((t) => t.stop())
    },
    setMode: (next: CameraMode) => {
      if (!allowed.includes(next)) return
      mode = next
    },
  }
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) {
    ctx.fillStyle = '#12121c'
    ctx.fillRect(0, 0, W, H)
    return
  }
  const scale = Math.max(W / vw, H / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

function badge(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save()
  ctx.font = '600 12px monospace'
  const w = ctx.measureText(text).width + 16
  ctx.fillStyle = 'rgba(8,8,15,.75)'
  ctx.fillRect(10, H - 32, w, 22)
  ctx.strokeStyle = 'rgba(240,180,41,.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(10, H - 32, w, 22)
  ctx.fillStyle = '#ffd97a'
  ctx.fillText(text, 18, H - 17)
  ctx.restore()
}
