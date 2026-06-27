# pixelati

Turn any image into truecolor terminal art. pixelati renders pictures into the terminal using half-block characters, so each character cell shows two stacked pixels at full 24-bit colour, with transparent areas left blank.

It works as both a command line tool and a small library, and it reads any format [sharp](https://sharp.pixelplumbing.com/) can decode (PNG, JPEG, WebP, GIF, AVIF, TIFF, and more).

## Install

As a CLI:

```bash
npm install -g pixelati
pixelati <image>
```

As a library:

```bash
npm install pixelati
```

```ts
import { renderToLines } from "pixelati";
const lines = await renderToLines("logo.png", { width: 56 });
console.log(lines.join("\n"));
```

This is an ESM-only package and needs Node 18 or newer.

### Local development

```bash
pnpm install
pnpm build       # compiles to dist/
pnpm pixelati <image>   # run from source via tsx
```

## Usage

```bash
pixelati <image> [options]
```

| Option | Description |
|---|---|
| `-w, --width <n>` | Output width in columns. Defaults to the terminal width, or 80 when piped. |
| `-H, --height <n>` | Maximum height in rows. The image is scaled to fit within width × height, preserving aspect, so tall images stay inside the box. |
| `-t, --threshold <n>` | Alpha cutoff from 0 to 255. Pixels at or below it are treated as transparent. Default 128. |
| `-b, --background <hex>` | Composite the image onto this colour instead of leaving transparent gaps (for example `#1e1e2e`). |
| `-T, --trim` | Crop uniform or transparent borders before scaling, so a subject centred in a large canvas (like a sprite) fills the frame instead of rendering tiny. |
| `-o, --output <file>` | Write the art to a file instead of printing it. |
| `-h, --help` | Show help. |

### Examples

```bash
pixelati logo.png                  # render at terminal width
pixelati photo.jpg -w 60           # render 60 columns wide
pixelati icon.png -b "#000000"     # composite onto black, no transparency
pixelati banner.png -w 100 -o banner.ans   # save the escapes to a file
```

The height is derived from the width to preserve the image's aspect ratio, so you only ever set the width.

## Library

```ts
import { renderToLines, renderToString } from "pixelati";

// Array of ANSI strings, one per text row.
const lines = await renderToLines("logo.png", { width: 56 });
console.log(lines.join("\n"));

// Or the whole thing as one string.
const art = await renderToString("logo.png", { width: 56, background: "#101018" });
```

`renderToLines` and `renderToString` accept a file path or a `Buffer`, plus the same options as the CLI (`width`, `threshold`, `background`). Returning lines as an array is handy for baking the art into a generated source file, so a program can ship the rendered banner without any image dependency at runtime.

## How it works

The short version: a terminal cell is about twice as tall as it is wide, and ANSI lets you set a foreground and a background colour per cell independently. The `▀` (upper half block) paints the top half of the cell with the foreground while the background shows through the bottom half, so one character carries two vertically stacked pixels. That doubles vertical resolution, and truecolor escapes give each pixel any of 16 million colours. Transparent pixels become blanks so the terminal background shows through.

For the full walkthrough (downscaling, the transparency cases, aspect ratio, and how to verify the output visually) see [docs/how-it-works.md](./docs/how-it-works.md).

## Requirements

Node.js 18 or newer, and a terminal with truecolor support (most modern terminals: iTerm2, the macOS Terminal in recent versions, Windows Terminal, kitty, Alacritty, WezTerm, and others).

## License

MIT
