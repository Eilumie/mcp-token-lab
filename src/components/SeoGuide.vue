<script setup>
import { computed } from 'vue';
import { locale } from '../i18n.js';
import { guides, homeContent } from '../seo/content.js';
import { guidePath } from '../seo/site.js';
const copy = computed(() => homeContent[locale.value]);
</script>

<template>
  <section class="seo-guide" aria-labelledby="guide-title">
    <div class="seo-overview"><div><p class="seo-kicker">MCP TOKEN LAB / GUIDE</p><h2 id="guide-title">{{ copy.title }}</h2><p>{{ copy.intro }}</p></div><div><h3>{{ copy.methodTitle }}</h3><p>{{ copy.method }}</p></div></div>
    <section class="seo-steps"><h2>{{ copy.stepsTitle }}</h2><ol><li v-for="step in copy.steps" :key="step">{{ step }}</li></ol></section>
    <section aria-labelledby="scenario-title"><h2 id="scenario-title">{{ copy.guidesTitle }}</h2><p>{{ copy.guidesIntro }}</p><div class="seo-cards"><a v-for="guide in guides" :key="guide.slug" :href="guidePath(guide.slug, locale)"><h3>{{ guide[locale].title }}</h3><p>{{ guide[locale].summary }}</p><span>{{ locale === 'zh' ? '阅读场景说明 →' : 'Read the guide →' }}</span></a></div></section>
    <section class="seo-faq" aria-labelledby="faq-title"><h2 id="faq-title">{{ copy.faqTitle }}</h2><details v-for="[question, answer] in copy.faq" :key="question"><summary>{{ question }}</summary><p>{{ answer }}</p></details></section>
  </section>
</template>
