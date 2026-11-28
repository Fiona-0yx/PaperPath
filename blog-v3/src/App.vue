<script setup>
import { ref, computed, onMounted, h, onBeforeUnmount } from "vue";
import { isMobile, getWelcomeSay } from "@/utils/tool";
import { addView, getAllPageHeader } from "@/api/config";
import { useRoute, useRouter } from "vue-router";
import { ElNotification } from "element-plus";

import { storeToRefs } from "pinia";
import { user, staticData } from "@/store/index.js";

import MusicPlayer from "@/components/Music/index";
import BackTop from "@/components/BackTop/index";
import ChatRoom from "@/components/ChatRoom/index";
import ContextMenu from "@/components/ContextMenu/index.vue";

const userStore = user();
const router = useRouter();
const route = useRoute();
const blogTools = computed(() => route.matched.length > 0 && !route.query.paper);
const { getUserInfo } = storeToRefs(userStore);
const isPc = ref(true);
const ContextMenuRef = ref(null);

const goBack = () => {
  router.go(-1);
};

// 获取所有的网站页面背景图
const getAllPageHeaderBg = async () => {
  const res = await getAllPageHeader();
  if (res.code == 0) {
    staticData().setPageHeaderLIst(res.result);
  } else {
    ElNotification({
      offset: 60,
      title: "错误提示",
      message: h("div", { style: "color: #f56c6c; font-weight: 600;" }, res.message),
    });
  }
};

const welcome = () => {
  // 欢迎
  let msg = getWelcomeSay(getUserInfo.value.nick_name);
  if (getUserInfo.value.id == 3) {
    msg = "小婷光临，真是三生有幸";
  }
  ElNotification({
    offset: 60,
    title: "欢迎～",
    message: h("div", { style: "font-weight: 600;" }, msg),
  });
};

const handleContextMenu = (e) => {
  if(route.query.paper)return;
  ContextMenuRef.value?.show(e);
};

const handleClick = () => {
  ContextMenuRef.value?.hide();
};

onMounted(async () => {
  isPc.value = !isMobile();
  document.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("click", handleClick);

  await router.isReady();
  if (route.path === "/article" && route.query.paper) return;
  await addView();
  if (window.name == "") {
    // 获取背景图片
    getAllPageHeaderBg();
    welcome();
  }

});

onBeforeUnmount(() => {
  document.removeEventListener("contextmenu", handleContextMenu);
  document.removeEventListener("click", handleClick);
});
</script>

<template>
  <div class="app">
    <router-view></router-view>
    <BackTop v-if="route.path !== '/' && !route.query.paper" :right="isPc ? 3 : 0" />
    <i
      v-if="!isPc && ['home', '/'].includes(route.path)"
      class="iconfont icon-fanhui"
      @click="goBack"
    ></i>
    <MusicPlayer v-if="blogTools" />
    <ChatRoom :isPc="isPc" v-if="blogTools && route.path !== '/'" />
    <ContextMenu v-if="blogTools" ref="ContextMenuRef" />
  </div>
</template>

<style lang="scss">
.app {
  width: 100%;
  box-sizing: border-box;
}

.icon-fanhui {
  position: fixed;
  left: 5px;
  top: 60px;
  font-size: 2.2rem;
  color: var(--font-color);
  z-index: 999;
}
</style>
