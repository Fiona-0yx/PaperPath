import express from "express";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readerMiddleware } from "../复杂前端/lun-path/server/index.mjs";

export const app = express();

const port = Number(process.env.PORT || 8080);

app.use(readerMiddleware);
app.use(express.static(fileURLToPath(new URL("./dist/", import.meta.url))));

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  app.listen(port, () => console.log(`服务器 ${port} 开启成功!`));
}
