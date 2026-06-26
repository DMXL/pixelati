# How pixelati works

This is the full explanation of the technique behind pixelati. The whole thing comes down to one trick plus a careful pipeline around it.

## The core trick: half-block characters

A terminal cell is roughly twice as tall as it is wide. The `▀` character (upper half block) fills the top half of a cell and leaves the bottom half empty. The key fact is that in a terminal you can set a foreground colour (the ink) and a background colour (behind it) independently.

So one `▀` character can display two pixels stacked vertically:

- Foreground colour paints the top half, which becomes the top pixel.
- Background colour fills the bottom half, which becomes the bottom pixel.

That doubles vertical resolution for free. One row of text encodes two rows of image. With 24-bit truecolor escapes (`\x1b[38;2;R;G;Bm` for foreground and `\x1b[48;2;R;G;Bm` for background) every pixel can be any of about 16 million colours.

## The pipeline

### 1. Decode and downscale

[sharp](https://sharp.pixelplumbing.com/) decodes the input (any format it supports) and resizes it. A full-resolution photo is far too wide for a terminal, so pixelati resizes to the requested width in pixels, where one pixel becomes one column.

The height is computed from the width to preserve the aspect ratio. Because each pixel renders as one column wide and (when paired) one text row tall, pixels end up roughly square on screen, so matching the image's proportions in pixels keeps it looking correct. The pixel height is forced to be even so the rows pair cleanly into half blocks. sharp does the resampling (a good quality filter), which keeps edges smooth.

### 2. Pair rows into half-blocks

Walk the pixel grid two image rows at a time. For each column, look at the top and bottom pixel and choose what to emit based on transparency:

| Top pixel | Bottom pixel | Output |
|---|---|---|
| opaque | opaque | `▀` with foreground = top, background = bottom |
| opaque | transparent | `▀` with foreground = top only |
| transparent | opaque | `▄` (lower half block) with foreground = bottom |
| transparent | transparent | a plain space |

That last row is what gives a clean transparent background: nothing is drawn, so the terminal's own background shows through. A pixel counts as transparent only when its alpha is at or below the threshold (128 by default), which prevents faint semi-transparent edge pixels from turning into noise.

### 3. Optional background compositing

When a background colour is given, there is no transparency to preserve. Every pixel is alpha-composited over that colour (`result = pixel × alpha + background × (1 − alpha)`), and every cell is emitted as an opaque `▀` with a foreground and a background. This is useful when you want a solid rectangle rather than a cut-out shape.

### 4. Trimming and output

Runs of blank cells are deferred while building each line, so a transparent right edge does not bloat the output with trailing spaces and escape codes, while interior gaps stay aligned. The result is an array of strings, one per text row, which can be printed directly or joined and written to a file.

## Verifying the output

Escape-code soup is impossible to judge by eye. A reliable way to check a render is to round-trip it: run the same downscale and, instead of emitting characters, draw each target pixel as a magnified block into a small image, then open that image. Because each half-block cell corresponds to exactly one pixel, what the image shows is what the terminal will show. This makes it easy to compare resampling choices or confirm small details survived before trusting the terminal output.

## Baking

Rendering returns plain strings, so a program can bake the art into a generated source file once and ship it. The running program then prints the pre-rendered lines and needs no image library at all. This is how you put a logo or splash banner into a CLI without adding a runtime dependency: render at build time, commit the strings, print them at runtime.

## Limitations

- The terminal must support truecolor. Most modern terminals do.
- Output width is bounded by the terminal width. Very wide images are best viewed at a chosen `--width` and scrolled, or scaled down.
- Half blocks assume a cell aspect ratio near 1:2. Unusual fonts or line spacing can stretch the result slightly.
