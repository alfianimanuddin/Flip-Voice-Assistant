import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface FeedbackEntry {
  timestamp: string
  originalInput: string
  extractedData: any
  wasIncomplete: boolean
  attemptsCount: number
  success: boolean
}

const FEEDBACK_FILE = path.join(process.cwd(), 'data', 'learning-feedback.json')

// Ensure data directory and file exist
function ensureFeedbackFile() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([]))
  }
}

export async function POST(request: NextRequest) {
  try {
    const { originalInput, extractedData, wasIncomplete, attemptsCount } = await request.json()

    ensureFeedbackFile()

    // Read existing feedback
    const feedbackData = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'))

    // Create new feedback entry
    const newEntry: FeedbackEntry = {
      timestamp: new Date().toISOString(),
      originalInput,
      extractedData,
      wasIncomplete: wasIncomplete || false,
      attemptsCount: attemptsCount || 1,
      success: true
    }

    // Add to feedback array
    feedbackData.push(newEntry)

    // Keep only last 100 entries to avoid file getting too large
    const recentFeedback = feedbackData.slice(-100)

    // Save back to file
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(recentFeedback, null, 2))

    return NextResponse.json({ success: true, message: 'Feedback stored' })
  } catch (error) {
    console.error('Error storing feedback:', error)
    return NextResponse.json(
      { error: 'Failed to store feedback' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    ensureFeedbackFile()

    const feedbackData = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'))

    // Get recent successful patterns (last 20)
    const recentPatterns = feedbackData
      .filter((entry: FeedbackEntry) => entry.success)
      .slice(-20)
      .map((entry: FeedbackEntry) => ({
        input: entry.originalInput,
        output: entry.extractedData,
        type: entry.extractedData.type
      }))

    return NextResponse.json({ patterns: recentPatterns })
  } catch (error) {
    console.error('Error retrieving feedback:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve feedback' },
      { status: 500 }
    )
  }
}
