// Public library surface. Import these to render images to terminal art from
// your own code; the CLI in cli.ts is a thin wrapper over them.
export { renderToLines, renderToString, parseHex } from "./render.js";
export type { RenderOptions } from "./render.js";
