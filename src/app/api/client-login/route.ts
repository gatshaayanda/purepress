// src/app/api/client-login/route.ts
import { NextResponse } from 'next/server'

const CLIENTS: Record<string, string> = {
  'kaygatsha@gmail.com': process.env.CLIENT_PASSWORD_KAYGATSHA_GMAIL_COM!,
   'mingymotsumi@gmail.com': process.env.CLIENT_PASSWORD_MINGYMOTSUMI_GMAIL_COM!,
    // Add more emails and env keys here as needed
}

export async function POST(req: Request) {
  const { password } = await req.json()

  const entry = Object.entries(CLIENTS).find(([_, pw]) => pw === password)

  if (!entry) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const [email] = entry

  // Return the email to the client so they can set the cookie
  return NextResponse.json({ success: true, email })
}
