<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import PostFooter from './components/PostFooter.vue'
import PostMeta from './components/PostMeta.vue'

const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <PostMeta v-if="frontmatter.date" />
    </template>
    <template #doc-after>
      <PostFooter v-if="frontmatter.date" />
    </template>
  </DefaultTheme.Layout>
</template>
