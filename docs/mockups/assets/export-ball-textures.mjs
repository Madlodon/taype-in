// Export the actual garage artwork; no second copy of its palettes or panel paths.
import { build } from "esbuild";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const directory = join(tmpdir(), "taype-garage-ball-textures");
await mkdir(directory, { recursive: true });
const modulePath = join(directory, "garage-balls.cjs");
await build({
  stdin: {
    contents: `import { renderToStaticMarkup } from "react-dom/server";
      import { CarBall } from "./docs/mockups/previous-car-ball";
      export { BALLS } from "./lib/garage-items";
      export function renderBall(ball) {
        return renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-16 -16 32 32"><CarBall ball={ball} centered /></svg>);
      }`,
    resolveDir: root, loader: "tsx",
  },
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile: modulePath,
});
const { BALLS, renderBall } = createRequire(import.meta.url)(modulePath);
for (const ball of BALLS) {
  await sharp(Buffer.from(renderBall(ball))).png().toFile(join(directory, `${ball}.png`));
}
await writeFile(join(directory, "balls.json"), JSON.stringify(BALLS));
console.log(directory);
