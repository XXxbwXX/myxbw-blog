<script setup>
import { computed } from 'vue'
import { data as posts } from '../posts.data.mjs'
import ProfileCard from './ProfileCard.vue'

const recentPosts = computed(() => posts.slice(0, 4))

const tagCounts = computed(() => {
  const counts = new Map()
  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
})

const topTags = computed(() => tagCounts.value.slice(0, 12))

const siteLinks = [
  { name: 'Web 基础', url: 'https://web-basics.myxbw.cn/', desc: '五阶段 Web 入门' },
  { name: 'Linux 命令行', url: 'https://linux.myxbw.cn/', desc: '文件、Shell、网络' },
  { name: '数据库原理', url: 'https://mysql.myxbw.cn/', desc: 'SQL 与范式设计' },
  { name: '数据挖掘', url: 'https://dm.myxbw.cn/', desc: '从清洗到实战' },
  { name: 'CTF', url: 'https://ctf.myxbw.cn/', desc: '杂项 / Web / Pwn' },
  { name: '知识库', url: 'https://www.myxbw.cn/', desc: '漏洞文章库' }
]

function formatDate(value) {
  return value ? String(value).replaceAll('-', '.') : ''
}
</script>

<template>
  <div class="blog-home">
    <ProfileCard />

    <section class="blog-section">
      <div class="blog-section-head">
        <h2>最近文章</h2>
        <a href="/posts/">全部文章 →</a>
      </div>
      <div class="post-grid">
        <a v-for="post in recentPosts" :key="post.url" class="post-card" :href="post.url">
          <time class="post-card-date">{{ formatDate(post.date) }}</time>
          <h3>{{ post.title }}</h3>
          <p>{{ post.summary }}</p>
          <div class="post-card-tags">
            <span v-for="tag in post.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
          </div>
        </a>
      </div>
    </section>

    <section class="blog-section">
      <div class="blog-section-head">
        <h2>按标签浏览</h2>
        <a href="/tags">全部标签 →</a>
      </div>
      <div class="tag-cloud">
        <a
          v-for="tag in topTags"
          :key="tag.name"
          class="tag-chip"
          :href="`/posts/?tag=${encodeURIComponent(tag.name)}`"
        >
          #{{ tag.name }} <span>{{ tag.count }}</span>
        </a>
      </div>
    </section>

    <section class="blog-section">
      <div class="blog-section-head">
        <h2>常去的地方</h2>
        <a href="https://learn.myxbw.cn/" target="_blank" rel="noreferrer">全站导航 →</a>
      </div>
      <div class="site-link-grid">
        <a
          v-for="site in siteLinks"
          :key="site.url"
          class="site-link-card"
          :href="site.url"
          target="_blank"
          rel="noreferrer"
        >
          <strong>{{ site.name }}</strong>
          <span>{{ site.desc }}</span>
        </a>
      </div>
    </section>
  </div>
</template>
