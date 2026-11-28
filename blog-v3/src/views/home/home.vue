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

const paperCards = ref(recommendedArticles(savedReport()));
const selected = ref(sessionStorage.getItem("lun-path-selected") || "");
const journal = ref(journalState());
const paperArea = ref(null);
const sceneRoute = ref("home");

function restoreCards() {
  paperCards.value = recommendedArticles(savedReport());
  selected.value = sessionStorage.getItem("lun-path-selected") || "";
  journal.value = journalState();
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
  <HomeHeader />
  <main v-show="sceneRoute !== 'profile'" class="paper-home">
    <section ref="paperArea" aria-labelledby="paper-recommendation-title">
      <h2 id="paper-recommendation-title">推荐论文</h2>
      <template v-if="paperCards.length">
        <HomeArticleList :article-list="paperCards" paper-mode :selected="selected" @select-paper="focusPaper" />
        <a href="./lun-path/index.html#/recommendations" target="blog-home-grove" @click="showScene">查看推荐与检索论文</a>
      </template>
      <div v-else class="paper-home-empty">
        <p v-if="journal.submitted">可以查看推荐，也可以先从书架选一篇试读。</p>
        <p v-else>提交学习画像后，这里会显示适合你的论文。你也可以先从书架选一篇试读。</p>
        <a v-if="journal.submitted" class="paper-home-start" href="./lun-path/index.html#/recommendations" target="blog-home-grove" @click="showScene">
          查看推荐
        </a>
        <a v-else class="paper-home-start" href="./lun-path/index.html#/journal" target="blog-home-grove" @click="showScene">
          {{ journal.started ? "继续手账" : "开始手账" }}
        </a>
        <a href="./lun-path/index.html#/overview" target="blog-home-grove" @click="showScene">浏览方向</a>
        <a v-if="!journal.submitted" href="./lun-path/index.html#/recommendations" target="blog-home-grove" @click="showScene">检索论文</a>
      </div>
    </section>
  </main>
</template>

<style scoped>
.paper-home {
  box-sizing: border-box;
  min-height: 20rem;
  padding: clamp(2rem, 5vw, 5rem) max(6vw, calc((100% - 64rem) / 2));
  background: #f6f3e8;
  color: #303d31;
}
.paper-home h2 {
  margin: 0 0 1rem;
  font-size: clamp(1.5rem, 3vw, 2rem);
}
.paper-home-empty p { margin-bottom: 1rem; }
.paper-home-empty a {
  display: inline-block;
  margin: 0 .75rem .5rem 0;
  padding: .625rem 1em;
  border: 1px solid #607a5b;
  border-radius: .5rem;
  text-decoration: none;
}
.paper-home-empty a.paper-home-start {
  background: #455d44;
  color: #fff;
}
</style>
