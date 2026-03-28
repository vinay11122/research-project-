import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Verifying your email...')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (router.isReady) {
      const { token } = router.query
      if (!token) {
        setMessage("No verification token found.")
        setError(true)
        setLoading(false)
        return
      }

      async function verifyToken() {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/auth/verify-email/${token}`, {
            method: 'GET',
          })

          const data = await res.json()

          if (!res.ok) {
            throw new Error(data.detail || 'Failed to verify email')
          }

          setMessage(data.message)
          setError(false)
        } catch (err: any) {
          setMessage(err.message)
          setError(true)
        } finally {
          setLoading(false)
        }
      }
      
      verifyToken()
    }
  }, [router.isReady, router.query])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            Email Verification
          </h2>
        </div>

        <div className={`p-4 rounded-md text-sm ${
            loading 
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : error 
              ? 'bg-red-50 text-red-700 border-red-200' 
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
          <p>{message}</p>
        </div>

        {!loading && (
          <div className="text-center">
            <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Proceed to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
