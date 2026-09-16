const API_BASE = 'https://api.github.com'

export const OWNER = process.env.GITHUB_OWNER || 'XXxbwXX'
export const PUBLIC_REPO = process.env.GITHUB_PUBLIC_REPO || 'myxbw-blog'
export const DRAFTS_REPO = process.env.GITHUB_DRAFTS_REPO || 'myxbw-blog-drafts'
export const BRANCH = process.env.GITHUB_BRANCH || 'main'

const TOKEN = process.env.GITHUB_TOKEN || ''

export function hasToken() {
  return Boolean(TOKEN)
}

export function repoFor(type) {
  return type === 'draft' ? DRAFTS_REPO : PUBLIC_REPO
}

export function pathFor(type, slug) {
  return type === 'draft' ? `drafts/${slug}.md` : `docs/posts/${slug}.md`
}

function encodePath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function base64Decode(value) {
  return Buffer.from(String(value || '').replace(/\n/g, ''), 'base64').toString('utf8')
}

async function request(path, options = {}) {
  if (!TOKEN) {
    const error = new Error('GITHUB_TOKEN is not configured')
    error.status = 503
    error.code = 'token_missing'
    throw error
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'myxbw-blog-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API ${response.status}`)
    error.status = response.status
    error.code = data?.message || 'github_error'
    throw error
  }

  return data
}

export async function listDirectory(repo, dir) {
  try {
    const data = await request(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(dir)}?ref=${encodeURIComponent(BRANCH)}`
    )
    return Array.isArray(data) ? data : []
  } catch (error) {
    if (error.status === 404) return []
    throw error
  }
}

export async function getFile(repo, path) {
  try {
    const data = await request(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}`
    )
    if (!data || data.type !== 'file' || typeof data.content !== 'string') return null
    return {
      content: base64Decode(data.content),
      sha: data.sha,
      path: data.path,
      name: data.name
    }
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

export async function putFile(repo, path, content, message) {
  const existing = await getFile(repo, path)
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH
  }
  if (existing?.sha) body.sha = existing.sha

  const data = await request(
    `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )

  return {
    sha: data?.content?.sha || null,
    commit: data?.commit?.sha || null
  }
}

export async function getFileMeta(repo, path) {
  try {
    const data = await request(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}`
    )
    if (!data || data.type !== 'file') return null
    return {
      sha: data.sha,
      path: data.path,
      name: data.name,
      size: data.size
    }
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

export async function putBinaryFile(repo, path, base64, message) {
  const existing = await getFileMeta(repo, path)
  const body = {
    message,
    content: base64,
    branch: BRANCH
  }
  if (existing?.sha) body.sha = existing.sha

  const data = await request(
    `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )

  return {
    sha: data?.content?.sha || null,
    commit: data?.commit?.sha || null
  }
}

export async function deleteFile(repo, path, message) {
  const existing = await getFile(repo, path)
  if (!existing) return { deleted: false }

  await request(
    `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha: existing.sha, branch: BRANCH })
    }
  )

  return { deleted: true }
}
