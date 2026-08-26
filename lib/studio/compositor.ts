// The studio compositor.
//
// Everything the audience sees is drawn to one canvas: camera, screen share,
// and product overlays. captureStream() on that canvas gives a single video
// track, which is what gets recorded or published — so the overlay is baked
// into the broadcast rather than being a browser-only decoration.

export interface StageProduct {
  id: string
  title: string
  price?: string | null
  imageUrl?: string | null
  url?: string | null
}

export type Layout = 'camera' | 'screen' | 'side-by-side'

export interface StageState {
  layout: Layout
  /** Product shown as a floating card, or null. */
  featured: StageProduct | null
  /** Featured product takes the whole frame. */
  fullscreen: boolean
  headline: string | null
}

export const STAGE_W = 1280
export const STAGE_H = 720

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw a video filling the box, cropping rather than stretching. */
function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/** Draw a video fitting inside the box, letterboxed — for screen shares. */
function drawContain(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.min(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export interface CompositorSources {
  camera: HTMLVideoElement | null
  screen: HTMLVideoElement | null
  productImage: HTMLImageElement | null
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sources: CompositorSources,
  state: StageState
) {
  const { camera, screen, productImage } = sources

  ctx.fillStyle = '#08080f'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  // A featured product at full size is the whole frame, with the presenter
  // tucked into the corner so the viewer still sees who's talking.
  if (state.fullscreen && state.featured) {
    drawProductFull(ctx, state.featured, productImage)
    if (camera) {
      const pipW = 300
      const pipH = 169
      const x = STAGE_W - pipW - 28
      const y = STAGE_H - pipH - 28
      ctx.save()
      roundRect(ctx, x, y, pipW, pipH, 10)
      ctx.clip()
      drawCover(ctx, camera, x, y, pipW, pipH)
      ctx.restore()
      ctx.strokeStyle = 'rgba(240,180,41,.5)'
      ctx.lineWidth = 2
      roundRect(ctx, x, y, pipW, pipH, 10)
      ctx.stroke()
    }
    return
  }

  if (state.layout === 'screen' && screen) {
    drawContain(ctx, screen, 0, 0, STAGE_W, STAGE_H)
    if (camera) {
      const pipW = 280
      const pipH = 158
      const x = STAGE_W - pipW - 24
      const y = STAGE_H - pipH - 24
      ctx.save()
      roundRect(ctx, x, y, pipW, pipH, 10)
      ctx.clip()
      drawCover(ctx, camera, x, y, pipW, pipH)
      ctx.restore()
    }
  } else if (state.layout === 'side-by-side' && screen) {
    const half = STAGE_W / 2
    drawContain(ctx, screen, 0, 0, half, STAGE_H)
    if (camera) drawCover(ctx, camera, half, 0, half, STAGE_H)
  } else if (camera) {
    drawCover(ctx, camera, 0, 0, STAGE_W, STAGE_H)
  } else {
    ctx.fillStyle = '#3a3a4a'
    ctx.font = '500 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No camera — click Start Camera', STAGE_W / 2, STAGE_H / 2)
    ctx.textAlign = 'left'
  }

  if (state.featured) drawProductCard(ctx, state.featured, productImage)
  if (state.headline) drawHeadline(ctx, state.headline)
}

function drawHeadline(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save()
  const pad = 16
  ctx.font = '600 26px system-ui, sans-serif'
  const w = Math.min(ctx.measureText(text).width + pad * 2, STAGE_W - 80)
  const h = 52
  const x = 40
  const y = 40
  ctx.fillStyle = 'rgba(8,8,15,.78)'
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(240,180,41,.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#ffd97a'
  ctx.fillText(text, x + pad, y + 34)
  ctx.restore()
}

function drawProductCard(ctx: CanvasRenderingContext2D, p: StageProduct, img: HTMLImageElement | null) {
  ctx.save()
  const w = 360
  const h = 132
  const x = 40
  const y = STAGE_H - h - 40

  ctx.fillStyle = 'rgba(8,8,15,.86)'
  roundRect(ctx, x, y, w, h, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(240,180,41,.5)'
  ctx.lineWidth = 2
  ctx.stroke()

  const thumb = 96
  const tx = x + 16
  const ty = y + (h - thumb) / 2
  if (img && img.complete && img.naturalWidth) {
    ctx.save()
    roundRect(ctx, tx, ty, thumb, thumb, 8)
    ctx.clip()
    const scale = Math.max(thumb / img.naturalWidth, thumb / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    ctx.drawImage(img, tx + (thumb - dw) / 2, ty + (thumb - dh) / 2, dw, dh)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.06)'
    roundRect(ctx, tx, ty, thumb, thumb, 8)
    ctx.fill()
  }

  const textX = tx + thumb + 16
  const maxW = w - (textX - x) - 16

  ctx.fillStyle = '#f0f0f4'
  ctx.font = '600 19px system-ui, sans-serif'
  wrapText(ctx, p.title, textX, y + 46, maxW, 24, 2)

  if (p.price) {
    ctx.fillStyle = '#ffd97a'
    ctx.font = '700 22px system-ui, sans-serif'
    ctx.fillText(p.price, textX, y + h - 26)
  }
  ctx.restore()
}

function drawProductFull(ctx: CanvasRenderingContext2D, p: StageProduct, img: HTMLImageElement | null) {
  ctx.save()
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)

  const boxW = STAGE_W * 0.44
  if (img && img.complete && img.naturalWidth) {
    const scale = Math.min((boxW - 60) / img.naturalWidth, (STAGE_H - 140) / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    ctx.drawImage(img, (boxW - dw) / 2 + 30, (STAGE_H - dh) / 2, dw, dh)
  }

  const textX = boxW + 40
  const maxW = STAGE_W - textX - 60

  ctx.fillStyle = '#ffd97a'
  ctx.font = '700 15px monospace'
  ctx.fillText('FEATURED', textX, 150)

  ctx.fillStyle = '#f0f0f4'
  ctx.font = '600 42px system-ui, sans-serif'
  const endY = wrapText(ctx, p.title, textX, 210, maxW, 50, 4)

  if (p.price) {
    ctx.fillStyle = '#ffd97a'
    ctx.font = '700 54px system-ui, sans-serif'
    ctx.fillText(p.price, textX, endY + 70)
  }
  ctx.restore()
}

/** Returns the y of the last line drawn. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(' ')
  let line = ''
  let lines = 0
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines += 1
      if (lines === maxLines) {
        ctx.fillText(`${line.trim()}…`, x, cy)
        return cy
      }
      ctx.fillText(line, x, cy)
      cy += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
  return cy
}
