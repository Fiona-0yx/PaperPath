# 定义工作目录
ARG PROJECT_DIR=/blog-server
# 使用官方的 Node.js 运行时镜像作为基础镜像
FROM node:18.17.0-alpine AS builder
ARG PROJECT_DIR

# 设置工作目录
WORKDIR $PROJECT_DIR

COPY . .

# 安装项目依赖
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

# 暴露应用的端口
EXPOSE 8888

# 启动
CMD ["npm", "run", "serve"]
