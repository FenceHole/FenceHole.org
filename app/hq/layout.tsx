import Link from 'next/link'

export default function HQLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="px-6 pt-4">
        <Link href="/hub" className="text-xs text-white/40 hover:text-white/70">
          ← Back to Hub
        </Link>
      </div>
      {children}
    </div>
  )
}
