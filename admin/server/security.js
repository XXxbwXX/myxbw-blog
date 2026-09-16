const BODY_LIMIT = 4.5 * 1024 * 1024
const CONTENT_LIMIT = 200 * 1024
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TAG_PATTERN = /^[\p{L}\p{N} _.-]{1,24}$/u
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'])
const FILE_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.zip'])
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

const defaultOrigins = [
  'https://write.myxbw.cn',
  'https://myxbw-blog-admin.vercel.app',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]

function allowedOrigins() {
  const fromEnv = (process.env.ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set([...defaultOrigins, ...fromEnv])]
}

function isPreviewOrigin(origin) {
  return /^https:\/\/myxbw-blog-admin(?:-[a-z0-9]+)+(?:-xbwteam)?\.vercel\.app$/i.test(origin)
}

export function isAllowedOrigin(origin) {
  if (!origin) return false
  if (allowedOrigins().includes(origin)) return true
  return isPreviewOrigin(origin)
}

export function isAllowedRequest(req) {
  const origin = req.headers.origin || ''
  if (origin && !isAllowedOrigin(origin)) return false

  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false

  if (req.method === 'OPTIONS') return true
  return req.headers['x-blog-admin'] === 'myxbw-blog-admin'
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > BODY_LIMIT) throw new Error('body_too_large')
    return JSON.parse(req.body)
  }

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new Error('body_too_large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  return JSON.parse(text)
}

export function validateSlug(value) {
  const slug = String(value || '').trim()
  if (!SLUG_PATTERN.test(slug)) throw new Error('invalid_slug')
  if (slug.includes('..') || slug.includes('/') || slug.includes(String.fromCharCode(92))) throw new Error('invalid_slug')
  return slug
}

export function validatePayload(payload = {}) {
  const type = payload.type === 'draft' ? 'draft' : 'post'
  const slug = validateSlug(payload.slug)
  const title = String(payload.title || '').trim()
  const date = String(payload.date || '').trim()
  const description = String(payload.description || '').trim()
  const body = String(payload.body || '')
  const rawTags = Array.isArray(payload.tags) ? payload.tags : []
  const tags = rawTags.map((tag) => String(tag).trim()).filter(Boolean)

  if (!title || title.length > 120) throw new Error('invalid_title')
  if (!DATE_PATTERN.test(date)) throw new Error('invalid_date')
  if (description.length > 240) throw new Error('invalid_description')
  if (body.length > CONTENT_LIMIT) throw new Error('content_too_large')
  if (tags.length > 10) throw new Error('too_many_tags')
  if (tags.some((tag) => !TAG_PATTERN.test(tag))) throw new Error('invalid_tag')

  let readingTime = Number(payload.readingTime)
  if (!Number.isFinite(readingTime) || readingTime < 1) {
    readingTime = Math.max(1, Math.round(body.length / 500))
  }
  readingTime = Math.min(120, Math.round(readingTime))

  return { type, slug, title, date, description, tags, readingTime, body }
}

function hasPrefix(buffer, bytes) {
  if (buffer.length < bytes.length) return false
  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[index] !== bytes[index]) return false
  }
  return true
}

function isValidImage(buffer, extension) {
  if (extension === '.png') {
    return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return hasPrefix(buffer, [0xff, 0xd8, 0xff])
  }
  if (extension === '.gif') {
    return hasPrefix(buffer, [0x47, 0x49, 0x46, 0x38])
  }
  if (extension === '.webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  }
  if (extension === '.avif') {
    if (buffer.length < 16 || buffer.subarray(4, 8).toString('latin1') !== 'ftyp') return false
    const brand = buffer.subarray(8, 12).toString('latin1')
    return ['avif', 'avis', 'av01', 'mif1'].includes(brand)
  }
  return false
}

function isValidZip(buffer) {
  return hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    hasPrefix(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    hasPrefix(buffer, [0x50, 0x4b, 0x07, 0x08])
}

export function sanitizeUploadName(filename, extension) {
  const base = String(filename || '')
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 60)
  return `${base || 'file'}${extension}`
}

export function validateUploadPayload(payload = {}) {
  const filename = String(payload.filename || '').trim()
  if (!filename || filename.length > 160) throw new Error('invalid_filename')
  if (/[\/\\\u0000]/.test(filename) || filename.includes('..')) throw new Error('invalid_filename')

  const match = filename.match(/\.([A-Za-z0-9]+)$/)
  if (!match) throw new Error('invalid_file_type')
  const extension = `.${match[1].toLowerCase()}`
  const mime = String(payload.mime || '').toLowerCase()

  const dataBase64 = String(payload.dataBase64 || '').replace(/\s+/g, '')
  if (!dataBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
    throw new Error('invalid_file_data')
  }
  if (dataBase64.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) {
    throw new Error('file_too_large')
  }
  const buffer = Buffer.from(dataBase64, 'base64')
  if (!buffer.length) throw new Error('invalid_file_data')
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('file_too_large')

  let kind = ''
  if (IMAGE_EXTENSIONS.has(extension)) {
    kind = 'image'
    if (mime && !mime.startsWith('image/')) throw new Error('invalid_file_type')
    if (!isValidImage(buffer, extension)) throw new Error('invalid_file_data')
  } else if (FILE_EXTENSIONS.has(extension)) {
    kind = 'file'
    if (extension === '.pdf' && !hasPrefix(buffer, Buffer.from('%PDF-'))) {
      throw new Error('invalid_file_data')
    }
    if (extension === '.zip' && !isValidZip(buffer)) throw new Error('invalid_file_data')
    if ((extension === '.txt' || extension === '.md') && buffer.includes(0)) {
      throw new Error('invalid_file_data')
    }
  } else {
    throw new Error('invalid_file_type')
  }

  return { filename, extension, mime, kind, buffer, size: buffer.length }
}

export function validateMarkdownPayload(payload = {}) {
  const markdown = String(payload.markdown || '')
  if (Buffer.byteLength(markdown, 'utf8') > CONTENT_LIMIT) throw new Error('content_too_large')
  return { markdown }
}

export function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.end(JSON.stringify(data))
}

const buckets = new Map()

export function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((time) => now - time < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 1000) {
    for (const [bucketKey, times] of buckets) {
      if (!times.length || now - times[times.length - 1] > windowMs) buckets.delete(bucketKey)
    }
  }
  return true
}
