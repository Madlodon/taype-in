import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const source = dirname(fileURLToPath(import.meta.url));
export const previewDirectory = join(tmpdir(), "taype-arena-preview");

export async function buildPreview() {
  await mkdir(previewDirectory, { recursive: true });
  await build({
    entryPoints: [join(source, "arena-preview.tsx")], bundle: true, minify: true,
    outfile: join(previewDirectory, "arena-preview.js"), jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "preview-car-only",
      setup(build) {
        build.onResolve({ filter: /^@\/components\/field-car$/ }, () => ({ path: join(source, "arena-preview-car.tsx") }));
      },
    }],
  });
  await cp(join(source, "7-arena-sprite-preview.html"), join(previewDirectory, "7-arena-sprite-preview.html"));
  await cp(join(source, "assets/arena-preview"), join(previewDirectory, "assets/arena-preview"), { recursive: true });
  await cp(resolve(source, "../../public/stadiums"), join(previewDirectory, "stadiums"), { recursive: true });
  return previewDirectory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildPreview());
}
