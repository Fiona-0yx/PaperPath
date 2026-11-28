<script setup>
import { nextTick, onActivated, onBeforeUnmount, onMounted, ref } from "vue";
import { recommendedArticles, savedReport } from "@/utils/recommended-papers";
import HomeHeader from "@/components/PageHeader/home-header.vue";
import HomeArticleList from "@/components/HomeArticle/home-article-list.vue";

defineOptions({ name: "Home" });

function journalState() {
  try {
    const saved = JSON.parse(localStorage.getItem("lunjing-intake-v1"));
    return { started: Boolean(saved?.started), submitted: Boolean(saved?.submitted) };
  } catch {
    return { started: false, submitted: false };
  }
}

function openedPaperCount() {
  try {
    const events = JSON.parse(localStorage.getItem("lunjing-journal-v1"))?.events;
    if (!Array.isArray(events)) return 0;
    return new Set(events.filter(event => event?.type === "open_paper" && event.paperId)
      .map(event => event.paperId)).size;
  } catch {
    return 0;
  }
}

const paperCards = ref(recommendedArticles(savedReport()));
const selected = ref(sessionStorage.getItem("lun-path-selected") || "");
const journal = ref(journalState());
const openedPapers = ref(openedPaperCount());
const paperArea = ref(null);
const sceneRoute = ref("home");

function restoreCards() {
  paperCards.value = recommendedArticles(savedReport());
  selected.value = sessionStorage.getItem("lun-path-selected") || "";
  journal.value = journalState();
  openedPapers.value = openedPaperCount();
  const returning = sessionStorage.getItem("return-to-recommended-paper");
  if (returning) {
    sessionStorage.removeItem("return-to-recommended-paper");
    focusPaper(returning);
  }
}

async function focusPaper(id) {
  if (!paperCards.value.some(paper => paper.id === id)) return;
  selected.value = id;
  sessionStorage.setItem("lun-path-selected", id);
  await nextTick();
  const card = paperArea.value?.querySelector('[data-paper="' + CSS.escape(id) + '"]');
  card?.focus({ preventScroll: true });
  card?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    block: "center",
  });
}

function receivePaper(event) {
  const scene = document.querySelector('iframe[name="blog-home-grove"]');
  if (event.origin !== location.origin || event.source !== scene?.contentWindow) return;
  if (event.data?.type === "scene-route") {
    sceneRoute.value = event.data.name;
    return;
  }
  if (!["recommended-papers", "focus-paper"].includes(event.data?.type)) return;
  paperCards.value = recommendedArticles(event.data.report);
  if (event.data.type === "focus-paper") focusPaper(event.data.id);
}

function updateJournal(event) {
  if (event.key === "lunjing-intake-v1") journal.value = journalState();
  if (event.key === "lunjing-journal-v1") openedPapers.value = openedPaperCount();
}

function showScene() {
  window.scrollTo({ top: 0 });
}

onMounted(() => {
  window.addEventListener("message", receivePaper);
  window.addEventListener("storage", updateJournal);
});
onBeforeUnmount(() => {
  window.removeEventListener("message", receivePaper);
  window.removeEventListener("storage", updateJournal);
});
onActivated(restoreCards);
</script>

<template>
  <HomeHeader :class="{ 'profile-home': sceneRoute === 'profile' }" />
  <main v-show="sceneRoute !== 'profile'" class="paper-home">
    <header class="paper-home-heading">
      <h2 id="paper-recommendation-title">推荐论文</h2>
    </header>
    <div class="paper-home-grid">
      <aside class="paper-home-center" aria-labelledby="paper-home-center-title">
        <img class="paper-home-center-cover" :src="'./lun-path/assets/botanical/botanic-gardens.png'" alt="" loading="lazy" />
        <div class="paper-home-center-content">
          <div class="paper-home-center-identity">
            <img :src="'./lun-path/favicon.svg'" alt="" width="52" height="52" />
            <h3 id="paper-home-center-title">个人中心</h3>
          </div>
          <p class="paper-home-center-status">
            {{ journal.submitted ? "初始画像已提交" : journal.started ? "初始手账填写中" : "初始手账待填写" }}
          </p>
          <dl class="paper-home-center-stats">
            <div><dt>打开过的论文</dt><dd>{{ openedPapers }}</dd></div>
            <div><dt>推荐论文</dt><dd>{{ paperCards.length }}</dd></div>
          </dl>
          <nav class="paper-home-tools" aria-label="个人中心入口">
            <a v-if="journal.submitted" class="paper-home-start" href="./lun-path/index.html#/profile" target="blog-home-grove" @click="showScene">我的画像</a>
            <a v-else class="paper-home-start" href="./lun-path/index.html#/journal" target="blog-home-grove" @click="showScene">
              {{ journal.started ? "继续手账" : "开始手账" }}
            </a>
            <a href="./lun-path/index.html#/recommendations" target="blog-home-grove" @click="showScene">
              {{ journal.submitted ? "推荐与检索" : "检索论文" }}
            </a>
            <a href="./lun-path/index.html#/overview" target="blog-home-grove" @click="showScene">浏览方向</a>
          </nav>
        </div>
      </aside>
      <section ref="paperArea" class="paper-home-list" aria-labelledby="paper-recommendation-title">
        <HomeArticleList v-if="paperCards.length" :article-list="paperCards" paper-mode :selected="selected" @select-paper="focusPaper" />
        <div v-else class="paper-home-empty">
          <h3>{{ journal.submitted ? "生成论文推荐" : "从学习画像开始" }}</h3>
          <p v-if="journal.submitted">前往推荐与检索，获取与你的学习方向相关的论文。</p>
          <p v-else>提交学习画像后，这里会显示适合你的论文。也可以先检索论文，或从书架选一篇试读。</p>
          <a v-if="journal.submitted" href="./lun-path/index.html#/recommendations" target="blog-home-grove" @click="showScene">查看推荐 <span aria-hidden="true">→</span></a>
          <a v-else href="./lun-path/index.html#/journal" target="blog-home-grove" @click="showScene">
            {{ journal.started ? "继续手账" : "开始手账" }} <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
:global(html:has(.profile-home)),
:global(body:has(.profile-home)) {
  margin: 0;
  overflow: hidden;
}
.profile-home :deep(.home-waves) { display: none; }
.paper-home {
  --recommend-paper: #fffcf4;
  --recommend-border: #dedbc9;
  --recommend-ink: #303d31;
  --recommend-muted: #586354;
  --recommend-accent: #3c5840;
  box-sizing: border-box;
  min-height: 20rem;
  padding: clamp(2rem, 5vw, 4rem) max(clamp(1rem, 4vw, 4rem), calc((100% - 76rem) / 2));
  background: #f6f3e8;
  color: var(--recommend-ink);
}
.paper-home-heading {
  padding-bottom: .85rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--recommend-border);
}
.paper-home-heading h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2rem); }
.paper-home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(13.75rem, 17rem);
  grid-template-areas: "list tools";
  align-items: start;
  gap: clamp(.85rem, 2vw, 1.4rem);
}
.paper-home-list { grid-area: list; min-width: 0; }
.paper-home-center, .paper-home-empty {
  border-radius: .7rem;
  border: 1px solid var(--recommend-border);
  background: var(--recommend-paper);
}
.paper-home-center {
  grid-area: tools;
  position: sticky;
  top: 1rem;
  overflow: hidden;
}
.paper-home-center-cover {
  display: block;
  width: 100%;
  height: clamp(6.5rem, 11vw, 9.5rem);
  object-fit: cover;
  object-position: center 45%;
}
.paper-home-center-content, .paper-home-empty { padding: clamp(1rem, 2.5vw, 1.4rem); }
.paper-home-center-identity {
  display: flex;
  align-items: end;
  gap: .7rem;
  margin-top: -2.65rem;
}
.paper-home-center-identity img {
  flex: none;
  border: 3px solid var(--recommend-paper);
  border-radius: 50%;
  background: var(--recommend-paper);
}
.paper-home-center-identity h3 { margin: 0 0 .15rem; font-size: 1.125rem; }
.paper-home-center-status { margin: .65rem 0 1rem; color: var(--recommend-muted); font-size: .875rem; }
.paper-home-center-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0 0 1rem;
  padding: .75rem 0;
  border-block: 1px solid var(--recommend-border);
  text-align: center;
}
.paper-home-center-stats div + div { border-inline-start: 1px solid var(--recommend-border); }
.paper-home-center-stats dt { color: var(--recommend-muted); font-size: .8rem; }
.paper-home-center-stats dd { margin: .15rem 0 0; font-size: 1.2rem; font-weight: 650; }
.paper-home-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .5rem;
}
.paper-home-tools a {
  display: block;
  padding: .6rem .25rem;
  border: 1px solid var(--recommend-border);
  border-radius: .4rem;
  color: var(--recommend-accent);
  font-size: .875rem;
  text-align: center;
  text-decoration: none;
}
.paper-home-tools a:hover { background: #e9eddf; }
.paper-home-tools .paper-home-start {
  grid-column: 1 / -1;
  background: var(--recommend-accent);
  border-color: var(--recommend-accent);
  color: #fff;
}
.paper-home-tools .paper-home-start:hover { background: #304a34; }
.paper-home-empty h3 { margin: 0 0 .5rem; font-size: 1.125rem; }
.paper-home-empty p { margin: 0 0 .8rem; color: var(--recommend-muted); line-height: 1.55; }
.paper-home-empty a { color: var(--recommend-accent); font-weight: 600; text-underline-offset: .2em; }
.paper-home a:focus-visible { outline: 2px solid var(--recommend-accent); outline-offset: 3px; }
@media (max-width: 760px) {
  .paper-home-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "tools" "list"; }
  .paper-home-center { position: static; }
  .paper-home-center-cover { height: clamp(5.25rem, 22vw, 7rem); }
}
</style>
