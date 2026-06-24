import { Outlet } from 'react-router-dom'

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <main className="flex-1 mx-auto w-full" style={{ maxWidth: 'var(--container-max)' }}>
        <Outlet />
      </main>
    </div>
  )
}