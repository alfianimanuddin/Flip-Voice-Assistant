import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Use Edge Runtime for lower latency
export const runtime = 'edge'

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // requests per window
const RATE_WINDOW = 60 * 1000 // 1 minute in milliseconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  Array.from(rateLimitMap.entries()).forEach(([ip, record]) => {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
    }
  })
}, 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.' },
        { status: 429 }
      )
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const { text, context } = await request.json()

    // Validate and sanitize input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Ups, aku tidak mendengar suaramu. Coba bicara lebih jelas ya!' },
        { status: 400 }
      )
    }

    // Additional server-side sanitization
    const sanitizedText = text
      .replace(/[<>{}[\]\\]/g, '')
      .slice(0, 500)
      .trim()

    if (!sanitizedText) {
      return NextResponse.json(
        { error: 'Ups, aku tidak mendengar suaramu. Coba bicara lebih jelas ya!' },
        { status: 400 }
      )
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Skip learning patterns fetch to reduce latency
    const learningExamples = ''

    // Build the prompt with context if available
    let promptPrefix = ''
    if (context && context.partialData) {
      promptPrefix = `CONTEXT: The user previously started a transaction with partial data: ${JSON.stringify(context.partialData)}.
The user was asked: "${context.message}"

Now the user has responded with new information: "${sanitizedText}"

IMPORTANT:
- If the new input appears to be answering the question (providing the missing information), MERGE it with the previous partial data.
- If the new input is a completely different transaction command, IGNORE the previous context and process it as a new transaction.
- Determine whether the input is related to the previous transaction or a new one based on the content.

${learningExamples}
`
    } else {
      promptPrefix = `Extract transaction data from this Indonesian text: "${sanitizedText}"

${learningExamples}
`
    }

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: promptPrefix + `

Identify the transaction type and return ONLY a valid JSON object (no other text).

IMPORTANT: If the command is INCOMPLETE (missing required fields), return:
{
  "incomplete": true,
  "type": "transfer" (or other type if detectable),
  "partialData": { ...fields that were provided... },
  "missingFields": ["field1", "field2"],
  "message": "Friendly Indonesian question asking for the missing information"
}

Transaction Types and Required Fields:

1. BANK TRANSFER (requires: type, amount, bank, accountNumber):
{
  "type": "transfer",
  "amount": "100000",
  "bank": "BCA",
  "accountNumber": "1234567890"
}

2. E-WALLET TOP UP (requires: type, amount, ewallet, phoneNumber):
{
  "type": "ewallet",
  "amount": "50000",
  "ewallet": "GOPAY",
  "phoneNumber": "082354614676"
}

3. PULSA/CREDIT (requires: type, amount, phoneNumber):
{
  "type": "pulsa",
  "amount": "50000",
  "provider": "TELKOMSEL",
  "phoneNumber": "082354614676"
}

4. GOLD PURCHASE (requires: type, amount OR grams):
{
  "type": "gold",
  "amount": "2000000",
  "grams": "2"
}

5. PLN ELECTRICITY TOKEN (requires: type, amount, meterNumber):
{
  "type": "token",
  "amount": "50000",
  "meterNumber": "53871417245"
}

Rules:
- Convert "ribu/rb/k" to 000, "juta/jt" to 000000
- Handle various number formats: "1.230.500" -> "1230500", "520.200" -> "520200", "100,000" -> "100000"
- Handle spoken Indonesian numbers correctly:
  * "lima ratus satu" = 500 + 1 = 501 (NOT 5001)
  * "dua ratus lima" = 200 + 5 = 205 (NOT 2005)
  * "seribu dua ratus" = 1000 + 200 = 1200
  * "lima ratus ribu" = 500 * 1000 = 500000
  * "satu juta dua ratus ribu" = 1000000 + 200000 = 1200000
  * "sepuluh ribu lima ratus" = 10000 + 500 = 10500
  * Pattern: [X ratus Y] means (X * 100) + Y, [X ribu Y] means (X * 1000) + Y
- Handle mixed formats: "1,5 juta" -> "1500000", "2.5jt" -> "2500000"
- Phone numbers and account numbers should be digits only
- Amount should be plain number string without dots/commas (e.g., "1230500" not "1.230.500")
- For gold: if "gram" or "gr" mentioned, put in grams field; if only amount, calculate grams based on ~1jt per gram

SELF-CORRECTION HANDLING:
When users correct themselves mid-sentence, ALWAYS use the LATEST/CORRECTED value:
- Correction phrases: "oh maksud saya", "maksudnya", "bukan", "salah", "eh", "tunggu"
- Examples:
  * "transfer ke BCA 029329, oh maksud saya 029229" -> use "029229" (NOT "029329")
  * "100 ribu, eh 200 ribu" -> use "200000" (NOT "100000")
  * "ke nomor 0812, maksudnya 0813" -> use "0813" (NOT "0812")
  * "gopay, bukan ovo" -> use "OVO" (NOT "GOPAY")
- IMPORTANT: When correction detected, discard the FIRST value and use the CORRECTED value only

Indonesian Banks (uppercase):
BCA, MANDIRI, BNI, BRI, CIMB, CIMB NIAGA, PERMATA, DANAMON, MEGA, BTN, BTPN, JENIUS, OCBC, OCBC NISP, HSBC, MAYBANK, UOB, PANIN, BUKOPIN, SINARMAS, BSI, MUAMALAT, COMMONWEALTH, CITIBANK, STANDARD CHARTERED, DBS, BANK JAGO, SEABANK, NEO COMMERCE, NOBU, ALLO BANK, SUPERBANK, LINE BANK, MOTION BANKING, BNC, DIGIBANK

E-wallets (uppercase):
GOPAY, OVO, DANA, SHOPEEPAY, LINKAJA, ISAKU, SAKUKU, DOKU, PAYPRO, KREDIVO, AKULAKU, BLUEPAY, TRUEMONEY, YUKK, ASTRAPAY, GOPAYLATER

Phone Providers (uppercase) - Auto-detect from phone number prefix:
- TELKOMSEL: 0811, 0812, 0813, 0821, 0822, 0823, 0851, 0852, 0853
- INDOSAT: 0814, 0815, 0816, 0855, 0856, 0857, 0858
- XL: 0817, 0818, 0819, 0859, 0877, 0878
- AXIS: 0831, 0832, 0833, 0838
- TRI: 0895, 0896, 0897, 0898, 0899
- SMARTFREN: 0881, 0882, 0883, 0884, 0885, 0886, 0887, 0888, 0889

Note: For pulsa, if user only provides phone number without provider name, auto-detect provider from prefix

Examples of COMPLETE commands (DO NOT include "message" field for complete commands):
"transfer 100 ribu ke BCA 1234567890" -> {"type": "transfer", "amount": "100000", "bank": "BCA", "accountNumber": "1234567890"}
"top up gopay 50rb ke 082354614676" -> {"type": "ewallet", "amount": "50000", "ewallet": "GOPAY", "phoneNumber": "082354614676"}
"beli pulsa telkomsel 50 ribu ke 082354614676" -> {"type": "pulsa", "amount": "50000", "provider": "TELKOMSEL", "phoneNumber": "082354614676"}

IMPORTANT: For COMPLETE commands, return ONLY the data fields (type, amount, etc). Do NOT include any "message" or "incomplete" field.

Examples of INCOMPLETE commands (use SHORT, DIRECT messages - just ask for missing info):
"beli pulsa 20000" -> {"incomplete": true, "type": "pulsa", "partialData": {"amount": "20000"}, "missingFields": ["phoneNumber"], "message": "Ke nomor HP berapa?"}
"beli pulsa ke nomor 081234567890" -> {"incomplete": true, "type": "pulsa", "partialData": {"phoneNumber": "081234567890", "provider": "TELKOMSEL"}, "missingFields": ["amount"], "message": "Nominal berapa?"}
"transfer ke BCA 1234567890" -> {"incomplete": true, "type": "transfer", "partialData": {"bank": "BCA", "accountNumber": "1234567890"}, "missingFields": ["amount"], "message": "Nominalnya berapa?"}
"transfer 100 ribu" -> {"incomplete": true, "type": "transfer", "partialData": {"amount": "100000"}, "missingFields": ["bank", "accountNumber"], "message": "Ke bank apa dan nomor rekening berapa?"}
"top up gopay" -> {"incomplete": true, "type": "ewallet", "partialData": {"ewallet": "GOPAY"}, "missingFields": ["amount", "phoneNumber"], "message": "Nominal berapa dan ke nomor HP berapa?"}
"token listrik 50 ribu" -> {"incomplete": true, "type": "token", "partialData": {"amount": "50000"}, "missingFields": ["meterNumber"], "message": "Nomor meter PLN-nya berapa?"}

IMPORTANT for incomplete messages: Be SHORT and DIRECT. Do NOT start with "Oke" or repeat the transaction details. Just ask for the missing information directly.`,
        },
      ],
    })

    // Extract the response text
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    console.log('Claude raw response:', responseText)

    // Clean response (remove markdown code blocks if present)
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('Cleaned text:', cleanedText)

    // Parse JSON
    const extractedData = JSON.parse(cleanedText)

    console.log('Parsed data:', extractedData)

    // Validate the data has required fields
    if (!extractedData.type) {
      console.error('Missing type field in extracted data')
      return NextResponse.json(
        { error: 'Hmm, aku belum paham maksudnya. Coba sebutkan dengan jelas ya, misalnya "transfer 100 ribu ke BCA 1234567890"' },
        { status: 400 }
      )
    }

    // Return the data (can be complete or incomplete)
    return NextResponse.json(extractedData)
  } catch (error) {
    console.error('Error extracting data:', error)
    return NextResponse.json(
      { error: 'Waduh, aku lagi gangguan nih. Coba lagi sebentar ya!' },
      { status: 500 }
    )
  }
}
