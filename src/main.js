import { createApp, watch } from "vue";
import App from "./App.vue";
import { updateHomeMetadata } from "./seo/metadata.js";
import { installDomTranslations, locale } from "./i18n.js";
import "./styles/app.css";
import "./styles/seo.css";
import "./styles/home-base.css";
import "./styles/home.css";
import "./styles/flow-preview.css";
import "./header-surfaces.css";
import "./global-settings.css";
import "./styles/home-editorial.css";

updateHomeMetadata(locale.value);
const translations = installDomTranslations();
createApp(App).mount("#app");
watch(locale, () => translations.refresh(), { flush: 'post' });
