import { useState, useEffect } from 'react'
import { UserResponse } from '@/types' // Assuming you have this type from your API responses

export default function EmailVerificationBanner() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function fetchUser() {
      const token = localStorage.getItem('token')
      if (!token) return

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const userData: UserResponse = await res.json()
          setUser(userData)
          if (!userData.is_verified) {
            setShowBanner(true)
          }
        }
      } catch (error) {
        console.error("Failed to fetch user", error)
      }
    }

    fetchUser()
  }, [])

  async function handleResend() {
    setLoading(true)
    setMessage('')
    const token = localStorage.getItem('token')
    if (!token) return

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/auth/resend-verification-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.detail || 'Failed to resend email')
        }

        setMessage(data.message)
    } catch (err: any) {
        setMessage(err.message)
    } finally {
        setLoading(false)
    }
  }

  if (!showBanner) {
    return null
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <p className="text-sm text-yellow-800">
          {message ? message : "Please verify your email address. Check your inbox for a verification link."}
        </p>
        {!message && (
            <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm font-medium text-yellow-900 hover:text-yellow-800 disabled:opacity-50"
            >
            {loading ? 'Sending...' : 'Resend verification email'}
            </button>
        )}
      </div>
    </div>
  )
}
