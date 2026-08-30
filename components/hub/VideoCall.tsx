'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { openProtectedCamera, type CameraHandle, type CameraMode } from '@/lib/call/camera'
import type { CameraPolicy } from '@/lib/call/policy'

// Team video call.
//
// A small WebRTC mesh signalled over the Supabase Realtime channel the chat
// already uses — no new service, no room server. Fine for the two-to-four
// people who will ever be on it; a mesh gets expensive past that.
//
// The camera never reaches a peer connection directly. See lib/call/camera.ts.

const ROOM = 'team-call'
const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

interface Peer {
  id: string
  name: string
  pc: RTCPeerConnection
  stream: MediaStream
}

export default function VideoCall({
  me,
  myName,
  policy,
  onLeave,
}: {
  me: string
  myName: string
  policy: CameraPolicy
  onLeave: () => void
}) {
  const [mode, setMode] = useState<CameraMode>(policy.initial)
  const [micOn, setMicOn] = useState(true)
  const [peers, setPeers] = useState<Peer[]>([])
  const [status, setStatus] = useState('Starting camera…')
  const [error, setError] = useState<string | null>(null)

  const camRef = useRef<CameraHandle | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Map<string, Peer>>(new Map())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const upsertPeer = useCallback((peer: Peer) => {
    peersRef.current.set(peer.id, peer)
    setPeers(Array.from(peersRef.current.values()))
  }, [])

  const dropPeer = useCallback((id: string) => {
    const p = peersRef.current.get(id)
    p?.pc.close()
    peersRef.current.delete(id)
    setPeers(Array.from(peersRef.current.values()))
  }, [])

  const makePeer = useCallback((id: string, name: string): Peer => {
    const pc = new RTCPeerConnection(ICE)
    const stream = new MediaStream()

    camRef.current?.stream.getTracks().forEach((t) => pc.addTrack(t, camRef.current!.stream))

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!stream.getTracks().some((x) => x.id === t.id)) stream.addTrack(t)
      })
      setPeers(Array.from(peersRef.current.values()))
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: { to: id, from: me, kind: 'ice', data: e.candidate.toJSON() },
        })
      }
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) dropPeer(id)
    }

    const peer: Peer = { id, name, pc, stream }
    upsertPeer(peer)
    return peer
  }, [me, dropPeer, upsertPeer])

  useEffect(() => {
    const sb = createClient()
    let cancelled = false

    ;(async () => {
      try {
        const cam = await openProtectedCamera({
          mode: policy.initial,
          allowed: policy.allowed,
          initials: myName,
          onError: (m) => setError(m),
        })
        if (cancelled) { cam.stop(); return }
        camRef.current = cam
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cam.stream
          localVideoRef.current.play().catch(() => {})
        }
        setStatus('Waiting for someone to join…')
      } catch (err) {
        // No camera means no video — audio-only would need a separate stream,
        // and silently proceeding is worse than saying what happened.
        setError(err instanceof Error ? `Camera unavailable: ${err.message}` : 'Camera unavailable')
        setStatus('Not connected')
        return
      }

      const channel = sb.channel(ROOM, { config: { broadcast: { self: false } } })
      channelRef.current = channel

      channel.on('broadcast', { event: 'join' }, async ({ payload }) => {
        if (payload.from === me || peersRef.current.has(payload.from)) return
        // The existing member makes the offer, so two people joining at once
        // don't both try to lead.
        const peer = makePeer(payload.from, payload.name ?? 'Teammate')
        const offer = await peer.pc.createOffer()
        await peer.pc.setLocalDescription(offer)
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { to: payload.from, from: me, name: myName, kind: 'offer', data: offer },
        })
        setStatus('Connecting…')
      })

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.to !== me) return
        let peer = peersRef.current.get(payload.from)

        if (payload.kind === 'offer') {
          if (!peer) peer = makePeer(payload.from, payload.name ?? 'Teammate')
          await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.data))
          const answer = await peer.pc.createAnswer()
          await peer.pc.setLocalDescription(answer)
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { to: payload.from, from: me, name: myName, kind: 'answer', data: answer },
          })
          setStatus('Connected')
        } else if (payload.kind === 'answer' && peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.data))
          setStatus('Connected')
        } else if (payload.kind === 'ice' && peer) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(payload.data)).catch(() => {})
        }
      })

      channel.on('broadcast', { event: 'leave' }, ({ payload }) => dropPeer(payload.from))

      channel.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'join', payload: { from: me, name: myName } })
        }
      })
    })()

    return () => {
      cancelled = true
      channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: { from: me } })
      peersRef.current.forEach((p) => p.pc.close())
      peersRef.current.clear()
      camRef.current?.stop()
      if (channelRef.current) sb.removeChannel(channelRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function changeMode(next: CameraMode) {
    if (!policy.allowed.includes(next)) return
    camRef.current?.setMode(next)
    setMode(next)
  }

  function toggleMic() {
    const track = camRef.current?.stream.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicOn(track.enabled)
  }

  return (
    <div style={{ border: '1px solid rgba(240,180,41,.2)', borderRadius: 12, background: '#0b0b14', padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4ad3a0', boxShadow: '0 0 8px #4ad3a0' }} />
        <span style={{ fontSize: 12, letterSpacing: 2, color: '#ffd97a', fontFamily: 'monospace' }}>TEAM CALL</span>
        <span style={{ fontSize: 11, color: '#8888aa' }}>{status}</span>
        <button className="btn-ghost" onClick={onLeave} style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12 }}>
          Leave
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        <Tile label={`${myName} (you)`}>
          <video ref={localVideoRef} muted playsInline autoPlay style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', background: '#12121c' }} />
        </Tile>
        {peers.map((p) => (
          <Tile key={p.id} label={p.name}>
            <RemoteVideo stream={p.stream} />
          </Tile>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-ghost" onClick={toggleMic} style={{ fontSize: 12 }}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        {(['blur', 'avatar', 'off', 'clear'] as CameraMode[])
          .filter((m) => policy.allowed.includes(m))
          .map((m) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className="btn-ghost"
              style={{ fontSize: 12, ...(mode === m ? { borderColor: 'rgba(240,180,41,.5)', color: '#ffd97a' } : {}) }}
            >
              {m === 'clear' ? 'Show my face' : m === 'blur' ? 'Blurred' : m === 'avatar' ? 'Initials' : 'Camera off'}
            </button>
          ))}
      </div>

      {policy.faceLocked && (
        <p style={{ fontSize: 11, color: 'rgba(74,211,160,.75)', marginTop: 10, lineHeight: 1.5 }}>
          Camera protection is locked on for this account. Your face is never sent — the
          picture is blurred before it leaves this device, and clear video isn&apos;t an
          option here.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: '#ff6b6b', marginTop: 8 }}>{error}</p>}
    </div>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
      {children}
      <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, color: '#e2e2ea', background: 'rgba(8,8,15,.7)', padding: '2px 7px', borderRadius: 4 }}>
        {label}
      </span>
    </div>
  )
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream
      ref.current.play().catch(() => {})
    }
  }, [stream])
  return <video ref={ref} playsInline autoPlay style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', background: '#12121c' }} />
}
