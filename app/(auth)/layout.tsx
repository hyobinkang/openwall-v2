export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <span className="text-xs tracking-[0.3em] uppercase text-gray-400">
            Organizer
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Openwall</h1>
          <p className="mt-2 text-sm text-gray-400">
            전시 주최자를 위한 플랫폼
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
