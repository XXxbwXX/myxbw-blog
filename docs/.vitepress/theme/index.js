import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import BlogHome from './components/BlogHome.vue'
import PostList from './components/PostList.vue'
import TagCloud from './components/TagCloud.vue'
import ProfileCard from './components/ProfileCard.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('BlogHome', BlogHome)
    app.component('PostList', PostList)
    app.component('TagCloud', TagCloud)
    app.component('ProfileCard', ProfileCard)
  }
}
