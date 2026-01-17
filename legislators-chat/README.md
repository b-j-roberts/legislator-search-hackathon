# Legislators Chat

An AI-powered chat interface for researching US legislators, congressional hearings, voting records, and related documents. Designed to help citizens and advocacy groups identify and contact the right legislators on issues they care about.

## Overview

Legislators Chat provides an intelligent conversational interface that:

- Searches congressional records, hearings, and voting history
- Identifies legislators relevant to specific topics or issues
- Provides structured information about legislator stances and positions
- Surfaces contact information for targeted outreach
- Generates reports with actionable insights for advocacy

## Features

- **AI Chat Interface**: Natural language conversation to explore legislative data
- **Structured Output**: Legislator cards with stance summaries, voting records, and contact info
- **Multi-source Integration**: Congressional hearings, votes, bills, and public records
- **Report Generation**: Exportable summaries for advocacy campaigns

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **AI**: [Maple AI](https://trymaple.ai/) - Privacy-first, end-to-end encrypted LLM
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Language**: TypeScript
- **Linting**: ESLint + Prettier

### Why Maple AI?

We chose Maple AI for its privacy-first approach to LLM inference:
- **End-to-end encryption**: Your conversations are never accessible to anyone
- **TEE isolation**: Inference runs in hardware-secured Trusted Execution Environments
- **OpenAI compatible**: Standard API format via Maple Proxy
- **Live data**: Secure web search for real-time information

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd legislators-chat

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Project Structure

```
legislators-chat/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   └── ui/           # shadcn/ui components
│   └── lib/              # Utility functions
├── docs/                 # Project documentation
│   ├── ARCHITECTURE.md   # System architecture
│   ├── ROADMAP.md        # Feature roadmap
│   └── STYLES.md         # Styling guidelines
├── public/               # Static assets
└── package.json
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and data flow
- [Roadmap](./docs/ROADMAP.md) - Feature planning and milestones
- [Styles](./docs/STYLES.md) - UI/UX guidelines and design system

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the project's linting and formatting standards:

```bash
npm run lint
npm run format:check
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Congressional data sourced from public government APIs and records
- Built with open-source tools and libraries

---

*Empowering civic engagement through accessible legislative data.*
