<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { adminApi, errorText } from './api.js'

marked.setOptions({ gfm: true, breaks: true })

const loading = ref(true)
const health = ref(null)
const error = ref('')
const notice = ref('')
const posts = ref([])
const drafts = ref([])
const tab = ref('post')
const search = ref('')
const active = ref(null)
const saving = ref(false)
const publishing = ref(false)
const deleting = ref(false)
const preview = ref(false)
const sidebarOpen = ref(false)
const baseline = ref('')
const bodyInput = ref(null)
const mediaInput = ref(null)
const markdownInput = ref(null)
const uploading = ref(false)
const importing = ref(false)

const BLOG_ORIGIN = 'https://blog.myxbw.cn'
const UPLOAD_LIMIT = 3 * 1024 * 1024

const currentList = computed(() => (tab.value === 'draft' ? drafts.value : posts.value))
const filteredList = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return currentList.value
  return currentList.value.filter((item) =>
    [item.title, item.slug, (item.tags || []).join(' ')].join(' ').toLowerCase().includes(query)
  )
})
const tagsArray = computed(() =>
  (active.value?.tagsText || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
)
const previewHtml = computed(() => {
  if (!active.value?.body) return ''
  const raw = marked.parse(active.value.body)
  const withUploadOrigin = raw.replace(/(src|href)="\/uploads\//g, `$1="${BLOG_ORIGIN}/uploads/`)
  return DOMPurify.sanitize(withUploadOrigin)
})
const isDirty = computed(() => (active.value ? serialize(active.value) !== baseline.value : false))
const statusLabel = computed(() => (active.value?.type === 'draft' ? '草稿' : '已发布'))

function serialize(value) {
  return JSON.stringify({
    slug: value.slug || '',
    title: value.title || '',
    date: value.date || '',
    description: value.description || '',
    tagsText: value.tagsText || '',
    readingTime: value.readingTime || '',
    body: value.body || ''
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dateValue(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function randomSlug() {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${today().replace(/-/g, '')}-${suffix}`
}

function emptyForm(overrides = {}) {
  return {
    slug: randomSlug(),
    type: 'draft',
    isNew: true,
    title: '',
    date: today(),
    description: '',
    tagsText: '',
    readingTime: '',
    body: '',
    ...overrides
  }
}

function setActive(value) {
  active.value = value
  baseline.value = serialize(value)
  error.value = ''
  notice.value = ''
}

function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  active.value = null
  baseline.value = ''
}

function newPost() {
  tab.value = 'draft'
  setActive(emptyForm())
  sidebarOpen.value = false
}

function formatDate(value) {
  return value ? String(value).replaceAll('-', '.') : ''
}

function resetMessages() {
  error.value = ''
  notice.value = ''
}

async function run(action, successText = '') {
  try {
    resetMessages()
    const result = await action()
    if (successText) notice.value = successText
    return result
  } catch (err) {
    error.value = errorText(err)
    throw err
  }
}

async function loadAll() {
  loading.value = true
  try {
    const [postData, draftData, healthData] = await Promise.all([
      adminApi.list('post'),
      adminApi.list('draft'),
      adminApi.health()
    ])
    posts.value = postData.items || []
    drafts.value = draftData.items || []
    health.value = healthData
  } catch (err) {
    error.value = errorText(err)
  } finally {
    loading.value = false
  }
}

async function openItem(item) {
  try {
    resetMessages()
    const result = await adminApi.get(tab.value, item.slug)
    setActive({
      ...result.item,
      tagsText: (result.item.tags || []).join(', '),
      type: tab.value,
      isNew: false
    })
    sidebarOpen.value = false
  } catch (err) {
    error.value = errorText(err)
  }
}

function validateForm() {
  if (!active.value) return false
  if (!active.value.title.trim()) {
    error.value = '标题不能为空。'
    return false
  }
  if (!active.value.slug.trim()) {
    error.value = 'slug 不能为空。'
    return false
  }
  if (tagsArray.value.length > 10) {
    error.value = '标签最多 10 个。'
    return false
  }
  if (active.value.description.length > 240) {
    error.value = '摘要不能超过 240 个字符。'
    return false
  }
  if ((active.value.body || '').length > 200 * 1024) {
    error.value = '正文不能超过 200KB。'
    return false
  }
  return true
}

function payloadFor(type) {
  return {
    slug: active.value.slug,
    type,
    title: active.value.title,
    date: active.value.date || today(),
    description: active.value.description,
    tags: tagsArray.value,
    readingTime: active.value.readingTime || undefined,
    body: active.value.body
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsText(file, 'utf-8')
  })
}

function insertAtCursor(text) {
  if (!active.value) return
  const body = active.value.body || ''
  const element = bodyInput.value
  if (!element) {
    active.value.body = `${body}${body ? '\n' : ''}${text}\n`
    return
  }
  const start = element.selectionStart ?? body.length
  const end = element.selectionEnd ?? start
  const before = body.slice(0, start)
  const after = body.slice(end)
  const prefix = before && !before.endsWith('\n') ? '\n' : ''
  const suffix = after && !after.startsWith('\n') ? '\n' : ''
  const insertion = `${prefix}${text}${suffix}`
  active.value.body = `${before}${insertion}${after}`
  nextTick(() => {
    element.focus()
    const position = start + insertion.length
    element.setSelectionRange(position, position)
  })
}

function slugFromFilename(name) {
  const slug = String(name || '')
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return /^[a-z0-9][a-z0-9-]{1,80}$/.test(slug) ? slug : randomSlug()
}

async function importMarkdownFile(file) {
  importing.value = true
  try {
    const text = await readFileAsText(file)
    const result = await run(() => adminApi.parseMarkdown({ markdown: text }))
    const data = result.data || {}
    active.value.title = String(data.title || file.name.replace(/\.md$/i, '') || '未命名文章')
    active.value.date = dateValue(data.date) || today()
    active.value.description = String(data.description || '')
    active.value.tagsText = Array.isArray(data.tags)
      ? data.tags.map(String).join(', ')
      : String(data.tags || '')
    active.value.readingTime = data.readingTime ? String(data.readingTime) : ''
    active.value.body = String(result.content || '').replace(/^\s*\n/, '')
    if (active.value.isNew) active.value.slug = slugFromFilename(file.name)
    notice.value = '已导入本地 Markdown，检查后保存为草稿。'
  } catch (err) {
    if (err?.message === 'read_failed') error.value = '读取文件失败，请重试。'
  } finally {
    importing.value = false
  }
}

async function onFilePicked(event, mode) {
  const input = event.target
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file || !active.value) return
  if (mode === 'markdown') {
    if (isDirty.value && !window.confirm('当前内容还没保存，导入会覆盖，继续？')) return
    await importMarkdownFile(file)
    return
  }
  if (file.size > UPLOAD_LIMIT) {
    error.value = '文件太大了，单个文件不能超过 3MB。'
    return
  }
  uploading.value = true
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const dataBase64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
    const result = await run(() => adminApi.upload({
      filename: file.name,
      mime: file.type || '',
      dataBase64
    }))
    const label = String(file.name || 'file').replace(/\.[^.]+$/, '').replace(/[\[\]]/g, '-') || 'file'
    const linkLabel = String(file.name || 'file').replace(/[\[\]()]/g, '-')
    const markdown = result.kind === 'image' ? `![${label}](${result.url})` : `[${linkLabel}](${result.url})`
    insertAtCursor(markdown)
    notice.value = `已上传并插入：${result.name}`
  } catch (err) {
    if (err?.message === 'read_failed') error.value = '读取文件失败，请重试。'
  } finally {
    uploading.value = false
  }
}

async function saveDraft() {
  if (!validateForm()) return
  saving.value = true
  try {
    await run(() => adminApi.save(payloadFor('draft')), '草稿已保存到私有仓库。')
    active.value.type = 'draft'
    active.value.isNew = false
    baseline.value = serialize(active.value)
    await loadAll()
  } catch {
    // run 已经设置错误信息
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (!validateForm()) return
  if (!window.confirm('确认发布？发布后 Vercel 会自动构建上线。')) return
  publishing.value = true
  try {
    if (active.value.type === 'post') {
      await run(() => adminApi.save(payloadFor('post')), '已更新，Vercel 正在重新构建。')
    } else {
      await run(async () => {
        await adminApi.save(payloadFor('draft'))
        return adminApi.publish(active.value.slug)
      }, '已发布，Vercel 正在构建，约 1 分钟上线。')
    }
    active.value.type = 'post'
    active.value.isNew = false
    baseline.value = serialize(active.value)
    await loadAll()
  } catch {
    // run 已经设置错误信息
  } finally {
    publishing.value = false
  }
}

async function deleteDraft() {
  if (active.value?.type !== 'draft') return
  if (!window.confirm('确认删除这篇草稿？删除后无法恢复。')) return
  deleting.value = true
  try {
    await run(() => adminApi.remove('draft', active.value.slug), '草稿已删除。')
    active.value = null
    baseline.value = ''
    await loadAll()
    newPost()
  } catch {
    // run 已经设置错误信息
  } finally {
    deleting.value = false
  }
}

function handleBeforeUnload(event) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(async () => {
  await loadAll()
  if (!active.value) newPost()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

</script>

<template>
  <div class="admin-shell" :class="{ 'nav-open': sidebarOpen }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">M</div>
        <div>
          <strong>写作后台</strong>
          <span>myxbw blog</span>
        </div>
      </div>

      <button class="new-button" type="button" @click="newPost">＋ 新文章</button>

      <div class="tabs">
        <button type="button" :class="{ active: tab === 'post' }" @click="switchTab('post')">
          已发布 <span>{{ posts.length }}</span>
        </button>
        <button type="button" :class="{ active: tab === 'draft' }" @click="switchTab('draft')">
          草稿 <span>{{ drafts.length }}</span>
        </button>
      </div>

      <input v-model="search" class="search" type="search" placeholder="搜索标题、slug、标签…" />

      <div class="post-list">
        <button
          v-for="item in filteredList"
          :key="item.slug"
          type="button"
          class="post-item"
          :class="{ active: active?.slug === item.slug && active?.type === tab }"
          @click="openItem(item)"
        >
          <span class="post-item-title">{{ item.title || item.slug }}</span>
          <span class="post-item-meta">
            {{ formatDate(item.date) }}
            <template v-if="item.tags?.length"> · #{{ item.tags[0] }}</template>
          </span>
        </button>
        <p v-if="!filteredList.length" class="empty-note">
          {{ search ? '没有匹配的文章。' : '这里还是空的。' }}
        </p>
      </div>

      <div v-if="health && !health.configured" class="config-warning">
        还没配置 <code>GITHUB_TOKEN</code>，保存和发布不可用。
      </div>
      <div v-else class="sidebar-footer">
        <span>{{ health?.repos?.branch || 'main' }}</span>
        <span>私有草稿 · 公开文章</span>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <button class="menu-button" type="button" @click="sidebarOpen = !sidebarOpen">☰</button>
        <div class="topbar-title">
          <strong>{{ active?.isNew ? '新文章' : active?.title || '未选择文章' }}</strong>
          <span v-if="active" class="status-pill" :class="{ draft: active.type === 'draft' }">{{ statusLabel }}</span>
        </div>
        <div class="topbar-actions">
          <button class="ghost-button" type="button" @click="preview = !preview">
            {{ preview ? '关闭预览' : '预览' }}
          </button>
          <button class="ghost-button" type="button" :disabled="saving || !active" @click="saveDraft">
            {{ saving ? '保存中…' : '保存草稿' }}
          </button>
          <button class="primary-button" type="button" :disabled="publishing || !active" @click="publish">
            {{ publishing ? '处理中…' : active?.type === 'post' ? '更新线上' : '发布' }}
          </button>
          <button
            v-if="active?.type === 'draft' && !active?.isNew"
            class="danger-button"
            type="button"
            :disabled="deleting"
            @click="deleteDraft"
          >
            删除
          </button>
        </div>
      </header>

      <div v-if="error" class="toast error">{{ error }}</div>
      <div v-else-if="notice" class="toast notice">{{ notice }}</div>

      <section v-if="!active" class="empty-state">
        <h1>选一篇文章开始改</h1>
        <p>或者点右上角「新文章」。</p>
      </section>

      <section v-else class="editor" :class="{ 'with-preview': preview }">
        <div class="editor-main">
          <input v-model="active.title" class="title-input" type="text" placeholder="文章标题" maxlength="120" />
          <textarea
            v-model="active.description"
            class="description-input"
            placeholder="一句话摘要，会出现在首页和文章列表里"
            maxlength="240"
            rows="2"
          ></textarea>

          <div class="meta-grid">
            <label>
              <span>slug</span>
              <input v-model="active.slug" type="text" :readonly="!active.isNew" placeholder="20260914-post" />
            </label>
            <label>
              <span>日期</span>
              <input v-model="active.date" type="date" />
            </label>
            <label>
              <span>标签</span>
              <input v-model="active.tagsText" type="text" placeholder="VitePress, 建站" />
            </label>
            <label>
              <span>阅读时长</span>
              <input v-model="active.readingTime" type="number" min="1" max="120" placeholder="自动估算" />
            </label>
          </div>

          <div class="body-row">
            <div class="body-toolbar">
              <div class="toolbar-actions">
                <button type="button" class="tool-button" :disabled="!active || uploading" @click="mediaInput?.click()">
                  {{ uploading ? '上传中…' : '上传图片/附件' }}
                </button>
                <button type="button" class="tool-button" :disabled="!active || importing" @click="markdownInput?.click()">
                  {{ importing ? '导入中…' : '导入本地 md' }}
                </button>
              </div>
              <span class="toolbar-hint">图片 / PDF / TXT / MD / ZIP，单文件 ≤ 3MB，上传即公开</span>
            </div>
            <textarea
              ref="bodyInput"
              v-model="active.body"
              class="body-input"
              placeholder="开始写 Markdown…"
              spellcheck="false"
            ></textarea>
            <input
              ref="mediaInput"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif,.pdf,.txt,.md,.zip"
              hidden
              @change="onFilePicked($event, 'upload')"
            />
            <input
              ref="markdownInput"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              hidden
              @change="onFilePicked($event, 'markdown')"
            />
          </div>

          <footer class="editor-footer">
            <span>{{ (active.body || '').length }} 字符</span>
            <span v-if="isDirty" class="dirty">未保存</span>
            <span v-else>已保存</span>
          </footer>
        </div>

        <aside v-if="preview" class="preview-pane">
          <div class="preview-title">预览</div>
          <article class="markdown-body" v-html="previewHtml"></article>
        </aside>
      </section>
    </main>
  </div>
</template>
