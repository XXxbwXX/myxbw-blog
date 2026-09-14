import { createContentLoader } from 'vitepress'

function normalizeTags(tags) {
  if (!tags) return []
  return Array.isArray(tags) ? tags.map(String) : [String(tags)]
}

function normalizeDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().slice(0, 10)
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default createContentLoader('posts/*.md', {
  excerpt: true,
  transform(raw) {
    return raw
      .filter(({ url, frontmatter }) => url !== '/posts/' && frontmatter.draft !== true)
      .map(({ url, frontmatter, excerpt }) => ({
        url,
        title: frontmatter.title || '未命名文章',
        date: normalizeDate(frontmatter.date),
        summary: frontmatter.description || stripHtml(excerpt).slice(0, 120),
        tags: normalizeTags(frontmatter.tags),
        readingTime: frontmatter.readingTime || null
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }
})
