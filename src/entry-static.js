import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import StaticPage from './components/StaticPage.vue';
import { locale } from './i18n.js';
export async function render(language, props = {}) {
  locale.value = language;
  return renderToString(createSSRApp(StaticPage, props));
}
