import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const sql = neon(process.env.DATABASE_URL!)

export interface User {
  id: string
  email: string
  name: string | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  session_token: string
  expires_at: string
}

// Generate secure session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Create session
export async function createSession(userId: string): Promise<string> {
  const sessionToken = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

  await sql`
    INSERT INTO sessions (user_id, session_token, expires_at)
    VALUES (${userId}, ${sessionToken}, ${expiresAt.toISOString()})
  `

  return sessionToken
}

// Get session from token
export async function getSession(sessionToken: string): Promise<{ user: User; session: Session } | null> {
  const result = await sql`
    SELECT 
      s.id as session_id,
      s.user_id,
      s.session_token,
      s.expires_at,
      u.id,
      u.email,
      u.name,
      u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.session_token = ${sessionToken}
    AND s.expires_at > NOW()
  `

  if (result.length === 0) {
    return null
  }

  const row = result[0]
  return {
    session: {
      id: row.session_id,
      user_id: row.user_id,
      session_token: row.session_token,
      expires_at: row.expires_at,
    },
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: row.created_at,
    },
  }
}

// Get current user from cookies
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session_token')?.value

  if (!sessionToken) {
    return null
  }

  const sessionData = await getSession(sessionToken)
  return sessionData?.user || null
}

// Delete session (logout)
export async function deleteSession(sessionToken: string): Promise<void> {
  await sql`
    DELETE FROM sessions
    WHERE session_token = ${sessionToken}
  `
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  await sql`
    DELETE FROM sessions
    WHERE expires_at < NOW()
  `
}

// Sign up new user
export async function signUp(email: string, password: string, name?: string): Promise<User> {
  // Check if user exists
  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email}
  `

  if (existingUser.length > 0) {
    throw new Error('User already exists')
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create user
  const result = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name || null})
    RETURNING id, email, name, created_at
  `

  return result[0] as User
}

// Sign in user
export async function signIn(email: string, password: string): Promise<{ user: User; sessionToken: string }> {
  // Get user
  const result = await sql`
    SELECT id, email, name, password_hash, created_at
    FROM users
    WHERE email = ${email}
  `

  if (result.length === 0) {
    throw new Error('Invalid credentials')
  }

  const user = result[0]

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    throw new Error('Invalid credentials')
  }

  // Create session
  const sessionToken = await createSession(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
    sessionToken,
  }
}
