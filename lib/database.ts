import { neon } from '@neondatabase/serverless'
import { Message } from './messages'
import { clearSettingsCache } from './user-settings'
import { getFromCache, setInCache, invalidateCache } from './caching'

const sql = neon(process.env.DATABASE_URL!)

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  language: string | null
  framework: string | null
  created_at: string
  updated_at: string
}

export interface DbMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  model: string | null
  created_at: string
}

export interface CodeSnippet {
  id: string
  project_id: string
  file_path: string | null
  code: string
  language: string | null
  created_at: string
  updated_at: string
}

// =============================================
// PROJECT OPERATIONS
// =============================================

export async function createProject(
  userId: string,
  name: string,
  description?: string,
  language?: string,
  framework?: string
): Promise<Project | null> {
  clearSettingsCache()
  try {
    const result = await sql`
      INSERT INTO projects (user_id, name, description, language, framework)
      VALUES (${userId}, ${name}, ${description || null}, ${language || null}, ${framework || null})
      RETURNING *
    `
    invalidateCache(new RegExp(`^projects:${userId}:`))
    return result[0] as Project
  } catch (error) {
    console.error('createProject failed:', error)
    return null
  }
}

export async function getProjects(userId: string): Promise<Project[]> {
  const cacheKey = `projects:${userId}`
  const cachedProjects = getFromCache<Project[]>(cacheKey)
  if (cachedProjects) {
    return cachedProjects
  }

  try {
    const result = await sql`
      SELECT * FROM projects
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
    const projects = result as Project[]
    setInCache(cacheKey, projects)
    return projects
  } catch (error) {
    console.error('getProjects failed:', error)
    return []
  }
}

export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  try {
    const result = await sql`
      SELECT * FROM projects
      WHERE id = ${projectId} AND user_id = ${userId}
    `
    return result.length > 0 ? (result[0] as Project) : null
  } catch (error) {
    console.error('getProject failed:', error)
    return null
  }
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'language' | 'framework'>>
): Promise<Project | null> {
  invalidateCache(new RegExp(`^projects:${userId}:`))
  
  try {
    const setClauses: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      setClauses.push(`name = $${values.length + 1}`)
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${values.length + 1}`)
      values.push(updates.description)
    }
    if (updates.language !== undefined) {
      setClauses.push(`language = $${values.length + 1}`)
      values.push(updates.language)
    }
    if (updates.framework !== undefined) {
      setClauses.push(`framework = $${values.length + 1}`)
      values.push(updates.framework)
    }

    if (setClauses.length === 0) {
      return getProject(projectId, userId)
    }

    setClauses.push('updated_at = NOW()')
    values.push(projectId, userId)

    const query = `
      UPDATE projects
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING *
    `

    const result = await sql(query, values)
    return result.length > 0 ? (result[0] as Project) : null
  } catch (error) {
    console.error('updateProject failed:', error)
    return null
  }
}

export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  invalidateCache(new RegExp(`^projects:${userId}:`))
  
  try {
    const result = await sql`
      DELETE FROM projects
      WHERE id = ${projectId} AND user_id = ${userId}
      RETURNING id
    `
    return result.length > 0
  } catch (error) {
    console.error('deleteProject failed:', error)
    return false
  }
}

// =============================================
// MESSAGE OPERATIONS
// =============================================

export async function saveMessage(
  projectId: string,
  message: Message,
): Promise<boolean> {
  try {
    // Update project's updated_at timestamp
    await sql`
      UPDATE projects
      SET updated_at = NOW()
      WHERE id = ${projectId}
    `

    // Save the message
    await sql`
      INSERT INTO messages (project_id, role, content, model)
      VALUES (
        ${projectId}, 
        ${message.role}, 
        ${JSON.stringify(message.content)},
        ${message.model || null}
      )
    `

    invalidateCache(`project-messages:${projectId}`)
    return true
  } catch (error) {
    console.error('saveMessage failed:', error)
    return false
  }
}

export async function getProjectMessages(projectId: string): Promise<Message[]> {
  const cacheKey = `project-messages:${projectId}`
  const cachedMessages = getFromCache<Message[]>(cacheKey)
  if (cachedMessages) {
    return cachedMessages
  }

  try {
    const result = await sql`
      SELECT * FROM messages
      WHERE project_id = ${projectId}
      ORDER BY created_at ASC
    `

    const messages = result.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
      model: msg.model,
    })) as Message[]

    setInCache(cacheKey, messages)
    return messages
  } catch (error) {
    console.error('getProjectMessages failed:', error)
    return []
  }
}

export async function clearProjectMessages(projectId: string): Promise<boolean> {
  invalidateCache(`project-messages:${projectId}`)
  
  try {
    await sql`
      DELETE FROM messages
      WHERE project_id = ${projectId}
    `
    return true
  } catch (error) {
    console.error('clearProjectMessages failed:', error)
    return false
  }
}

// =============================================
// CODE SNIPPET OPERATIONS
// =============================================

export async function createCodeSnippet(
  projectId: string,
  code: string,
  filePath?: string,
  language?: string
): Promise<CodeSnippet | null> {
  try {
    const result = await sql`
      INSERT INTO code_snippets (project_id, file_path, code, language)
      VALUES (${projectId}, ${filePath || null}, ${code}, ${language || null})
      RETURNING *
    `
    return result[0] as CodeSnippet
  } catch (error) {
    console.error('createCodeSnippet failed:', error)
    return null
  }
}

export async function getCodeSnippets(projectId: string): Promise<CodeSnippet[]> {
  try {
    const result = await sql`
      SELECT * FROM code_snippets
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `
    return result as CodeSnippet[]
  } catch (error) {
    console.error('getCodeSnippets failed:', error)
    return []
  }
}

export async function updateCodeSnippet(
  snippetId: string,
  code: string,
  filePath?: string,
  language?: string
): Promise<CodeSnippet | null> {
  try {
    const result = await sql`
      UPDATE code_snippets
      SET code = ${code},
          file_path = ${filePath || null},
          language = ${language || null},
          updated_at = NOW()
      WHERE id = ${snippetId}
      RETURNING *
    `
    return result.length > 0 ? (result[0] as CodeSnippet) : null
  } catch (error) {
    console.error('updateCodeSnippet failed:', error)
    return null
  }
}

export async function deleteCodeSnippet(snippetId: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM code_snippets
      WHERE id = ${snippetId}
      RETURNING id
    `
    return result.length > 0
  } catch (error) {
    console.error('deleteCodeSnippet failed:', error)
    return false
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

export async function generateProjectTitle(firstMessage: string): Promise<string> {
  const words = firstMessage.trim().split(' ').slice(0, 6)
  let title = words.join(' ')
  
  if (firstMessage.split(' ').length > 6) {
    title += '...'
  }
  
  if (!title.trim()) {
    title = 'New Project'
  }
  
  return title
}

export { sql }
