<script setup>
import { nextTick, watch } from "vue";
import { useRouter } from "vue-router";

import { numberFormate } from "@/utils/tool";

import ArticleSkeleton from "./components/article-skeleton.vue";
import Tooltip from "../ToolTip/tooltip.vue";
import Pagination from "../Pagination/pagination.vue";
import GsapCount from "@/components/GsapCount/index";

import { gsapTransY } from "@/utils/transform";
import { isMobile } from "@/utils/tool";

const emit = defineEmits(["pageChange", "select-paper"]);

const props = defineProps({
  paperMode: Boolean,
  selected: String,
  articleList: {
    type: Array,
    default: () => [],
  },
  articleTotal: {
    type: Number,
    default: 0,
  },
  param: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();
const materialLabels = {
  teaching: "站内教学材料",
  "reading-note": "站内阅读摘记",
  excerpt: "站内原文摘录",
  "open-text": "开放获取 · 站内正文",
  external: "外部原文",
};
const paperLocation = item => ({ path: "/article", query: { paper: item.id } });
async function openPaper(event, item) {
  if (item.externalOnly || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  emit('select-paper', item.id);
  await nextTick();
  const navigate = () => router.push(paperLocation(item));
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(async () => { await navigate(); await nextTick(); });
  } else navigate();
}

/* 文章操作 start */
const operate = (type, item) => {
  switch (type) {
    case "detail":
      router.push({ path: "/article", query: { id: item.id } });
      break;
    case "tag":
      router.push({ path: "/tag" });
      break;
    case "category":
      router.push({ path: "/category" });
      break;
  }
};
/* 文章操作 end */

let layout = " prev, pager, next"; //分页组件会展示的功能项

const pagination = (page) => {
  emit("pageChange", page);
};

watch(
  () => props.articleList,
  () => {
    if (props.paperMode || !props.articleList.length) return;
    nextTick(() => {
      let listArticle = [];
      for (let i = 0; i < props.articleList.length; i++) {
        if (!isMobile()) {
          if (i >= 1) {
            listArticle.push(".article" + i);
          }
        } else {
          listArticle.push(".article" + i);
        }
      }
      gsapTransY(listArticle, 30, 0.3, "none");
    });
  }
);
</script>

<template>
  <ul v-if="paperMode" class="paper-list">
    <li v-for="item in articleList" :key="item.id">
      <a
        class="paper-entry"
        :class="{ 'paper-selected': item.id === selected, 'has-cover': item.article_cover }"
        :data-paper="item.id"
        :href="item.externalOnly ? item.original : router.resolve(paperLocation(item)).href"
        :target="item.externalOnly ? '_blank' : undefined"
        :rel="item.externalOnly ? 'noopener noreferrer' : undefined"
        @click="openPaper($event, item)"
      >
        <div v-if="item.article_cover" class="paper-cover">
          <img :src="item.article_cover" alt="" loading="lazy" decoding="async" />
        </div>
        <div class="paper-info">
          <p v-if="item.categoryName || item.year || item.venue" class="paper-meta">
            {{ [item.categoryName, item.venue, item.year].filter(Boolean).join(" · ") }}
          </p>
          <h3 class="paper-title">{{ item.article_title }}</h3>
          <p v-if="item.article_description && item.article_description !== item.venue" class="paper-description">
            {{ item.article_description }}
          </p>
          <p class="paper-action">
            {{ materialLabels[item.materialKind] }}
            <span aria-hidden="true">{{ item.externalOnly ? '↗' : '→' }}</span>
          </p>
        </div>
      </a>
    </li>
  </ul>
  <el-row v-else class="root">
    <template v-if="param.loading">
      <el-col v-for="item in 5" :key="item">
        <el-card class="card-hover">
          <div class="article-box">
            <el-skeleton :loading="param.loading" style="height: 100%" animated>
              <template #template>
                <ArticleSkeleton />
              </template>
            </el-skeleton>
          </div>
        </el-card>
      </el-col>
    </template>
    <template v-else>
      <template v-if="articleList.length">
        <el-col
          :class="['article-col', 'article' + index]"
          v-for="(item, index) in articleList"
          :key="item.id"
        >
          <el-card class="card-hover">
            <div
              class="article-box"
              :style="{
                'flex-direction': index % 2 == 0 ? 'row' : 'row-reverse',
              }"
            >
              <div
                :class="['article-cover', 'article-cover' + index]"
                @click="operate('detail', item)"
              >
                <div
                  v-image="item.article_cover"
                  class="scale flex justify-center items-center"
                  style="width: 100%; height: 100%"
                >
                  <el-image :src="item.article_cover" fit="cover" class="image">
                    <template #error>
                      <svg-icon name="image404" :width="15" :height="15"></svg-icon>
                    </template>
                  </el-image>
                </div>
              </div>
              <!-- 信息 -->
              <div class="article-info flex_c_between">
                <span
                  class="title text_overflow"
                  :title="item.article_title"
                  @click="operate('detail', item)"
                >
                  {{ item.article_title }}
                </span>
                <div class="meta">
                  <span v-if="item.is_top == 1" class="to_pointer">
                    <i class="iconfont icon-zhiding"></i>
                    <span class="meta-label">置顶</span>
                  </span>
                  <span v-if="item.is_top == 1" class="article-meta__separator"></span>
                  <span class="to_pointer">
                    <i class="iconfont icon-calendar2"></i>
                    <span class="meta-label">发表于</span>
                    <span class="meta-value">{{ item.createdAt }}</span>
                  </span>
                  <span class="to_pointer">
                    <i class="iconfont icon-schedule"></i>
                    <span class="meta-label">更新于</span>
                    <span class="meta-value">{{ item.updatedAt }}</span>
                  </span>
                  <span class="article-meta__separator"></span>
                  <span class="to_pointer" @click="operate('category', item)">
                    <i class="iconfont icon-folder"></i>
                    <span class="meta-value">{{ item.categoryName }}</span>
                  </span>
                  <span class="article-meta__separator"></span>
                  <span class="to_pointer" @click="operate('tag', item)">
                    <i class="iconfont icon-label_fill"></i>
                    <span
                      class="meta-value"
                      v-for="(tagName, index) in item.tagNameList"
                      :key="index"
                    >
                      {{ index == item.tagNameList.length - 1 ? tagName : tagName + "、" }}
                    </span>
                  </span>
                  <span class="article-meta__separator"></span>
                  <span class="to_pointer">
                    <i class="iconfont icon-icon1"></i>
                    <GsapCount
                      class="meta-value"
                      v-if="item.thumbs_up_times - 0 < 1000"
                      :value="numberFormate(item.thumbs_up_times)"
                    />
                    <span v-else class="meta-value">
                      {{ numberFormate(item.thumbs_up_times) }}
                    </span>
                  </span>
                  <span class="article-meta__separator"></span>
                  <span class="to_pointer">
                    <i class="iconfont icon-chakan"></i>
                    <GsapCount
                      class="meta-value"
                      v-if="item.view_times - 0 < 1000"
                      :value="numberFormate(item.view_times)"
                    />
                    <span v-else class="meta-value">
                      {{ numberFormate(item.view_times) }}
                    </span>
                  </span>
                </div>
                <Tooltip
                  width="100%"
                  size="1.2rem"
                  align="left"
                  :lineHeight="3"
                  :name="item.article_description"
                />
              </div>
            </div>
            <!-- 图片 -->
          </el-card>
        </el-col>
      </template>
      <template v-else>
        <div class="no-article">暂无文章，请先到后台发布文章～</div>
      </template>
    </template>
    <Pagination
      class="!mt-[2rem]"
      :size="param.size"
      :current="param.current"
      :layout="layout"
      :total="articleTotal"
      @pagination="pagination"
    />
  </el-row>
</template>

<style lang="scss" scoped>
.paper-list {
  display: grid;
  gap: .95rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.paper-entry {
  display: grid;
  grid-template-areas: "text";
  min-height: 10.75rem;
  border: 1px solid var(--recommend-border);
  border-radius: .7rem;
  overflow: hidden;
  color: var(--recommend-ink);
  background: var(--recommend-paper);
  text-decoration: none;
  scroll-margin: 2rem;
}
.paper-entry.has-cover {
  grid-template-columns: minmax(0, 32%) minmax(0, 1fr);
  grid-template-areas: "cover text";
}
.paper-list li:nth-child(even) .paper-entry.has-cover {
  grid-template-columns: minmax(0, 1fr) minmax(0, 32%);
  grid-template-areas: "text cover";
}
.paper-entry:hover, .paper-entry.paper-selected { border-color: var(--recommend-accent); }
.paper-entry:focus-visible { outline: 2px solid var(--recommend-accent); outline-offset: 3px; }
.paper-selected .paper-title { view-transition-name: recommended-paper-title; }
.paper-cover { grid-area: cover; position: relative; background: #e1e5d9; }
.paper-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.paper-info {
  grid-area: text;
  align-self: center;
  min-width: 0;
  padding: clamp(.95rem, 2vw, 1.45rem);
  display: grid;
  gap: .45rem;
}
.paper-info > * { margin: 0; overflow-wrap: anywhere; }
.paper-title { font-size: clamp(1.05rem, 2vw, 1.375rem); font-weight: 650; line-height: 1.35; }
.paper-meta { font-size: .8125rem; color: var(--recommend-muted); }
.paper-description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--recommend-muted);
  line-height: 1.5;
}
.paper-action { color: var(--recommend-accent); font-size: .8125rem; font-weight: 600; }
.paper-action span { margin-inline-start: .25em; }
@media (max-width: 600px) {
  .paper-entry { min-height: auto; }
  .paper-entry.has-cover, .paper-list li:nth-child(even) .paper-entry.has-cover {
    grid-template-columns: minmax(0, 1fr) minmax(4rem, 24%);
    grid-template-areas: "text cover";
  }
  .paper-description { font-size: .875rem; }
}
.article-cover {
  .image {
    width: 100%;
    height: 100%;
    vertical-align: bottom;
    display: grid;
    place-items: center;
  }
}

.no-article {
  color: var(--font-color);
  width: 100%;
  height: 80vh;
  line-height: 80vh;
  font-size: 24px;
  font-weight: bold;
  text-align: center;
}

.article-info {
  flex: 1;
  .title {
    display: inline-block;
    width: 100%;
    font-size: 1.6rem;
    color: var(--font-color);
    font-weight: 600;
    line-height: 2.4;
    transition: 0.2s ease-in-out;

    &:hover {
      cursor: pointer;
      color: var(--primary);
    }
  }

  .meta {
    color: var(--meta-color);
    line-height: 1.4;
    font-size: 100%;
    font-weight: 500;

    .icon-zhiding {
      font-size: 1rem;
      color: var(--top);
    }

    &-label {
      padding-right: 0.2rem;
    }

    &-value {
      padding-right: 0.2rem;
    }

    .icon-label_fill {
      font-size: 1.2rem;
    }

    .icon-icon1 {
      font-size: 1.2rem;
    }

    .icon-chakan {
      font-size: 1.2rem;
    }

    .article-meta__separator {
      margin: 0 0.4rem;
      font-size: 1.1rem;
      position: relative;

      &::after {
        content: "|";
        position: absolute;
        top: -3px;
        right: 0;
      }
    }

    i {
      margin: 0 0.2rem 0 0;
    }
  }
}

@media screen and (max-width: 768px) {
  .article-box {
    display: flex;
    justify-content: space-around;
    flex-direction: column !important;
    align-items: center;
    height: 28rem;
  }

  .article-cover {
    width: 100%;
    height: 14rem;
    overflow: hidden;
  }

  .article-info {
    flex: 1;
    width: 100%;
    padding: 1rem 1.5rem;
    overflow: hidden;
    display: inline-block;
  }
}

// pc
@media screen and (min-width: 768px) {
  .article-box {
    display: flex;
    align-items: center;
    height: 16rem;
  }

  .article-cover {
    width: 40%;
    height: 100%;
    overflow: hidden;
  }

  .article-info {
    width: 55%;
    padding: 0 20px;
    overflow: hidden;
    display: inline-block;
  }
}
</style>
