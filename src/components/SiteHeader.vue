<script setup>
import { Github, Languages } from 'lucide-vue-next';
import { locale, setLocale } from '../i18n.js';
import { basePath, homePath, pagePath } from '../seo/site.js';
defineProps({ staticPage: Boolean, guide: String });
function changeLanguage(event, staticPage) {
  if (staticPage || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  setLocale(locale.value === 'zh' ? 'en' : 'zh');
}
</script>

<template>
  <header class="app-header">
    <a class="brand" :href="homePath(locale)"><span class="brand-mark header-floating"><img :src="basePath + 'icon/mcp-token-lab-logo.svg'" width="36" height="36" alt="" /></span><strong><b class="brand-title header-floating">MCP Token Lab</b><span class="brand-tagline header-floating">CONTEXT STRATEGY PLAYGROUND</span></strong></a>
    <nav class="header-actions" :aria-label="locale === 'zh' ? '配置操作' : 'Workspace navigation'">
      <a class="language-toggle header-floating" :href="pagePath(locale === 'zh' ? 'en' : 'zh', guide)" :hreflang="locale === 'zh' ? 'en' : 'zh-CN'" :aria-label="locale === 'zh' ? 'Switch to English' : '切换为中文'" @click="changeLanguage($event, staticPage)"><Languages :size="15"/><span>{{ locale === 'zh' ? '中文' : 'EN' }}</span></a>
      <a class="header-github header-floating" href="https://github.com/Eilumie/mcp-token-lab" target="_blank" rel="noopener noreferrer" :aria-label="locale === 'zh' ? '在新标签页打开 GitHub 仓库' : 'Open GitHub repository in a new tab'"><Github :size="16"/><span>GitHub</span></a>
    </nav>
  </header>
</template>
