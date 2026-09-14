<script setup>
import { computed } from 'vue'
import { data as posts } from '../posts.data.mjs'

const tags = computed(() => {
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
</script>

<template>
  <div class="tag-cloud tag-cloud-page">
    <a
      v-for="tag in tags"
      :key="tag.name"
      class="tag-chip"
      :href="`/posts/?tag=${encodeURIComponent(tag.name)}`"
    >
      #{{ tag.name }} <span>{{ tag.count }}</span>
    </a>
    <p v-if="!tags.length" class="post-empty">还没有标签。</p>
  </div>
</template>
