import { NextRequest, NextResponse } from 'next/server'
import { encryptPaymentData } from '@/app/lib/crypto'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    if (!data || !data.type) {
      return NextResponse.json(
        { error: 'Invalid payment data' },
        { status: 400 }
      )
    }

    // Validate transaction type
    const validTypes = ['transfer', 'ewallet', 'pulsa', 'gold', 'token']
    if (!validTypes.includes(data.type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Generate encrypted token
    const token = encryptPaymentData(data)

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error generating payment token:', error)
    return NextResponse.json(
      { error: 'Failed to generate payment token' },
      { status: 500 }
    )
  }
}
