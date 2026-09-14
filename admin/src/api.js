const ADMIN_HEADER = {
  'X-Blog-Admin': 'myxbw-blog-admin'
}

async function request(method, payload) {
  const response = await fetch('/api', {
    method,
    credentials: 'same-origin',
    headers: {
      ...ADMIN_HEADER,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
    },
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`)
    error.status = response.status
    error.code = data.error
    throw error
  }
  return data
}

export const adminApi = {
  health: () => request('GET'),
  list: (type) => request('POST', { action: 'list', type }),
  get: (type, slug) => request('POST', { action: 'get', type, slug }),
  save: (payload) => request('POST', { action: 'save', ...payload }),
  publish: (slug) => request('POST', { action: 'publish', slug }),
  remove: (type, slug) => request('POST', { action: 'delete', type, slug })
}

export function errorText(error) {
  const map = {
    token_missing: '后台还没配置 GITHUB_TOKEN，请先在 Vercel 环境变量里补上。',
    forbidden: '请求来源校验失败，请刷新页面重试。',
    invalid_slug: 'slug 只能是小写字母、数字和连字符。',
    invalid_title: '标题不能为空，且不能超过 120 个字符。',
    invalid_date: '日期格式应为 YYYY-MM-DD。',
    invalid_description: '摘要不能超过 240 个字符。',
    content_too_large: '正文太长了，单篇限制 200KB。',
    too_many_tags: '标签最多 10 个。',
    invalid_tag: '标签只能包含中英文、数字、空格、点、下划线和连字符，单个不超过 24 字。',
    body_too_large: '提交内容过大，请拆分为更短的文章。',
    too_many_requests: '操作太频繁，请稍后再试。',
    not_found: '没有找到这篇文章。',
    conflict: '文件在别处被改过，请刷新后重试。',
    github_auth_error: 'GitHub token 权限不足或已过期。',
    github_rate_limited: 'GitHub API 暂时限流，请稍后再试。',
    server_error: '服务器出错，请查看 Vercel 日志。'
  }
  return map[error?.code] || map[error?.message] || '操作失败，请稍后再试。'
}
