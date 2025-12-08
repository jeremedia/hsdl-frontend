# HSDL Frontend

Modern, mobile-first frontend for the Homeland Security Digital Library.

## Tech Stack

- **Framework**: Svelte 5 + SvelteKit
- **Styling**: Tailwind CSS with CHDS design tokens
- **Data Fetching**: TanStack Query
- **PWA**: Vite PWA Plugin with Workbox
- **Icons**: Lucide

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file:

```
VITE_API_BASE=https://hsdl-ai.domt.app/api/spa/v1
```

## Project Structure

```
src/
├── routes/
│   ├── +page.svelte         # Home with hero search
│   ├── +layout.svelte       # App shell
│   ├── search/              # Search results
│   ├── doc/[id]/            # Document detail
│   ├── browse/              # Taxonomy browser
│   └── chat/                # AI chat (Phase 2)
├── lib/
│   ├── components/
│   │   ├── ui/              # Primitives (Button, Card, etc.)
│   │   ├── search/          # Search components
│   │   └── document/        # Document components
│   ├── stores/              # Svelte stores
│   └── services/
│       └── api.ts           # API client
└── app.css                  # Tailwind + design tokens
```

## API Endpoints

The frontend consumes the Rails API at `/api/spa/v1/`:

| Endpoint | Description |
|----------|-------------|
| `GET /taxonomy` | Full taxonomy (fields + terms) |
| `GET /search` | Unified search (semantic/keyword) |
| `GET /search/suggestions` | Typeahead suggestions |
| `GET /facets` | Dynamic facet counts |
| `GET /documents/:id` | Document details |
| `GET /documents/:id/similar` | Similar documents |

## PWA Features

- Installable on mobile/desktop
- Offline search history
- Aggressive caching:
  - Taxonomy: 24 hours
  - Search: 5 minutes stale, 30 minutes max
  - Documents: 1 hour
  - PDFs: Forever

## Design System

Uses CHDS (Center for Homeland Defense and Security) design tokens:

- **Primary**: Navy (#002B58), Blue (#0268BB)
- **Accent**: Yellow (#FED402), Gold (#FCB900)
- **Typography**: Open Sans
- **Spacing**: 8px grid

## License

MIT
