'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@/utils/firebaseConfig'
import { v4 as uuidv4 } from 'uuid'

export default function InviteClientPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [link, setLink] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setLink('')
    setLoading(true)

    try {
      const token = uuidv4()

      const docRef = await addDoc(collection(firestore, 'projects'), {
        client_name: clientName,
        client_email: email,
        client_token: token,
        admin_id: 'admin',
        created_at: serverTimestamp(),
      })

      const magicLink = `${window.location.origin}/client/invite/${token}`
      setLink(magicLink)
      setMessage('✅ Invite link generated!')
    } catch (e: any) {
      setMessage('❌ Failed to send invite: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">Invite New Client</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Client Full Name"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          placeholder="Client Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          required
          className="w-full border px-3 py-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded w-full"
        >
          {loading ? 'Sending...' : 'Generate Magic Link'}
        </button>
      </form>

      {message && <p className="text-center">{message}</p>}

      {link && (
        <div className="bg-gray-100 p-4 rounded mt-4">
          <p className="font-medium text-gray-700 mb-2">Client Access Link:</p>
          <a
            href={link}
            target="_blank"
            className="text-blue-600 underline break-words"
          >
            {link}
          </a>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
