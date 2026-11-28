<script setup>
import BlogHeader from "./header/blog-header.vue";
import BlogMain from "./main/blog-main.vue";
import BlogFooter from "./footer/blog-footer.vue";
</script>
<template>
  <div class="layout">
    <BlogHeader v-if="!$route.query.paper"></BlogHeader>
    <BlogMain></BlogMain>
    <BlogFooter v-if="!$route.query.paper"></BlogFooter>
  </div>
</template>

<style lang="scss" scoped></style>
