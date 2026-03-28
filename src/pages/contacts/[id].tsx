import { useRouter } from 'next/router'

export default function ContactDetailsPage() {
  const router = useRouter()
  const { id } = router.query

  return (
    <div style={{ padding: 16 }}>
      <h1>Contact Details</h1>
      <p>Contact ID: {String(id ?? '')}</p>
    </div>
  )
}
