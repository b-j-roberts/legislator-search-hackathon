# Styles Guide

## Color System

### Base Colors (Zinc Gray Scale)

The application uses Tailwind's zinc gray scale for neutral colors:

| Token              | Light Mode | Dark Mode  | Usage                 |
| ------------------ | ---------- | ---------- | --------------------- |
| `background`       | `zinc-50`  | `zinc-950` | Page background       |
| `foreground`       | `zinc-950` | `zinc-50`  | Primary text          |
| `card`             | `white`    | `zinc-900` | Card backgrounds      |
| `muted`            | `zinc-100` | `zinc-800` | Secondary backgrounds |
| `muted-foreground` | `zinc-500` | `zinc-400` | Secondary text        |
| `border`           | `zinc-200` | `zinc-800` | Borders and dividers  |

### Accent Colors (Blue)

Professional, civic-themed blue for primary actions:

| Token                | Value      | Usage                  |
| -------------------- | ---------- | ---------------------- |
| `primary`            | `blue-600` | Primary buttons, links |
| `primary-foreground` | `white`    | Text on primary        |
| `primary-hover`      | `blue-700` | Hover states           |

### Semantic Colors

| Token         | Value       | Usage                        |
| ------------- | ----------- | ---------------------------- |
| `destructive` | `red-600`   | Error states, delete actions |
| `success`     | `green-600` | Success states               |
| `warning`     | `amber-500` | Warning states               |

### Party Colors

| Party       | Color  | Tailwind Class  |
| ----------- | ------ | --------------- |
| Democrat    | Blue   | `bg-blue-600`   |
| Republican  | Red    | `bg-red-600`    |
| Independent | Purple | `bg-purple-600` |

## Typography

### Font Family

The application uses the Geist font family (loaded via `next/font`):

- **Geist Sans**: Primary text
- **Geist Mono**: Code, numbers

### Type Scale

| Class       | Size | Line Height | Usage            |
| ----------- | ---- | ----------- | ---------------- |
| `text-xs`   | 12px | 16px        | Captions, badges |
| `text-sm`   | 14px | 20px        | Secondary text   |
| `text-base` | 16px | 24px        | Body text        |
| `text-lg`   | 18px | 28px        | Lead paragraphs  |
| `text-xl`   | 20px | 28px        | Card titles      |
| `text-2xl`  | 24px | 32px        | Section headings |
| `text-3xl`  | 30px | 36px        | Page titles      |
| `text-4xl`  | 36px | 40px        | Hero titles      |

### Font Weights

| Class           | Weight | Usage              |
| --------------- | ------ | ------------------ |
| `font-normal`   | 400    | Body text          |
| `font-medium`   | 500    | Buttons, labels    |
| `font-semibold` | 600    | Headings, emphasis |
| `font-bold`     | 700    | Strong emphasis    |

## Spacing

### Spacing Scale

Follow Tailwind's default spacing scale (4px base unit):

| Token | Value | Usage            |
| ----- | ----- | ---------------- |
| `1`   | 4px   | Tight spacing    |
| `2`   | 8px   | Element gaps     |
| `3`   | 12px  | Small padding    |
| `4`   | 16px  | Standard padding |
| `6`   | 24px  | Section gaps     |
| `8`   | 32px  | Large gaps       |
| `12`  | 48px  | Section margins  |
| `16`  | 64px  | Page sections    |

### Component Spacing

| Component | Padding     | Gap                |
| --------- | ----------- | ------------------ |
| Button    | `px-4 py-2` | -                  |
| Card      | `p-6`       | -                  |
| Input     | `px-3 py-2` | -                  |
| Grid      | -           | `gap-4` or `gap-6` |
| Stack     | -           | `space-y-4`        |

## Component Patterns

### Cards

```tsx
<Card className="bg-card border-border rounded-lg border p-6">
  <CardHeader>
    <CardTitle className="text-xl font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

### Buttons

```tsx
// Primary
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Action
</Button>

// Secondary
<Button variant="outline" className="border-border hover:bg-muted">
  Secondary
</Button>

// Ghost
<Button variant="ghost" className="hover:bg-muted">
  Ghost
</Button>
```

### Badges

```tsx
// Default
<Badge className="bg-muted text-muted-foreground">Tag</Badge>

// Party badges
<Badge className="bg-blue-600 text-white">Democrat</Badge>
<Badge className="bg-red-600 text-white">Republican</Badge>
<Badge className="bg-purple-600 text-white">Independent</Badge>
```

## Animation Guidelines

### Motion Principles

1. **Subtle**: Animations enhance, not distract
2. **Quick**: Most animations under 300ms
3. **Purposeful**: Every animation serves a function

### Common Animations

```tsx
import { motion } from 'motion/react'

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>

// Slide up
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>

// Scale on hover
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>

// Stagger children
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.05 } }
  }}
>
```

### Transition Timing

| Type              | Duration  | Easing        |
| ----------------- | --------- | ------------- |
| Micro-interaction | 100-150ms | `ease-out`    |
| Standard          | 200-300ms | `ease-in-out` |
| Complex           | 300-500ms | Custom spring |

## Accessibility

### Color Contrast

- All text meets WCAG 2.1 AA standards (4.5:1 for normal text)
- Interactive elements have visible focus states
- Don't rely on color alone for meaning

### Focus States

```tsx
// Focus ring pattern
className =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
```

### Screen Reader Support

- Use semantic HTML elements
- Include `aria-label` for icon-only buttons
- Announce dynamic content changes with `aria-live`

## Dark Mode Implementation

### Strategy

- Use Tailwind's `class` strategy for dark mode
- CSS variables for theme colors via shadcn/ui
- Default to system preference, user can override

### Usage

```tsx
// Background
className = 'bg-background dark:bg-background'

// Text
className = 'text-foreground dark:text-foreground'

// The variables automatically switch based on .dark class
```

### CSS Variables (globals.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  /* ... */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... */
}
```

## Responsive Design

### Breakpoints

| Prefix | Min Width | Usage            |
| ------ | --------- | ---------------- |
| `sm`   | 640px     | Mobile landscape |
| `md`   | 768px     | Tablet           |
| `lg`   | 1024px    | Desktop          |
| `xl`   | 1280px    | Large desktop    |
| `2xl`  | 1536px    | Extra large      |

### Mobile-First Approach

```tsx
// Stack on mobile, row on desktop
className = 'flex flex-col md:flex-row'

// Full width on mobile, constrained on desktop
className = 'w-full md:max-w-md'

// Hide on mobile, show on desktop
className = 'hidden md:block'
```
