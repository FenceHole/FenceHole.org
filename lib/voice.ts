// Nessie's speaking voice.
//
// The browser's default voice is the flat robotic one — every OS ships far
// better voices, they're just never selected by default. This picks the best
// installed voice, reads text rather than markup, and works around the
// long-utterance bug that makes Chrome stop mid-sentence.

let cached: SpeechSynthesisVoice | null = null

// Modern system voices advertise themselves in their names. Ranked by how
// natural they actually sound rather than alphabetically.
const QUALITY_HINTS = [
  'natural', 'neural', 'premium', 'enhanced', 'siri', 'google',
]

// Known-good female English voices across macOS, iOS, Windows and Chrome.
const PREFERRED_NAMES = [
  'samantha', 'ava', 'allison', 'susan', 'zoe', 'joanna', 'serena',
  'aria', 'jenny', 'michelle', 'sonia', 'libby', 'emma',
]

function score(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  let s = 0

  // English only — a mismatched language reads the words phonetically wrong.
  if (!v.lang?.toLowerCase().startsWith('en')) return -1
  if (v.lang.toLowerCase().startsWith('en-us') || v.lang.toLowerCase().startsWith('en-gb')) s += 10

  QUALITY_HINTS.forEach((hint, i) => {
    if (name.includes(hint)) s += 40 - i * 3
  })

  const pref = PREFERRED_NAMES.findIndex((n) => name.includes(n))
  if (pref !== -1) s += 30 - pref

  // These are the flat robotic ones people recognise as "computer voice".
  if (/albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|ralph|junior|kathy|princess/i.test(name)) s -= 100

  if (v.localService) s += 5
  return s
}

/** The best installed voice, or null to let the browser choose. */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (cached) return cached
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null // not loaded yet; caller retries on voiceschanged

  const ranked = voices
    .map((v) => ({ v, s: score(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)

  cached = ranked[0]?.v ?? null
  return cached
}

export function setVoice(v: SpeechSynthesisVoice | null) {
  cached = v
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis
    .getVoices()
    .map((v) => ({ v, s: score(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)
}

/** Strip markup so she doesn't read asterisks and backticks aloud. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code block. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-–—•*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Chrome silently stops long utterances partway through, so speech is queued
// in sentence-sized pieces instead of one block.
function chunk(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  const out: string[] = []
  let buf = ''
  for (const s of sentences) {
    if ((buf + s).length > max && buf) { out.push(buf.trim()); buf = s }
    else buf += s
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onEnd?: () => void
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const clean = speakable(text)
  if (!clean) return

  window.speechSynthesis.cancel()
  const voice = pickVoice()
  const parts = chunk(clean)

  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part)
    if (voice) u.voice = voice
    // Slightly quick and just under default pitch reads as composed rather
    // than chirpy — closer to how she's written.
    u.rate = opts.rate ?? 1.05
    u.pitch = opts.pitch ?? 0.95
    u.volume = 1
    if (i === parts.length - 1 && opts.onEnd) u.onend = opts.onEnd
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
