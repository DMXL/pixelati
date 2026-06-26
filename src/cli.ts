#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { renderToLines, type RenderOptions } from "./render.js";

// Thin CLI over the renderer. Usage:
//   pixelati <image> [options]
// Prints truecolor terminal art to stdout, or writes it to a file with -o.

interface Args {
  input?: string;
  width?: number;
  threshold?: number;
  background?: string;
  output?: string;
  help?: boolean;
}

const HELP = `pixelati — turn any image into truecolor terminal art

Usage:
  pixelati <image> [options]

Options:
  -w, --width <n>        Output width in columns (default: terminal width or 80)
  -t, --threshold <n>    Alpha cutoff 0-255; at or below is transparent (default: 128)
  -b, --background <hex> Composite onto this colour instead of leaving gaps (e.g. #1e1e2e)
  -o, --output <file>    Write the art to a file instead of stdout
  -h, --help             Show this help

Examples:
  pixelati logo.png
  pixelati photo.jpg -w 60
  pixelati icon.png -b "#000000"
  pixelati banner.png -w 100 -o banner.ans
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-w":
      case "--width":
        args.width = Number(next());
        break;
      case "-t":
      case "--threshold":
        args.threshold = Number(next());
        break;
      case "-b":
      case "--background":
        args.background = next();
        break;
      case "-o":
      case "--output":
        args.output = next();
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
        if (args.input) throw new Error(`Unexpected extra argument: ${a}`);
        args.input = a;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.input) {
    process.stdout.write(HELP);
    process.exit(args.input ? 0 : 1);
  }

  if (args.width !== undefined && (!Number.isFinite(args.width) || args.width < 1)) {
    throw new Error("--width must be a positive number");
  }
  if (
    args.threshold !== undefined &&
    (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 255)
  ) {
    throw new Error("--threshold must be between 0 and 255");
  }

  const opts: RenderOptions = {
    width: args.width ?? process.stdout.columns ?? 80,
    threshold: args.threshold,
    background: args.background,
  };

  const lines = await renderToLines(args.input, opts);

  if (args.output) {
    await writeFile(args.output, lines.join("\n") + "\n");
    process.stderr.write(`Wrote ${lines.length} rows to ${args.output}\n`);
  } else {
    process.stdout.write(lines.join("\n") + "\n");
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`pixelati: ${msg}\n`);
  process.exit(1);
});
