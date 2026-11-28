<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Waves from "@/components/WelcomeComps/waves.vue";

const hero = ref(null);
const scene = ref(null);
let motion;

function applyVineZoom(progress) {
  const grove = scene.value?.contentDocument?.getElementById("grove-frame");
  const scale = 1 + 0.24 * (1 - (1 - progress) ** 2);
  grove?.contentDocument?.documentElement.style.setProperty("--blog-vine-scale", scale);
}

gsap.registerPlugin(ScrollTrigger);
onMounted(() => {
  motion = gsap.matchMedia();
  motion.add("(prefers-reduced-motion: no-preference)", () => {
    const trigger = ScrollTrigger.create({
      trigger: hero.value,
      start: "top top",
      end: "55% top",
      onUpdate: ({ progress }) => applyVineZoom(progress),
      onRefresh: ({ progress }) => applyVineZoom(progress),
    });
    const iframe = scene.value;
    const onSceneLoad = () => applyVineZoom(trigger.progress);
    iframe.addEventListener("load", onSceneLoad);
    return () => {
      iframe.removeEventListener("load", onSceneLoad);
      applyVineZoom(0);
    };
  });
});
onBeforeUnmount(() => motion?.revert());
</script>

<template>
  <div id="home" ref="hero">
    <iframe
      ref="scene"
      name="blog-home-grove"
      title="论径 · 藤蔓探索与论文阅读"
      src="./lun-path/index.html#/home"
    ></iframe>
    <Waves class="home-waves" />
  </div>
</template>

<style lang="scss" scoped>
#home {
  position: relative;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  background: #4a4d44;

  iframe {
    position: absolute;
    top: 52px;
    width: 100%;
    height: calc(100% - 52px);
    border: 0;
  }

  .home-waves {
    pointer-events: none;
  }
}
</style>
