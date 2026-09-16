// 生成 RSS：在 vitepress build 之后运行，把 feed.xml 写进输出目录。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import matter from 'gray-matter'

const SITE = 'https://blog.myxbw.cn'
const POSTS_DIR = 'docs/posts'
const OUT = 'docs/.vitepress/dist/feed.xml'
const LIMIT = 20

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

const files = readdirSync(POSTS_DIR).filter((name) => name.endsWith('.md') && name !== 'index.md')

const items = files
  .map((name) => {
    const slug = name.replace(/\.md$/, '')
    const parsed = matter(readFileSync(`${POSTS_DIR}/${name}`, 'utf8'))
    const date = String(parsed.data?.date || '').slice(0, 10)
    return {
      slug,
      title: String(parsed.data?.title || slug),
      description: String(parsed.data?.description || ''),
      date
    }
  })
  .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, LIMIT)

const buildDate = new Date().toUTCString()

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>myxbw 的博客</title>
<link>${SITE}</link>
<description>记录 Web 安全、Linux、数据挖掘，以及一个普通学生的折腾过程。</description>
<language>zh-CN</language>
<lastBuildDate>${buildDate}</lastBuildDate>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (item) => `<item>
<title>${escapeXml(item.title)}</title>
<link>${SITE}/posts/${item.slug}</link>
<guid isPermaLink="true">${SITE}/posts/${item.slug}</guid>
<pubDate>${new Date(item.date).toUTCString()}</pubDate>
<description>${escapeXml(item.description)}</description>
</item>`
  )
  .join('\n')}
</channel>
</rss>
`

writeFileSync(OUT, rss)
console.log(`feed.xml written with ${items.length} items -> ${OUT}`)
