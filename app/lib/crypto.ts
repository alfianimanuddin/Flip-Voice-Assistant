import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const TOKEN_EXPIRY = 5 * 60 * 1000 // 5 minutes

// Get encryption key from environment or generate a default (use proper key in production)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (key) {
    // If key is provided, ensure it's 32 bytes
    return crypto.createHash('sha256').update(key).digest()
  }
  // Fallback for development only - DO NOT use in production
  return crypto.createHash('sha256').update('development-key-change-in-production').digest()
}

interface TokenPayload {
  data: Record<string, unknown>
  exp: number
  iat: number
}

export function encryptPaymentData(data: Record<string, unknown>): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const payload: TokenPayload = {
    data,
    exp: Date.now() + TOKEN_EXPIRY,
    iat: Date.now()
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine IV + AuthTag + Encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ])

  return combined.toString('base64url')
}

export function decryptPaymentData(token: string): Record<string, unknown> | null {
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(token, 'base64url')

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    const payload: TokenPayload = JSON.parse(decrypted)

    // Check expiration
    if (Date.now() > payload.exp) {
      console.warn('Token expired')
      return null
    }

    return payload.data
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}

// Generate HMAC signature for additional validation
export function signData(data: string): string {
  const key = getEncryptionKey()
  return crypto.createHmac('sha256', key).update(data).digest('base64url')
}

export function verifySignature(data: string, signature: string): boolean {
  const expectedSignature = signData(data)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
