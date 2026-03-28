import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import EmailVerificationBanner from './EmailVerificationBanner'

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <EmailVerificationBanner />
        <Header />

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}