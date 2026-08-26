import Link from 'next/link'
import NessieDock from '@/components/NessieDock'

export default function HQLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hq-bg min-h-screen text-white">
      <div className="px-6 pt-4">
        <Link href="/hub" className="text-xs text-white/40 hover:text-amber-300/70 transition-colors">
          ← Back to Hub
        </Link>
      </div>
      {children}
      <NessieDock />
    </div>
  )
}
