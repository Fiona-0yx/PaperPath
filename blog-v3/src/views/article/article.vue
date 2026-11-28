<script setup>
import { computed, ref, watch, reactive, h, nextTick, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { paperForRoute } from "@/utils/recommended-papers";
import { ElNotification } from "element-plus";
import { staticData, user } from "@/store/index.js";
import { storeToRefs } from "pinia";

import { MdPreview, MdCatalog } from "md-editor-v3";
import "md-editor-v3/lib/style.css";

import { getArticleById, getRecommendArticleById, readingDuration } from "@/api/article";
import { addLike, cancelLike, getIsLikeByIdOrIpAndType } from "@/api/like";

import Comment from "@/components/Comment/Comment.vue";
import Tooltip from "@/components/ToolTip/tooltip.vue";
import PageHeader from "@/components/PageHeader/index.vue";
import PaperStudy from './paper-study.vue';
import GsapCount from "@/components/GsapCount/index";

let setUpTimes = null;
let lastArticleId = null;
let comment = null,
  observe = null; // 用于监听评论是否出现在可视区域内
const commentRef = ref(null);
const commentIsOpen = ref(false);

const router = useRouter();
const route = useRoute();
const paperId = computed(() => typeof route.query.paper === 'string' ? route.query.paper : '');
const paper = computed(() => paperId.value ? paperForRoute(paperId.value) : null);
const paperBack = computed(() => {
  if (route.query.source === 'history') return { href: './lun-path/index.html#/profile', label: '学习记录' };
  if (paper.value && route.query.category === paper.value.category && route.query.source === 'shelf')
    return { href: './lun-path/index.html#/shelf/' + encodeURIComponent(paper.value.category), label: '论文书架' };
  return { href: '#/home', label: '学习路径' };
});
watch(paperId, id => {
  if (id) sessionStorage.setItem('return-to-recommended-paper', id);
}, { immediate: true });
// 初始化pinia
const staticStore = staticData();
const userStore = user();
const { codeTheme, previewTheme, mainTheme } = storeToRefs(staticStore);
const { getUserInfo } = storeToRefs(userStore);

const currentUrl = window.location.href;
const isLike = ref(false);
const likePending = ref(false);

// 模仿获取md文档信息
const mdState = reactive({
  text: "",
  id: "my-editor",
  switch: true,
});
const loading = ref(false);
const articleInfo = ref({});
const scrollElement = document.documentElement;
// 移动端目录是否可见
const drawerShow = ref(false);
// 推荐文章
const recommendList = ref([]);
const previousArticle = ref({});
const nextArticle = ref({});

const toggleDrawer = () => {
  drawerShow.value = !drawerShow.value;
};

const goToArticle = (article) => {
  router.push({ path: "/article", query: { id: article.id } });
};

// 文章点赞
const like = async () => {
  if (likePending.value) return;
  likePending.value = true;
  // 取消点赞
  if (isLike.value) {
    let res = await cancelLike({
      for_id: articleInfo.value.id,
      type: 1,
      user_id: getUserInfo.value.id,
    });
    if (res.code == 0) {
      articleInfo.value.thumbs_up_times--;
      isLike.value = false;
      likePending.value = false;

      ElNotification({
        offset: 60,
        title: "提示",
        message: h(
          "div",
          { style: "color: #7ec050; font-weight: 600;" },
          "有什么不足可以给我留下评论，感谢指正"
        ),
      });
    }
  }
  // 点赞
  else {
    let res = await addLike({
      for_id: articleInfo.value.id,
      type: 1,
      user_id: getUserInfo.value.id,
    });
    if (res.code == 0) {
      articleInfo.value.thumbs_up_times++;
      isLike.value = true;
      likePending.value = false;
      ElNotification({
        offset: 60,
        title: "提示",
        message: h("div", { style: "color: #7ec050; font-weight: 600;" }, "点赞成功，谢谢支持"),
      });
    }
  }
};
// 文章详情
const getArticleDetails = async (id) => {
  let res = await getArticleById(id);
  if (res.code == 0) {
    mdState.text = res.result.article_content;
    articleInfo.value = res.result;

    const LRes = await getIsLikeByIdOrIpAndType({
      for_id: articleInfo.value.id,
      type: 1,
      user_id: getUserInfo.value.id,
    });
    if (LRes.code == 0) {
      isLike.value = LRes.result;
    }
  }
};

// 返回本次浏览时长
const addReadingDuration = async (id) => {
  const now = new Date();
  let duration = now - setUpTimes;
  await readingDuration(id, duration);
};

// 推荐文章
const getRecommendArticle = async (id) => {
  let res = await getRecommendArticleById(id);
  if (res.code == 0) {
    const { previous, next, recommend } = res.result;
    recommendList.value = recommend;
    previousArticle.value = previous;
    nextArticle.value = next;
  }
};

const init = async (id) => {
  loading.value = true;
  await getArticleDetails(id);
  await getRecommendArticle(id);
  loading.value = false;

  nextTick(() => {
    commentIsOpen.value = false;
    observeBox();
  });
};

// 无限加载
const observeBox = () => {
  // 获取要监听的元素
  comment = document.querySelector(".comment-box");

  observe = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (e) => {
        if (e.isIntersecting && e.intersectionRatio > 0 && !commentIsOpen.value) {
          commentRef.value.toggleExpand();
          commentIsOpen.value = true;
        }
      });
    },
    { threshold: [1] }
  );
  comment && observe.observe(comment);
};
watch(
  () => route,
  (newV) => {
    // 初始化的时候 记录进来的时间
    setUpTimes = new Date();
    lastArticleId = newV.query.id;

    if (newV.path == "/article" && newV.query.id) {
      init(newV.query.id);
    }
  },
  {
    immediate: true,
    deep: true,
  }
);
// 用户离开页面时增加阅读时长
onBeforeUnmount(() => {
  if (setUpTimes && lastArticleId && !paperId.value) {
    addReadingDuration(lastArticleId); // 添加阅读时长
  }
});
</script>

<template>
  <PageHeader :article="paper || articleInfo" :loading="loading" />
  <main v-if="paperId" class="article article-center paper-detail">
    <nav class="paper-back" aria-label="返回学习路径"><a :href="paperBack.href">← {{ paperBack.label }}</a></nav>
    <paper-study v-if="paper" :key="paper.id" :paper="paper" :paragraph="route.query.paragraph" />
    <el-card v-else>这篇论文暂时无法打开。可以返回学习路径重新选择。</el-card>
  </main>
  <div v-else class="article article-center">
    <el-row class="article_box">
      <el-col :xs="0" :sm="0" :md="4"></el-col>
      <el-col :xs="24" :sm="18" :md="16">
        <el-skeleton v-if="loading" :loading="loading" :rows="8" animated />
        <el-card v-else class="md-preview">
          <MdPreview
            class="md-preview-v3"
            v-model="mdState.text"
            :editorId="mdState.id"
            :preview-theme="previewTheme"
            :code-theme="codeTheme"
            :theme="mainTheme ? 'dark' : 'light'"
          ></MdPreview>
          <div class="article-info">
            <div class="article-info-inner">
              <div>
                <span>文章作者：</span>
                <a class="to_pointer" href="https://gitee.com/mrzym">{{
                  articleInfo.authorName
                }}</a>
              </div>
              <div>
                <span>类型：</span>
                <el-tag>{{
                  articleInfo.type == 1 ? "原创" : articleInfo.type == 2 ? "转载" : "翻译"
                }}</el-tag>
              </div>
              <div v-if="articleInfo.type != 1">
                <span>原文链接：</span>
                <a class="to_pointer" :href="articleInfo.origin_url">{{
                  articleInfo.origin_url
                }}</a>
              </div>
              <div v-else>
                <span>本文链接：</span>
                <a class="to_pointer" v-copy="currentUrl">{{ currentUrl }}</a>
              </div>
              <p>声明: 此文章版权归 Mr M 所有，如有转载，请注明来自原作者</p>
            </div>
          </div>
          <div :class="['like', isLike ? 'is-like' : '']" @click="like">
            <i class="iconfont icon-icon1 !mr-[5px]"></i>
            <GsapCount
              :class="[isLike ? 'is-like' : '']"
              v-if="articleInfo.thumbs_up_times - 0 < 1000"
              :value="articleInfo.thumbs_up_times"
            />
            <span v-else :class="[isLike ? 'is-like' : '']">
              {{ articleInfo.thumbs_up_times }}
            </span>
          </div>
          <div class="recommend flex_r_between">
            <div class="recommend-box" @click="goToArticle(previousArticle)">
              <el-image
                class="recommend-box-img animate__animated animate__fadeInDown"
                fit="cover"
                :src="previousArticle.article_cover"
              >
                <template #error>
                  <svg-icon name="image404" :width="10" :height="5"></svg-icon>
                </template>
              </el-image>
              <span class="recommend-box-item prev">
                <span class="flex_r_around">
                  <i class="iconfont icon-arrowleft"></i>
                  <span class="font-semibold">上一篇</span>
                </span>
                <Tooltip
                  width="60%"
                  color="#fff"
                  :weight="600"
                  :name="previousArticle.article_title"
                  align="left"
                ></Tooltip>
              </span>
            </div>
            <div class="recommend-box" @click="goToArticle(nextArticle)">
              <el-image
                class="recommend-box-img animate__animated animate__fadeInDown"
                fit="cover"
                :src="nextArticle.article_cover"
              >
                <template #error>
                  <svg-icon name="image404" :width="10" :height="5"></svg-icon>
                </template>
              </el-image>
              <span class="recommend-box-item next">
                <span class="flex_r_around">
                  <span class="font-semibold">下一篇</span>
                  <i class="iconfont icon-arrowright"></i>
                </span>
                <Tooltip
                  width="60%"
                  color="#fff"
                  :weight="600"
                  :name="nextArticle.article_title"
                  align="right"
                ></Tooltip>
              </span>
            </div>
          </div>
          <!-- 移动端推荐文章 -->
          <div class="mobile-recommend">
            <el-row style="padding: 2rem">
              <div class="recommend-title">推荐文章</div>
              <el-col
                :span="12"
                v-for="item in recommendList"
                :key="item.id"
                @click="goToArticle(item)"
              >
                <el-card class="card card-hover">
                  <template #header>
                    <span :title="item.article_title" class="title">{{ item.article_title }}</span>
                  </template>
                  <el-image
                    class="image animate__animated animate__fadeInDown"
                    fit="cover"
                    :src="item.article_cover"
                  >
                    <template #error>
                      <svg-icon name="image404" :width="10" :height="5"></svg-icon>
                    </template>
                  </el-image>
                </el-card>
              </el-col>
            </el-row>
          </div>
          <div class="!p-[2rem] comment-box">
            <Comment
              ref="commentRef"
              class="w-[100%]"
              type="article"
              :id="route.query.id - 0"
              :author-id="articleInfo.author_id"
            />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="0" :sm="6" :md="4">
        <el-skeleton v-if="loading" :loading="loading" :rows="3" animated />
        <el-card v-else class="command card-hover" header="推荐文章">
          <div class="command-box">
            <div
              class="command-box-item"
              v-for="(item, index) in recommendList"
              :key="index"
              @click="goToArticle(item)"
            >
              <el-image
                class="command-box-item__img animate__animated animate__fadeInDown"
                fit="cover"
                width="50"
                :src="item.article_cover"
              >
                <template #error>
                  <svg-icon name="image404" :width="5" :height="5"></svg-icon>
                </template>
              </el-image>
              <Tooltip width="35%" weight="600" size="1rem" :name="item.article_title" />
              <Tooltip width="35%" size="0.8rem" :name="item.createdAt" />
            </div>
          </div>
        </el-card>
        <el-affix :offset="53" style="width: inherit">
          <el-skeleton v-if="loading" :loading="loading" :rows="5" animated />
          <el-card v-else class="catalogue-card card-hover" header="目录">
            <div class="catalogue-card__box">
              <MdCatalog :editorId="mdState.id" :scroll-element="scrollElement" />
            </div>
          </el-card>
        </el-affix>
      </el-col>
    </el-row>
    <div class="mobile-affix">
      <i class="iconfont icon-arrowright" @click="toggleDrawer"></i>
    </div>
    <!-- 移动端目录 -->
    <el-drawer
      title="目录"
      v-model="drawerShow"
      direction="ltr"
      :before-close="toggleDrawer"
      :append-to-body="true"
      size="60%"
    >
      <MdCatalog v-if="!loading" :editorId="mdState.id" :scroll-element="scrollElement" />
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.article-center.paper-detail {
  width: min(calc(100% - 40px), 1380px);
  min-height: 50vh;
  padding: 32px 0 64px;
  --paper-accent: #46604b;
  --paper-text: var(--font-color, #26342d);
  --paper-muted: #5c6960;
  --paper-line: var(--el-border-color-light, #e4e8e2);
  --paper-card: var(--card-bg, #fff);
}
.paper-back { margin-bottom: 14px; font-size: 14px; }
.paper-back a { color: var(--paper-accent); text-underline-offset: 4px; }
.paper-back a:hover { text-decoration: underline; }
:global(html.dark .article-center.paper-detail) {
  --paper-accent: #b2ceb2;
  --paper-muted: #acb9af;
}
@media (max-width: 768px) {
  .article-center.paper-detail { width: calc(100% - 24px); padding: 16px 0 84px; }
}
.article {
  &-info {
    padding: 2rem 2rem;

    &-inner {
      padding: 1rem;
      color: var(--font-color);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
  }
}

.catalogue-card {
  margin-top: 1rem;
  padding: 1rem 0.5rem;

  &__box {
    scrollbar-width: none;
    overflow: auto;
    max-height: calc(100vh - 23.1rem);
    cursor: pointer;
  }
}

.mobile-catalog {
  padding: 2rem;
  max-height: 400px;
  scrollbar-width: none;
  overflow-y: auto;
  cursor: pointer;
}

.theme-card {
  padding: 1rem 0.5rem;
}

.command {
  padding: 1rem 0.5rem;

  &-box {
    max-height: 160px;
    scrollbar-width: none;
    overflow-y: auto;
    cursor: pointer;

    &::-webkit-scrollbar {
      display: none;
      /* Chrome Safari */
    }

    &-item {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 0.3rem;
      color: var(--font-color);

      &__img {
        margin-right: 1rem;
        width: 50px;
        height: 40px;
      }
    }
  }
}

.icon-sort {
  font-size: 1.8rem;
  color: var(--font-color);
}

.recommend {
  box-sizing: border-box;
  position: relative;
  padding: 2rem;

  &-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    width: 50%;
    height: 100%;
    overflow: hidden;
    color: var(--global-white);
    transition: scale 0.5s;
    cursor: pointer;

    &:hover {
      .recommend-box-img {
        scale: 1.2;
      }
      .recommend-box-item {
        background-color: var(--mask-bg);
      }
    }

    &-img {
      transition: all 0.5s;
      width: 100%;
      height: 100%;
    }

    &-item {
      position: absolute;
      display: flex;
      flex-direction: column;
      justify-content: center;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      font-size: 1.2rem;
      line-height: 1.8;
      transition: all 0.5s;
      background-color: rgba(0, 0, 0, 0.7);

      i {
        font-size: 1.4rem;
      }
    }

    .prev {
      padding-left: 2rem;
      align-items: flex-start;

      div {
        box-sizing: border-box;
        max-width: 10rem;
        font-size: 1rem;
        margin-left: 1rem;
      }
    }

    .next {
      padding-right: 2rem;
      align-items: flex-end;

      div {
        box-sizing: border-box;
        max-width: 10rem;
        font-size: 1rem;
        margin-right: 1rem;
      }
    }
  }
}

.like {
  margin: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;

  .icon-icon1 {
    font-size: 1.8rem;
    transition: all 0.3s;
    &:hover {
      scale: 1.1;
    }
  }
}

.is-like {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--primary);
  .icon-icon1 {
    font-size: 1.8rem;
    color: var(--primary);
  }
}

.mobile-recommend {
  position: relative;
  .recommend-title {
    position: absolute;
    top: 0;
    left: 2.2rem;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--font-color);
  }
  .card {
    width: 100%;
    height: 8rem;
    overflow: hidden;
  }
  .title {
    display: inline-block;
    width: 80%;
    height: 2rem;
    padding: 0.3rem 0 0 0.3rem;
    font-size: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
  .image {
    width: 100%;
    height: 6rem;
  }
}

:deep(.el-card__header) {
  font-size: 1.6rem;
  padding: 0 !important;
  font-weight: bold;
  line-height: 1.8;
  color: var(--font-color);
}

a {
  text-decoration: underline;
}
@media screen and (min-width: 768px) {
  .mobile-recommend {
    display: none;
  }
}
</style>
