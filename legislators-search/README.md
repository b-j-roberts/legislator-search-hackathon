# Legislators Search

A web application for searching US legislators by issues. Find your representatives, understand their stances on topics that matter to you, and get connected.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Component Library**: [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation**: [Motion](https://motion.dev/) (Framer Motion)
- **Linting**: ESLint
- **Formatting**: Prettier

## Prerequisites

- Node.js 18.17 or later
- pnpm 8.0 or later

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Available Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start development server with Turbopack |
| `pnpm build`        | Build for production                    |
| `pnpm start`        | Start production server                 |
| `pnpm lint`         | Run ESLint                              |
| `pnpm format`       | Format code with Prettier               |
| `pnpm format:check` | Check code formatting                   |

## Project Structure

```
legislators-search/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── search/
│   │   │   └── page.tsx        # Search results
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── search-bar.tsx      # Search input
│   │   ├── state-filter.tsx    # State selector
│   │   ├── legislator-card.tsx # Result cards
│   │   └── advanced-filters.tsx# Filter sidebar
│   ├── lib/
│   │   └── utils.ts            # Utilities
│   └── types/
│       └── legislator.ts       # TypeScript types
├── docs/
│   ├── ARCHITECTURE.md         # System design
│   ├── ROADMAP.md              # Development phases
│   └── STYLES.md               # Design system
└── package.json
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and component breakdown
- [Roadmap](./docs/ROADMAP.md) - Development phases and planned features
- [Styles](./docs/STYLES.md) - Design system and theming

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code passes linting and formatting checks before submitting.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
