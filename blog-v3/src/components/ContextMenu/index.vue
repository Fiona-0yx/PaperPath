<template>
  <div
    v-show="visible"
    class="context-menu"
    :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
  >
    <div class="menu-item" @click="handleRefresh">
      <img src="@/assets/context-menu/shuaxin.png" alt="" srcset="" />
      刷新页面
    </div>
    <div class="menu-item" @click="handleBack">
      <img src="@/assets/context-menu/xiangzuo.png" alt="" srcset="" />
      返回上页
    </div>
    <div class="menu-item" @click="handleForward">
      <img src="@/assets/context-menu/xiangyou.png" alt="" srcset="" />
      前进下页
    </div>
    <div class="menu-item" @click="handleCopyUrl">
      <img src="@/assets/context-menu/fuzhi1.png" alt="" srcset="" />
      复制链接
    </div>
    <div class="menu-item" @click="toggleTheme">
      <img :src="isDark ? lightIcon : darkIcon" alt="切换主题" />
      {{ isDark ? "浅色模式" : "深色模式" }}
    </div>
    <div class="menu-item" @click="() => router.push('/link/list')">
      <img src="@/assets/context-menu/link.png" alt="" srcset="" />
      添加友链
    </div>
    <div class="menu-item" @click="handleRandomClick">
      <img src="@/assets/context-menu/suiji.png" alt="随便逛逛" />
      随便逛逛
    </div>
    <div class="menu-item" @click="() => router.push('/category')">
      <img src="@/assets/context-menu/fenlei.png" alt="" srcset="" />
      全部分类
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from "vue";
import http from "@/config/request.js";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { staticData } from "@/store/index.js";
const staticStore = staticData();
const { mainTheme } = storeToRefs(staticStore);
const articles = ref([]);
const isDark = computed(() => mainTheme.value);
const lightIcon = new URL("@/assets/context-menu/qiansemoshi.png", import.meta.url).href;
const darkIcon = new URL("@/assets/context-menu/shensemoshi.png", import.meta.url).href;
const visible = ref(false);
const x = ref(0);
const y = ref(0);
const menuWidth = ref(0);
const menuHeight = ref(0);
const router = useRouter();

const adjustedX = computed(() => {
  const windowWidth = window.innerWidth;
  return x.value + menuWidth.value > windowWidth ? x.value - menuWidth.value : x.value;
});

const adjustedY = computed(() => {
  const windowHeight = window.innerHeight;
  return y.value + menuHeight.value > windowHeight ? y.value - menuHeight.value : y.value;
});

const show = (event) => {
  event.preventDefault();
  x.value = event.clientX;
  y.value = event.clientY;
  visible.value = true;

  nextTick(() => {
    const el = document.querySelector(".context-menu");
    if (el) {
      menuWidth.value = el.offsetWidth;
      menuHeight.value = el.offsetHeight;
    }
  });
};

const hide = () => {
  visible.value = false;
};

const handleRefresh = () => {
  window.location.reload();
  hide();
};

const handleBack = () => {
  router.back();
  hide();
};

const handleForward = () => {
  router.forward();
  hide();
};

const handleCopyUrl = () => {
  navigator.clipboard.writeText(window.location.href);
  ElMessage.success("链接已复制到剪贴板");
  hide();
};

const toggleTheme = () => {
  staticStore.switchMainTheme();
  hide();
};

defineExpose({
  show,
  hide,
});

// 获取文章列表
async function fetchArticles() {
  try {
    const res = await http.get("/api/article/blogHomeGetArticleList/1/999");
    if (res.code === 0) {
      articles.value = res.result.list;
    } else {
      console.error("获取文章列表失败:", res.result.message);
    }
  } catch (error) {
    console.error("获取文章列表失败:", error);
  }
}

// 随机获取一个文章 ID
function getRandomArticleId() {
  if (articles.value.length > 0) {
    const randomIndex = Math.floor(Math.random() * articles.value.length);
    return articles.value[randomIndex].id;
  }
  return null;
}

// 点击事件处理函数
async function handleRandomClick() {
  if (articles.value.length === 0) {
    await fetchArticles();
  }
  const id = getRandomArticleId();
  if (id) {
    router.push(`/article?id=${id}`);
  } else {
    console.error("没有可用的文章 ID");
  }
}
// 初始化获取文章列表
onMounted(fetchArticles);
</script>

<style scoped>
.context-menu {
  width: 130px;
  position: fixed;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 5px 0;
  z-index: 2000;
}

img {
  width: 20px;
  height: 20px;
}

.current-song-title {
  max-width: 100%;
  font-size: 14px;
  text-align: center;
  /* 根据需要你可以改为固定宽度 */
  max-height: 40px;
  /* 限制显示高度 */
  overflow: hidden;
  /* 超出隐藏 */
  white-space: nowrap;
  /* 不换行 */
  text-overflow: ellipsis;
  /* 超出显示省略号 */
  line-height: 40px;
  /* 让文本垂直居中看起来更整齐 */
}

.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.menu-item img {
  margin-left: 7px;
}

.menu-item:hover {
  background-color: var(--hover-bg);
}

.menu-item i {
  width: 14px;
}

.divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 5px 0;
}
</style>
