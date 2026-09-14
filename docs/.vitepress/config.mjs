import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'myxbw 的博客',
  description: '记录 Web 安全、Linux、数据挖掘，以及一个普通学生的折腾过程。',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://blog.myxbw.cn' },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#fbfaf7' }],
    ['meta', { name: 'author', content: 'myxbw' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'myxbw 的博客' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' }],
    ['meta', { 'http-equiv': 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }]
  ],
  themeConfig: {
    siteTitle: '✍️ myxbw 的博客',
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts/' },
      { text: '标签', link: '/tags' },
      { text: '关于', link: '/about' },
      {
        text: '学习站',
        items: [
          { text: '🌐 全站导航（门户）', link: 'https://learn.myxbw.cn/' },
          { text: '🧱 Web 基础学习站', link: 'https://web-basics.myxbw.cn/' },
          { text: '🐧 Linux 命令行站', link: 'https://linux.myxbw.cn/' },
          { text: '🗄️ 数据库原理及其应用', link: 'https://mysql.myxbw.cn/' },
          { text: '⛏️ 数据挖掘学习站', link: 'https://dm.myxbw.cn/' },
          { text: '🚩 CTF 学习站', link: 'https://ctf.myxbw.cn/' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/XXxbwXX' }
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    editLink: {
      pattern: 'https://github.com/XXxbwXX/myxbw-blog/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchLabel: '浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    lightModeSwitchTitle: '切换到浅色模式',
    externalLinkIcon: true,
    lastUpdated: {
      text: '最近更新',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' }
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清空关键词',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    footer: {
      message: '<a href="https://learn.myxbw.cn/">全站导航</a> · <a href="https://www.myxbw.cn/">知识库</a> · <a href="/about">关于</a>',
      copyright: 'Copyright © 2026 myxbw · 记录本身就有意义'
    }
  },
  markdown: {
    lineNumbers: true
  }
})
