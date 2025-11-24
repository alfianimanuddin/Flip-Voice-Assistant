// Client-side transaction parser for instant extraction

interface ParseResult {
  type?: string
  amount?: string
  bank?: string
  accountNumber?: string
  ewallet?: string
  phoneNumber?: string
  provider?: string
  grams?: string
  meterNumber?: string
  incomplete?: boolean
  partialData?: Record<string, string>
  missingFields?: string[]
  message?: string
}

// Indonesian number words
const numberWords: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, seratus: 100, seribu: 1000, sejuta: 1000000
}

// Banks list
const banks = [
  'BCA', 'MANDIRI', 'BNI', 'BRI', 'CIMB', 'CIMB NIAGA', 'PERMATA', 'DANAMON',
  'MEGA', 'BTN', 'BTPN', 'JENIUS', 'OCBC', 'OCBC NISP', 'HSBC', 'MAYBANK',
  'UOB', 'PANIN', 'BUKOPIN', 'SINARMAS', 'BSI', 'MUAMALAT', 'COMMONWEALTH',
  'CITIBANK', 'STANDARD CHARTERED', 'DBS', 'BANK JAGO', 'SEABANK',
  'NEO COMMERCE', 'NOBU', 'ALLO BANK', 'SUPERBANK', 'LINE BANK',
  'MOTION BANKING', 'BNC', 'DIGIBANK'
]

// E-wallets
const ewallets = [
  'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'ISAKU', 'SAKUKU',
  'DOKU', 'PAYPRO', 'KREDIVO', 'AKULAKU', 'BLUEPAY', 'TRUEMONEY',
  'YUKK', 'ASTRAPAY', 'GOPAYLATER'
]

// Provider prefixes
const providerPrefixes: Record<string, string[]> = {
  TELKOMSEL: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'],
  INDOSAT: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'],
  XL: ['0817', '0818', '0819', '0859', '0877', '0878'],
  AXIS: ['0831', '0832', '0833', '0838'],
  TRI: ['0895', '0896', '0897', '0898', '0899'],
  SMARTFREN: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889']
}

function detectProvider(phone: string): string | null {
  const prefix = phone.substring(0, 4)
  for (const [provider, prefixes] of Object.entries(providerPrefixes)) {
    if (prefixes.includes(prefix)) return provider
  }
  return null
}

function parseAmount(text: string): string | null {
  // Handle formatted numbers: 1.230.500, 520.200, 100,000
  let amount = text.replace(/\./g, '').replace(/,/g, '')

  // Handle ribu/rb/k
  const ribuMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)/i)
  if (ribuMatch) {
    const num = parseFloat(ribuMatch[1].replace(',', '.'))
    return String(Math.round(num * 1000))
  }

  // Handle juta/jt
  const jutaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)/i)
  if (jutaMatch) {
    const num = parseFloat(jutaMatch[1].replace(',', '.'))
    return String(Math.round(num * 1000000))
  }

  // Handle plain numbers
  const plainMatch = text.match(/\b(\d{4,})\b/)
  if (plainMatch) {
    return plainMatch[1]
  }

  // Handle Indonesian word numbers (basic patterns)
  const wordPatterns = [
    { pattern: /seratus\s*ribu/i, value: 100000 },
    { pattern: /dua\s*ratus\s*ribu/i, value: 200000 },
    { pattern: /tiga\s*ratus\s*ribu/i, value: 300000 },
    { pattern: /empat\s*ratus\s*ribu/i, value: 400000 },
    { pattern: /lima\s*ratus\s*ribu/i, value: 500000 },
    { pattern: /enam\s*ratus\s*ribu/i, value: 600000 },
    { pattern: /tujuh\s*ratus\s*ribu/i, value: 700000 },
    { pattern: /delapan\s*ratus\s*ribu/i, value: 800000 },
    { pattern: /sembilan\s*ratus\s*ribu/i, value: 900000 },
    { pattern: /satu\s*juta/i, value: 1000000 },
    { pattern: /dua\s*juta/i, value: 2000000 },
    { pattern: /lima\s*juta/i, value: 5000000 },
    { pattern: /sepuluh\s*ribu/i, value: 10000 },
    { pattern: /dua\s*puluh\s*ribu/i, value: 20000 },
    { pattern: /lima\s*puluh\s*ribu/i, value: 50000 },
  ]

  for (const { pattern, value } of wordPatterns) {
    if (pattern.test(text)) {
      return String(value)
    }
  }

  return null
}

function extractPhoneNumber(text: string): string | null {
  // Match phone numbers (08xxx or without leading 0)
  const match = text.match(/\b(0\d{9,12}|\d{9,12})\b/)
  if (match) {
    let phone = match[1]
    if (!phone.startsWith('0')) phone = '0' + phone
    return phone
  }
  return null
}

function extractAccountNumber(text: string): string | null {
  // Match account numbers (typically 10+ digits)
  const match = text.match(/\b(\d{10,16})\b/)
  return match ? match[1] : null
}

function extractMeterNumber(text: string): string | null {
  // PLN meter numbers are typically 11-12 digits
  const match = text.match(/\b(\d{11,12})\b/)
  return match ? match[1] : null
}

function findBank(text: string): string | null {
  const upper = text.toUpperCase()
  for (const bank of banks) {
    if (upper.includes(bank)) return bank
  }
  return null
}

function findEwallet(text: string): string | null {
  const upper = text.toUpperCase()
  for (const wallet of ewallets) {
    if (upper.includes(wallet)) return wallet
  }
  // Common variations
  if (upper.includes('GO PAY') || upper.includes('GO-PAY')) return 'GOPAY'
  if (upper.includes('SHOPEE PAY')) return 'SHOPEEPAY'
  if (upper.includes('LINK AJA')) return 'LINKAJA'
  return null
}

export function parseTransaction(text: string): ParseResult | null {
  const lower = text.toLowerCase()

  // Detect transaction type
  let type: string | null = null

  if (lower.includes('transfer') || lower.includes('kirim')) {
    type = 'transfer'
  } else if (lower.includes('top up') || lower.includes('topup') || lower.includes('isi') && (lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('shopeepay'))) {
    type = 'ewallet'
  } else if (lower.includes('pulsa') || lower.includes('paket data')) {
    type = 'pulsa'
  } else if (lower.includes('emas') || lower.includes('gold')) {
    type = 'gold'
  } else if (lower.includes('token') || lower.includes('listrik') || lower.includes('pln')) {
    type = 'token'
  }

  if (!type) return null // Can't determine type, use LLM

  const amount = parseAmount(text)
  const phone = extractPhoneNumber(text)
  const account = extractAccountNumber(text)
  const bank = findBank(text)
  const ewallet = findEwallet(text)
  const meter = extractMeterNumber(text)

  // Build result based on type
  if (type === 'transfer') {
    if (amount && bank && account) {
      return { type, amount, bank, accountNumber: account }
    }
    // Incomplete
    const partialData: Record<string, string> = {}
    const missingFields: string[] = []

    if (amount) partialData.amount = amount
    else missingFields.push('amount')

    if (bank) partialData.bank = bank
    else missingFields.push('bank')

    if (account) partialData.accountNumber = account
    else missingFields.push('accountNumber')

    if (missingFields.length > 0 && Object.keys(partialData).length > 0) {
      let message = ''
      if (missingFields.includes('amount')) message = 'Nominalnya berapa?'
      else if (missingFields.includes('bank') && missingFields.includes('accountNumber')) message = 'Ke bank apa dan nomor rekening berapa?'
      else if (missingFields.includes('bank')) message = 'Ke bank apa?'
      else if (missingFields.includes('accountNumber')) message = 'Nomor rekeningnya berapa?'

      return { incomplete: true, type, partialData, missingFields, message }
    }
  }

  if (type === 'ewallet') {
    const wallet = ewallet || findEwallet(text)
    if (amount && wallet && phone) {
      return { type, amount, ewallet: wallet, phoneNumber: phone }
    }
    // Incomplete
    const partialData: Record<string, string> = {}
    const missingFields: string[] = []

    if (amount) partialData.amount = amount
    else missingFields.push('amount')

    if (wallet) partialData.ewallet = wallet
    else missingFields.push('ewallet')

    if (phone) partialData.phoneNumber = phone
    else missingFields.push('phoneNumber')

    if (missingFields.length > 0 && Object.keys(partialData).length > 0) {
      let message = ''
      if (missingFields.length === 2 && missingFields.includes('amount') && missingFields.includes('phoneNumber')) {
        message = 'Nominal berapa dan ke nomor HP berapa?'
      } else if (missingFields.includes('amount')) message = 'Nominal berapa?'
      else if (missingFields.includes('phoneNumber')) message = 'Ke nomor HP berapa?'
      else if (missingFields.includes('ewallet')) message = 'E-wallet apa?'

      return { incomplete: true, type, partialData, missingFields, message }
    }
  }

  if (type === 'pulsa') {
    if (amount && phone) {
      const provider = detectProvider(phone) || 'TELKOMSEL'
      return { type, amount, provider, phoneNumber: phone }
    }
    // Incomplete
    const partialData: Record<string, string> = {}
    const missingFields: string[] = []

    if (amount) partialData.amount = amount
    else missingFields.push('amount')

    if (phone) {
      partialData.phoneNumber = phone
      const provider = detectProvider(phone)
      if (provider) partialData.provider = provider
    } else {
      missingFields.push('phoneNumber')
    }

    if (missingFields.length > 0 && Object.keys(partialData).length > 0) {
      let message = ''
      if (missingFields.includes('phoneNumber')) message = 'Ke nomor HP berapa?'
      else if (missingFields.includes('amount')) message = 'Nominal berapa?'

      return { incomplete: true, type, partialData, missingFields, message }
    }
  }

  if (type === 'token') {
    if (amount && meter) {
      return { type, amount, meterNumber: meter }
    }
    // Incomplete
    const partialData: Record<string, string> = {}
    const missingFields: string[] = []

    if (amount) partialData.amount = amount
    else missingFields.push('amount')

    if (meter) partialData.meterNumber = meter
    else missingFields.push('meterNumber')

    if (missingFields.length > 0 && Object.keys(partialData).length > 0) {
      let message = ''
      if (missingFields.includes('meterNumber')) message = 'Nomor meter PLN-nya berapa?'
      else if (missingFields.includes('amount')) message = 'Nominal berapa?'

      return { incomplete: true, type, partialData, missingFields, message }
    }
  }

  if (type === 'gold') {
    if (amount) {
      const grams = String(Math.round(parseInt(amount) / 1000000))
      return { type, amount, grams }
    }
  }

  return null // Couldn't parse, use LLM
}
