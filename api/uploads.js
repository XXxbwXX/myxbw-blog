import { list } from '@vercel/blob'

// 兼容层：/uploads/... → Vercel Blob。
// 仓库里已提交的 uploads 文件由静态文件系统直接命中（Vercel rewrites 在文件系统检查之后生效），
// 只有文件系统上不存在的路径才会走到这里，因此旧链接完全不受影响。
const PATH_PATTERN = /^docs\/public\/uploads\/(\d{4})\/(\d{2})\/([A-Za-z0-9][A-Za-z0-9._-]*)$/

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(body)
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'method_not_allowed')
  }

  let requested = String(req.query?.path || '')
  try {
    requested = decodeURIComponent(requested)
  } catch {
    return send(res, 404, 'not_found')
  }

  const path = `docs/public/uploads/${requested.replace(/^\/+/, '')}`
  if (!PATH_PATTERN.test(path) || path.includes('..')) {
    return send(res, 404, 'not_found')
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return send(res, 404, 'not_found')
  }

  try {
    const result = await list({ prefix: path, limit: 1 })
    const blob = (result.blobs || []).find((item) => item.pathname === path)
    if (!blob) return send(res, 404, 'not_found')

    res.statusCode = 302
    res.setHeader('Location', blob.url)
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.end()
  } catch (error) {
    console.error('[uploads-proxy]', error?.message || error)
    send(res, 502, 'upstream_error')
  }
}
