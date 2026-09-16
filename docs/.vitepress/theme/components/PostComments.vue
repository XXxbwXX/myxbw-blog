<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

// ① 在 https://giscus.app/zh-CN 安装 giscus App 并选择本仓库
// ② 仓库 Settings → General → Features 勾选 Discussions，并新建一个 Announcements 类型的分类（如「文章评论」）
// ③ 在 giscus.app 页面把 data-category / data-category-id 填到下面两个常量
// 未填 categoryId 之前评论区自动隐藏，不影响页面。
const GISCUS_REPO = 'XXxbwXX/myxbw-blog'
const GISCUS_REPO_ID = 'R_kgDOUZ1zog'
const GISCUS_CATEGORY = 'Announcements'
const GISCUS_CATEGORY_ID = 'DIC_kwDOUZ1zos4DFv6u'

const route = useRoute()
const { frontmatter, isDark } = useData()

const enabled = computed(
  () =>
    Boolean(GISCUS_CATEGORY_ID) &&
    route.path.startsWith('/posts/') &&
    frontmatter.value?.date !== undefined &&
    frontmatter.value?.comments !== false
)

const giscusBox = ref(null)

function mountGiscus() {
  const box = giscusBox.value
  if (!box) return
  box.innerHTML = ''
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  script.setAttribute('data-repo', GISCUS_REPO)
  script.setAttribute('data-repo-id', GISCUS_REPO_ID)
  script.setAttribute('data-category', GISCUS_CATEGORY)
  script.setAttribute('data-category-id', GISCUS_CATEGORY_ID)
  script.setAttribute('data-mapping', 'pathname')
  script.setAttribute('data-strict', '0')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', 'top')
  script.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  script.setAttribute('data-lang', 'zh-CN')
  script.setAttribute('data-loading', 'lazy')
  box.appendChild(script)
}

watch(enabled, (value) => value && nextTick(mountGiscus))
watch(
  () => route.path,
  () => enabled.value && nextTick(mountGiscus)
)
watch(isDark, () => enabled.value && nextTick(mountGiscus))
</script>

<template>
  <div v-if="enabled" class="post-comments">
    <div ref="giscusBox" class="giscus"></div>
  </div>
</template>

<style scoped>
.post-comments {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--blog-border);
}
</style>
