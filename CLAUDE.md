# CLAUDE.md - HSDL Frontend

This file provides guidance to Claude Code when working with the HSDL frontend SPA.

## Project Overview

A modern SvelteKit 5 single-page application for searching and browsing the Homeland Security Digital Library. Built with Svelte 5 runes, TailwindCSS, and TanStack Query for data fetching.

**Key Features:**
- Semantic and keyword search with faceted filtering
- Multi-theme system (CHDS Official, Developer) with light/dark modes
- PWA support with offline caching strategies
- Performance monitoring dashboard
- Mobile-responsive design

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| SvelteKit | 2.15.0 | App framework |
| Svelte | 5.15.0 | UI components (runes mode) |
| TailwindCSS | 3.4.17 | Styling |
| TanStack Query | 5.62.0 | Server state management |
| Vite | 6.3.0 | Build tool |
| Lucide Svelte | 0.468.0 | Icons |
| Workbox | 7.3.0 | PWA/Service worker |

## Development Commands

```bash
# Start dev server (port 5173)
npm run dev

# Type checking
npm run check
npm run check:watch

# Build for production
npm run build

# Preview production build
npm run preview

# Lint and format
npm run lint
npm run format
```

## Project Structure

```
frontend/
├── src/
│   ├── app.css           # Theme system and global styles
│   ├── app.html          # HTML shell
│   ├── lib/
│   │   ├── components/   # Reusable Svelte components
│   │   │   ├── FacetSidebar.svelte
│   │   │   ├── FilterDrawer.svelte
│   │   │   ├── FilterPills.svelte
│   │   │   └── ThemeSwitcher.svelte
│   │   ├── services/
│   │   │   ├── api.ts        # API client with types
│   │   │   └── performance.ts # Web Vitals tracking
│   │   ├── stores/       # Svelte stores (if any)
│   │   └── assets/       # Static assets
│   └── routes/
│       ├── +layout.svelte   # App shell, nav, theme
│       ├── +page.svelte     # Homepage with hero search
│       ├── search/          # Search results page
│       ├── browse/          # Taxonomy browser
│       ├── doc/             # Document detail view
│       ├── chat/            # AI chat interface
│       └── speed/           # Performance dashboard
├── static/               # Static files (favicon, PWA icons)
├── svelte.config.js      # SvelteKit config (static adapter)
├── tailwind.config.js    # Tailwind with theme variables
└── vite.config.ts        # Vite + PWA config
```

## Svelte 5 Patterns

This project uses **Svelte 5 runes mode**. Key patterns:

```svelte
<script lang="ts">
  // State with $state
  let count = $state(0);
  let items = $state<string[]>([]);

  // Derived values with $derived
  let doubled = $derived(count * 2);

  // URL-derived state (from SvelteKit)
  let query = $derived($page.url.searchParams.get('q') || '');

  // Effects (rare - prefer derived)
  $effect(() => {
    console.log('count changed:', count);
  });
</script>

<!-- Event handlers use on* attributes -->
<button onclick={() => count++}>Click</button>
<form onsubmit={handleSubmit}>...</form>
```

**Do NOT use:**
- `export let` for props (use `$props()` instead)
- `$:` reactive statements (use `$derived`)
- `on:click` directive (use `onclick` attribute)

## Theme System

### Architecture

The theme system uses CSS custom properties defined in `app.css`:

1. **Base tokens** (`:root`) - spacing, animation, shared values
2. **Theme variants** (`[data-theme='chds']`, `[data-theme='developer']`)
3. **Dark mode** (`.dark` class on `<html>`)

### Theme Variables

```css
/* Surface colors */
--color-surface              /* Main background */
--color-surface-elevated     /* Cards, modals */
--color-surface-secondary    /* Subtle backgrounds */

/* Text colors */
--color-text-primary         /* Main text */
--color-text-secondary       /* Secondary text */
--color-text-tertiary        /* Muted text */

/* Brand colors */
--color-primary-600          /* Primary brand color */
--color-accent-500           /* Accent/highlight */
--color-interactive          /* Links, buttons */
```

### Using Theme Colors in Tailwind

```html
<!-- Surface colors -->
<div class="bg-surface-elevated">Card</div>

<!-- Text colors -->
<p class="text-text-theme-primary">Main text</p>
<span class="text-text-theme-secondary">Secondary</span>

<!-- Brand colors -->
<button class="bg-chds-blue">Action</button>
<div class="border-chds-gold">Highlighted</div>
```

### Theme Switcher

Located in `ThemeSwitcher.svelte`. Themes are stored in localStorage:
- `theme`: 'chds' | 'developer'
- `mode`: 'light' | 'dark' | 'auto'

### Adding Dark Mode Support

When adding new components, ensure proper contrast in both modes:

```html
<!-- Use theme-aware classes -->
<div class="text-text-theme-primary bg-surface-elevated">
  <!-- Content adapts to theme automatically -->
</div>

<!-- For hero sections with forced colors -->
<h1 class="!text-white">Always white heading</h1>
```

## API Client

The API client in `src/lib/services/api.ts` provides typed access to the Rails backend:

```typescript
import { api } from '$lib/services/api';

// Search with timing info
const results = await api.search({
  q: 'cybersecurity',
  mode: 'semantic',           // or 'keyword'
  page: 1,
  per_page: 20,
  terms: ['term-uuid'],       // Filter by taxonomy terms
  year_start: 2020,
  year_end: 2024,
  thesis: 'all',              // 'all' | 'thesis' | 'chds'
  sort: 'relevance',          // 'relevance' | 'date' | 'title'
  description_length: 'full'  // number or 'full' (default: 300)
});

// results.serverTimeMs - Rails x-runtime (ms)
// results.clientTimeMs - Total request time (ms)

// Get document details
const doc = await api.getDocument('uuid');

// Get taxonomy
const taxonomy = await api.getTaxonomy();

// Get facets for current search
const facets = await api.getFacets({ q: 'query', mode: 'semantic' });
```

## TanStack Query Patterns

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { api } from '$lib/services/api';

  const searchQuery = createQuery({
    queryKey: ['search', query, mode, page],
    queryFn: () => api.search({ q: query, mode, page }),
    enabled: !!query  // Only run when query exists
  });
</script>

{#if $searchQuery.isPending}
  <LoadingSkeleton />
{:else if $searchQuery.isError}
  <Error message={$searchQuery.error.message} />
{:else if $searchQuery.data}
  <Results data={$searchQuery.data} />
{/if}
```

## Performance Monitoring

The `/speed` route provides a developer dashboard with:
- Core Web Vitals (LCP, FID, CLS, FCP, TTFB)
- Search timing history (last 50 searches)
- Resource loading breakdown
- Performance grades

Search timings are automatically recorded by the API client.

## PWA Configuration

Defined in `vite.config.ts`:

| API Pattern | Cache Strategy | TTL |
|-------------|---------------|-----|
| `/api/spa/v1/taxonomy` | CacheFirst | 24h |
| `/api/spa/v1/search` | StaleWhileRevalidate | 30min |
| `/api/spa/v1/documents/*` | NetworkFirst | 1h |
| `*.pdf` | CacheFirst | 20 entries max |

## Environment Variables

```bash
# API base URL (defaults to production)
VITE_API_BASE=http://100.104.170.10:3055/api/spa/v1
```

## Backend Integration

The frontend connects to the Rails API at `hsdl-ai`:
- **Development**: `http://100.104.170.10:3055/api/spa/v1`
- **Staging**: `https://hsdl-ai-staging.domt.app/api/spa/v1` (same-origin, SPA baked into Rails `public/`)
- **Production**: `https://next.hsdl.org/api/spa/v1`

The API must expose the `x-runtime` header via CORS for performance timing.

### Authentication

Session-cookie auth via CHDS Pulse OAuth (no JWTs). SPA and API share the same origin on staging and production.

```typescript
// All API calls must include credentials for session cookies
fetch('/api/spa/v1/auth/me', { credentials: 'include' })
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/spa/v1/auth/me` | GET | Current user profile or 401 |
| `/api/spa/v1/auth/login` | GET | Returns OAuth URL for redirect |
| `/api/spa/v1/auth/session` | DELETE | Logout |

## Common Tasks

### Adding a New Route

1. Create `src/routes/[name]/+page.svelte`
2. Use TanStack Query for data fetching
3. Follow existing patterns for loading/error states

### Adding a New Component

1. Create in `src/lib/components/`
2. Use Svelte 5 runes syntax
3. Use theme-aware Tailwind classes
4. Export from `src/lib/index.ts` if shared

### Modifying the Theme

1. Edit CSS variables in `app.css`
2. Update Tailwind config if adding new semantic colors
3. Test in both light and dark modes
4. Test in both CHDS and Developer themes

## Route Scope

This SvelteKit SPA handles search, browse, document detail, chat, and performance routes. Some features (feed, dialectic) are rendered by the Rails app directly (HAML views + Stimulus), not by this SvelteKit frontend.

## Build Output

The static adapter builds to `build/` with:
- `index.html` (SPA fallback)
- Precompressed assets (gzip, brotli)
- Service worker for PWA

**Standalone**: Deploy the `build/` directory to any static host.
**Staging (baked into Rails)**: Built during Docker build with `VITE_API_BASE=/api/spa/v1`, output copied to Rails `public/`. Served via `SpaController` -- same container, same origin.
