import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const sceneRoot = fileURLToPath(new URL("../../复杂前端/lun-path/", import.meta.url));

// The original server mounts public, src and shared at its document root.
// Recreate that layout under the blog, preserving the standalone source files.
export async function prepareLunPath(publicDir) {
  const destination = join(publicDir, "lun-path");
  async function copyDirectory(source, folder) {
    await mkdir(join(destination, folder), { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const file = posix.join(folder, entry.name);
      const input = join(source, entry.name);
      const output = join(destination, file);
      if (file === "vendor" || file === "scenes/machine-learning-shelf.html" || file === "assets/shelf") continue;
      if (entry.isDirectory()) {
        await copyDirectory(input, file);
      } else if (/\.(html|js|css)$/.test(file) && !file.endsWith(".min.js")) {
        // DOM URLs in JS are resolved against the consuming HTML document.
        const shellModule = ["src/app.js", "src/grove.js"].includes(file);
        const context = file.endsWith(".js") ? (shellModule ? "." : "scenes") : folder;
        const prefix = (posix.relative(context || ".", ".") || ".") + "/";
        const original = await readFile(input, "utf8");
        const embedded = original
          .replace(/(["'(`])\/(?=(?:assets|scenes|shared|src)\/|(?:base\.css|grove\.css|shelf\.css|favicon\.svg)["'])/g, "$1" + prefix)
          .replace(/(["'])\/#\//g, "$1" + prefix + "index.html#/");
        await writeFile(output, embedded);
      } else {
        await cp(input, output);
      }
    }
  }
  await copyDirectory(join(sceneRoot, "public"), "");
  for (const folder of ["src", "shared"]) await copyDirectory(join(sceneRoot, folder), folder);
}
