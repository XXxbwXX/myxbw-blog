<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()

const tags = computed(() => {
  const value = frontmatter.value.tags
  if (!value) return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
})

function formatDate(value) {
  return value ? String(value).replaceAll('-', '.') : ''
}
</script>

<template>
  <div class="post-meta">
    <time v-if="frontmatter.date" :datetime="String(frontmatter.date)">
      {{ formatDate(frontmatter.date) }}
    </time>
    <template v-if="frontmatter.readingTime">
      <span class="post-meta-dot">·</span>
      <span>约 {{ frontmatter.readingTime }} 分钟</span>
    </template>
    <template v-if="tags.length">
      <span class="post-meta-dot">·</span>
      <span class="post-meta-tags">
        <a v-for="tag in tags" :key="tag" :href="`/posts/?tag=${encodeURIComponent(tag)}`">
          #{{ tag }}
        </a>
      </span>
    </template>
  </div>
</template>
