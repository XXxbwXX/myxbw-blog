<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { data as posts } from '../posts.data.mjs'

const keyword = ref('')
const activeTag = ref('')

function syncFromUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  activeTag.value = params.get('tag') || ''
}

onMounted(() => {
  syncFromUrl()
  window.addEventListener('popstate', syncFromUrl)
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncFromUrl)
})

const filteredPosts = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return posts.filter((post) => {
    const matchesTag = !activeTag.value || post.tags.includes(activeTag.value)
    const haystack = [post.title, post.summary, post.tags.join(' ')].join(' ').toLowerCase()
    return matchesTag && (!query || haystack.includes(query))
  })
})

const groups = computed(() => {
  const byYear = new Map()
  for (const post of filteredPosts.value) {
    const year = post.date ? post.date.slice(0, 4) : '未标注'
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(post)
  }
  return [...byYear.entries()].map(([year, items]) => ({ year, items }))
})

function formatDate(value) {
  return value ? String(value).replaceAll('-', '.') : ''
}

function selectTag(tag) {
  activeTag.value = tag
  const url = new URL(window.location.href)
  url.searchParams.set('tag', tag)
  window.history.pushState({}, '', url)
}

function clearTag() {
  activeTag.value = ''
  const url = new URL(window.location.href)
  url.searchParams.delete('tag')
  window.history.pushState({}, '', url)
}
</script>

<template>
  <div class="post-list">
    <div class="post-toolbar">
      <label class="post-search">
        <span class="sr-only">搜索文章</span>
        <input v-model="keyword" type="search" placeholder="搜索标题、摘要或标签…" />
      </label>
      <div v-if="activeTag" class="post-filter">
        <span>标签：#{{ activeTag }}</span>
        <button type="button" @click="clearTag">清除</button>
      </div>
    </div>
    <p class="post-count">共 {{ filteredPosts.length }} 篇文章</p>

    <section v-for="group in groups" :key="group.year" class="post-year">
      <h2>{{ group.year }}</h2>
      <article v-for="post in group.items" :key="post.url" class="post-row">
        <time class="post-row-date">{{ formatDate(post.date) }}</time>
        <div class="post-row-main">
          <h3><a :href="post.url">{{ post.title }}</a></h3>
          <p>{{ post.summary }}</p>
          <div class="post-row-tags">
            <button
              v-for="tag in post.tags"
              :key="tag"
              type="button"
              class="tag-chip small"
              @click="selectTag(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <p v-if="!filteredPosts.length" class="post-empty">没有找到匹配的文章，换个关键词试试。</p>
  </div>
</template>
