# Mindy — Media Kit (Brand Guidelines)

## Logo
**Primary (stacked):** `logos/mindy_logo_stacked_color.png`  
**Alternate (horizontal):** `logos/mindy_logo_horizontal_color.png`  
**Icon:** `logos/mindy_icon_color.png`  

### Clear space
Keep at least **1× the dot height** (the dot over the *i*) of clear space on all sides.

### Minimum size
- Stacked logo: **120px** wide minimum (digital)
- Icon: **24px** minimum

### Do
- Use the full‑color logo on white/light backgrounds
- Use the white logo on Mindy Pink or dark backgrounds

### Don’t
- Stretch or skew
- Change colors
- Add drop shadows or outlines
- Place on busy imagery without a solid overlay

## Color
| Name | Hex | RGB | Usage |
|---|---|---|---|
| Mindy Pink | **#E81068** | 232, 16, 104 | Primary brand accent / buttons |
| Mindy Gray | **#505050** | 80, 80, 80 | Text / wordmark / UI neutrals |
| White | **#FFFFFF** | 255, 255, 255 | Background |

### Suggested tints
- Pink 90%: #F03A83
- Pink 70%: #F36AA0
- Gray 80%: #666666
- Gray 20%: #CCCCCC

## Typography
The wordmark reads well with a **slab/serif** feel. A clean web pairing:
- Headlines: **Roboto Slab** (600–700)
- Body/UI: **Inter** (400–600)

### CSS tokens
```css
:root {
  --mindy-pink: #E81068;
  --mindy-gray: #505050;
  --mindy-bg: #FFFFFF;

  --font-head: "Roboto Slab", ui-serif, Georgia, serif;
  --font-body: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}

h1,h2,h3 { font-family: var(--font-head); }
body { font-family: var(--font-body); color: var(--mindy-gray); }
.btn-primary { background: var(--mindy-pink); color: white; }
```

## Included assets
- Transparent PNG logos (stacked + horizontal)
- Icon PNGs + favicon.ico
- Black/white logo variants
- Social images (OG + square)

