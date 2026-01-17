# Styling Guide

Comprehensive styling specification for Legislators Chat. This document serves as the manifest for all UI/UX decisions.

---

## Design Philosophy

- **Dark-first**: Dark mode as the default, with optional light mode
- **Minimal & Focused**: Clean interface that emphasizes content over chrome
- **Accessible**: WCAG 2.1 AA compliant, high contrast ratios
- **Responsive**: Mobile-first design that scales gracefully
- **Consistent**: Unified design language across all components

---

## Color System

### Base Colors (Slate Theme)

Using shadcn/ui Slate color palette for a sophisticated, professional look.

```css
/* Dark Mode (Default) */
--background: 222.2 84% 4.9%;      /* Near-black background */
--foreground: 210 40% 98%;          /* Off-white text */

--card: 222.2 84% 4.9%;
--card-foreground: 210 40% 98%;

--popover: 222.2 84% 4.9%;
--popover-foreground: 210 40% 98%;

--primary: 210 40% 98%;             /* Primary actions */
--primary-foreground: 222.2 47.4% 11.2%;

--secondary: 217.2 32.6% 17.5%;     /* Secondary elements */
--secondary-foreground: 210 40% 98%;

--muted: 217.2 32.6% 17.5%;         /* Muted backgrounds */
--muted-foreground: 215 20.2% 65.1%;

--accent: 217.2 32.6% 17.5%;        /* Accent elements */
--accent-foreground: 210 40% 98%;

--destructive: 0 62.8% 30.6%;       /* Error/destructive */
--destructive-foreground: 210 40% 98%;

--border: 217.2 32.6% 17.5%;
--input: 217.2 32.6% 17.5%;
--ring: 212.7 26.8% 83.9%;
```

### Semantic Colors

```css
/* Stance Indicators */
--stance-for: 142 76% 36%;          /* Green - supports */
--stance-against: 0 84% 60%;        /* Red - opposes */
--stance-mixed: 45 93% 47%;         /* Yellow - mixed/unclear */
--stance-unknown: 215 20% 65%;      /* Gray - unknown */

/* Party Colors */
--party-democrat: 217 91% 60%;      /* Blue */
--party-republican: 0 84% 60%;      /* Red */
--party-independent: 271 81% 56%;   /* Purple */

/* Status Colors */
--success: 142 76% 36%;
--warning: 45 93% 47%;
--error: 0 84% 60%;
--info: 217 91% 60%;
```

---

## Typography

### Font Stack

```css
--font-sans: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `text-xs` | 12px | 400 | 1.5 | Captions, labels |
| `text-sm` | 14px | 400 | 1.5 | Secondary text, metadata |
| `text-base` | 16px | 400 | 1.6 | Body text, chat messages |
| `text-lg` | 18px | 500 | 1.5 | Subheadings |
| `text-xl` | 20px | 600 | 1.4 | Section headings |
| `text-2xl` | 24px | 600 | 1.3 | Page headings |
| `text-3xl` | 30px | 700 | 1.2 | Hero headings |

### Font Weights

- **Regular (400)**: Body text, descriptions
- **Medium (500)**: Labels, subheadings
- **Semibold (600)**: Headings, emphasis
- **Bold (700)**: Strong emphasis, hero text

---

## Spacing

Using Tailwind's default spacing scale (1 unit = 4px):

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing, inline elements |
| `space-2` | 8px | Component internal padding |
| `space-3` | 12px | Between related elements |
| `space-4` | 16px | Standard component padding |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Large section gaps |
| `space-12` | 48px | Page sections |
| `space-16` | 64px | Major layout divisions |

---

## Layout

### Container Widths

```css
--container-sm: 640px;   /* Narrow content */
--container-md: 768px;   /* Medium content */
--container-lg: 1024px;  /* Standard content */
--container-xl: 1280px;  /* Wide content */
--container-2xl: 1536px; /* Full-width */
```

### Grid System

- **Desktop**: 12-column grid with 24px gutters
- **Tablet**: 8-column grid with 20px gutters
- **Mobile**: 4-column grid with 16px gutters

### Chat Layout

```
Desktop (>= 1024px):
┌────────────────────────────────────────────────┐
│                    Header                       │
├─────────────────────────┬──────────────────────┤
│                         │                       │
│      Chat Area          │    Results Panel     │
│        (60%)            │       (40%)          │
│                         │                       │
├─────────────────────────┴──────────────────────┤
│                  Chat Input                     │
└────────────────────────────────────────────────┘

Mobile (< 768px):
┌────────────────────────┐
│        Header          │
├────────────────────────┤
│                        │
│      Chat Area         │
│                        │
├────────────────────────┤
│   Results (Collapsed)  │
├────────────────────────┤
│      Chat Input        │
└────────────────────────┘
```

---

## Components

### Buttons

```
Primary Button:
- Background: var(--primary)
- Text: var(--primary-foreground)
- Hover: opacity 90%
- Border-radius: 6px
- Padding: 8px 16px
- Height: 40px (default), 36px (sm), 44px (lg)

Secondary Button:
- Background: var(--secondary)
- Text: var(--secondary-foreground)
- Border: 1px solid var(--border)

Ghost Button:
- Background: transparent
- Hover: var(--accent)

Destructive Button:
- Background: var(--destructive)
- Text: var(--destructive-foreground)
```

### Cards

```
Standard Card:
- Background: var(--card)
- Border: 1px solid var(--border)
- Border-radius: 8px
- Padding: 16px
- Shadow: none (flat design for dark mode)

Hover State:
- Border-color: var(--ring)
- Transition: 150ms ease
```

### Chat Bubbles

```
User Message:
- Background: var(--primary)
- Text: var(--primary-foreground)
- Border-radius: 16px 16px 4px 16px
- Max-width: 80%
- Alignment: right

AI Message:
- Background: var(--muted)
- Text: var(--foreground)
- Border-radius: 16px 16px 16px 4px
- Max-width: 80%
- Alignment: left
```

### Badges

```
Stance Badge:
- Border-radius: 9999px (pill)
- Padding: 4px 12px
- Font-size: 12px
- Font-weight: 500

Colors by stance:
- For: bg-green-900/50, text-green-400, border-green-700
- Against: bg-red-900/50, text-red-400, border-red-700
- Mixed: bg-yellow-900/50, text-yellow-400, border-yellow-700
- Unknown: bg-slate-800, text-slate-400, border-slate-700

Party Badge:
- Same shape as stance
- D: bg-blue-900/50, text-blue-400
- R: bg-red-900/50, text-red-400
- I: bg-purple-900/50, text-purple-400
```

### Inputs

```
Text Input:
- Background: var(--input)
- Border: 1px solid var(--border)
- Border-radius: 6px
- Padding: 8px 12px
- Focus: ring-2 ring-ring ring-offset-2

Chat Input (Textarea):
- Min-height: 44px
- Max-height: 200px
- Auto-resize
- Submit button integrated
```

---

## Animations

### Framer Motion Defaults

```typescript
// Fade in
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

// Slide up
const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 }
};

// Scale in
const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.15 }
};

// Stagger children
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};
```

### Timing

- **Instant**: 0ms (color changes)
- **Fast**: 100-150ms (buttons, hovers)
- **Normal**: 200-300ms (modals, panels)
- **Slow**: 400-500ms (page transitions)

### Easing

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Shadows

Minimal shadows for dark mode (shadows are subtle on dark backgrounds):

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

In dark mode, prefer using borders or subtle background changes over shadows.

---

## Border Radius

```css
--radius-sm: 4px;    /* Small elements */
--radius: 6px;       /* Buttons, inputs */
--radius-md: 8px;    /* Cards */
--radius-lg: 12px;   /* Modals, large cards */
--radius-xl: 16px;   /* Chat bubbles */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Breakpoints

```css
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

---

## Icons

Using [Lucide Icons](https://lucide.dev/) (included with shadcn/ui):

- **Size**: 16px (sm), 20px (md), 24px (lg)
- **Stroke width**: 1.5px (default), 2px (bold)
- **Color**: currentColor (inherits text color)

Common icons:
- Send: `Send`
- User: `User`
- Bot/AI: `Bot` or `Sparkles`
- Phone: `Phone`
- Email: `Mail`
- External link: `ExternalLink`
- Menu: `Menu`
- Close: `X`
- Loading: `Loader2` (with spin animation)

---

## Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 50;
--z-sticky: 100;
--z-fixed: 150;
--z-modal-backdrop: 200;
--z-modal: 250;
--z-popover: 300;
--z-tooltip: 400;
--z-toast: 500;
```

---

## Accessibility

### Focus States

All interactive elements must have visible focus indicators:

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Color Contrast

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Dark/Light Mode

### Implementation

```typescript
// Theme provider wraps the app
// Default to 'dark', with system preference detection

<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

### Toggle Behavior

- Persisted to localStorage
- Falls back to system preference
- No flash of wrong theme on load

---

## Do's and Don'ts

### Do

- Use semantic color variables, not raw values
- Maintain consistent spacing (use Tailwind classes)
- Test all states (hover, focus, disabled, loading)
- Ensure sufficient contrast
- Use motion purposefully (enhance, don't distract)

### Don't

- Use pure black (#000) or pure white (#fff)
- Mix padding/margin values inconsistently
- Skip focus states for interactive elements
- Animate everything (especially on mobile)
- Use shadows heavily in dark mode
