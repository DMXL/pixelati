import sharp from "sharp";

// The core of pixelati. A terminal cell is roughly twice as tall as it is wide,
// and ANSI lets us set a foreground and a background colour independently. The
// "▀" (upper half block) fills the top half of a cell with the foreground while
// the background shows through the bottom half, so a single character encodes
// two vertically stacked pixels. That doubles vertical resolution for free and,
// with 24-bit truecolour escapes, every pixel can be any colour. Transparent
// pixels are left blank so the terminal background shows through.

export interface RenderOptions {
  /** Target width in terminal columns (one column per source pixel). */
  width?: number;
  /** Alpha cutoff (0-255). Pixels at or below this are treated as transparent. */
  threshold?: number;
  /**
   * Hex colour (e.g. "#1e1e2e") to composite the image onto. When set, the
   * result is fully opaque (no transparent gaps); when omitted, transparent
   * pixels render as blanks.
   */
  background?: string;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const RESET = "\x1b[0m";
const UPPER_HALF = "▀";
const LOWER_HALF = "▄";

const fg = (p: RGBA): string => `\x1b[38;2;${p.r};${p.g};${p.b}m`;
const bg = (p: RGBA): string => `\x1b[48;2;${p.r};${p.g};${p.b}m`;

const DEFAULT_WIDTH = 80;
const DEFAULT_THRESHOLD = 128;

/** Parse "#rgb" or "#rrggbb" (with or without the leading #) into an RGBA. */
export function parseHex(hex: string): RGBA {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex colour: "${hex}"`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 255,
  };
}

/** Alpha-composite `top` over the opaque `base`. */
function composite(top: RGBA, base: RGBA): RGBA {
  const a = top.a / 255;
  return {
    r: Math.round(top.r * a + base.r * (1 - a)),
    g: Math.round(top.g * a + base.g * (1 - a)),
    b: Math.round(top.b * a + base.b * (1 - a)),
    a: 255,
  };
}

/**
 * Render an image (any format sharp can decode) to an array of ANSI lines, one
 * string per text row. Two image rows are encoded per line via half blocks.
 */
export async function renderToLines(
  input: string | Buffer,
  opts: RenderOptions = {}
): Promise<string[]> {
  const width = Math.max(1, Math.floor(opts.width ?? DEFAULT_WIDTH));
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const base = opts.background ? parseHex(opts.background) : null;

  const pipeline = sharp(input);
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read image dimensions.");
  }

  // Preserve aspect ratio. Each pixel is one column wide and (paired) one text
  // row holds two pixels, so square pixels keep the picture's proportions.
  let height = Math.max(2, Math.round(width * (meta.height / meta.width)));
  if (height % 2 === 1) height += 1; // even rows pair cleanly into half blocks

  const { data, info } = await pipeline
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cols = info.width;
  const rows = info.height;
  const at = (x: number, y: number): RGBA => {
    const i = (y * cols + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  };

  const opaque = (p: RGBA): boolean => p.a > threshold;
  const lines: string[] = [];

  for (let y = 0; y + 1 < rows; y += 2) {
    let line = "";
    let pendingBlanks = "";
    for (let x = 0; x < cols; x++) {
      let top = at(x, y);
      let bottom = at(x, y + 1);

      if (base) {
        // Composite over the background: every cell becomes opaque.
        const t = composite(top, base);
        const b = composite(bottom, base);
        line += `${fg(t)}${bg(b)}${UPPER_HALF}${RESET}`;
        continue;
      }

      const topOn = opaque(top);
      const bottomOn = opaque(bottom);
      let cell: string;
      if (!topOn && !bottomOn) {
        cell = " ";
      } else if (topOn && bottomOn) {
        cell = `${fg(top)}${bg(bottom)}${UPPER_HALF}${RESET}`;
      } else if (topOn) {
        cell = `${fg(top)}${UPPER_HALF}${RESET}`;
      } else {
        cell = `${fg(bottom)}${LOWER_HALF}${RESET}`;
      }

      // Defer runs of blanks so a transparent right edge does not bloat the
      // line with trailing spaces, while interior gaps stay aligned.
      if (cell === " ") {
        pendingBlanks += " ";
      } else {
        line += pendingBlanks + cell;
        pendingBlanks = "";
      }
    }
    lines.push(line);
  }

  return lines;
}

/** Convenience wrapper returning the rendered art as a single string. */
export async function renderToString(
  input: string | Buffer,
  opts: RenderOptions = {}
): Promise<string> {
  return (await renderToLines(input, opts)).join("\n");
}
