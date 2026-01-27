import { recordSearchTiming } from './performance';

// API configuration
const API_BASE = import.meta.env.VITE_API_BASE || 'https://hsdl-ai.domt.app/api/spa/v1';

// Types
export interface Document {
	id: string;
	doc_id: number;
	title: string;
	description: string | null;
	publish_date: string | null;
	publish_year: number | null;
	doc_type: string;
	is_thesis: boolean;
	url: string | null;
	relevance_score?: number;
	terms: Array<{ id: string; name: string }>;
}

export interface FullDocument {
	id: string;
	doc_id: number;
	title: string;
	alternate_title: string | null;
	description: string | null;
	publish_date: string | null;
	publish_year: number | null;
	source: string | null;
	url: string | null;
	report_number: string | null;
	file_extension: string | null;
	file_size: number | null;
	access_level: string | null;
	is_thesis: boolean;
	is_chds_thesis: boolean;
	full_url: string;
	pdf_url: string | null;
	taxonomy: Record<string, Array<{ id: string; name: string }>>;
	summary: string | null;
	tags: {
		keywords?: string[];
		subjects?: string[];
		organizations?: string[];
		places?: string[];
	} | null;
	created_at: string;
	updated_at: string;
}

export interface SearchResult {
	query: string;
	mode: 'semantic' | 'keyword';
	total_count: number;
	page: number;
	per_page: number;
	total_pages: number;
	results: Document[];
	// Performance timing (added by client from headers)
	serverTimeMs?: number;
	clientTimeMs?: number;
}

export interface TaxonomyField {
	id: string;
	name: string;
	icon: string;
	term_count: number;
	terms: TaxonomyTerm[];
}

export interface TaxonomyTerm {
	id: string;
	name: string;
	icon: string;
	document_count: number;
}

export interface Taxonomy {
	fields: TaxonomyField[];
	generated_at: string;
	cache_until: string;
}

export interface Suggestion {
	type: 'term' | 'document';
	id: string;
	name?: string;
	title?: string;
	field?: string;
	count?: number;
}

export interface SuggestionsResult {
	query: string;
	suggestions: Suggestion[];
}

export interface FacetTerm {
	id: string;
	name: string;
	count: number;
}

export interface FacetField {
	id: string;
	name: string;
	terms: FacetTerm[];
}

export interface FacetsResponse {
	years: Record<number, number>;
	fields: FacetField[];
	thesis_counts: { all: number; thesis: number; chds: number };
	total_count: number;
}

// API client
class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			}
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	// Taxonomy
	async getTaxonomy(): Promise<Taxonomy> {
		return this.fetch('/taxonomy');
	}

	async getField(id: string): Promise<TaxonomyField> {
		return this.fetch(`/taxonomy/${id}`);
	}

	// Search (with performance timing)
	async search(params: {
		q: string;
		mode?: 'semantic' | 'keyword';
		terms?: string[];
		year_start?: number;
		year_end?: number;
		thesis?: 'all' | 'thesis' | 'chds';
		sort?: 'relevance' | 'date' | 'title';
		page?: number;
		per_page?: number;
	}): Promise<SearchResult> {
		const searchParams = new URLSearchParams();
		searchParams.set('q', params.q);
		if (params.mode) searchParams.set('mode', params.mode);
		if (params.terms) params.terms.forEach((t) => searchParams.append('terms[]', t));
		if (params.year_start) searchParams.set('year_start', String(params.year_start));
		if (params.year_end) searchParams.set('year_end', String(params.year_end));
		if (params.thesis) searchParams.set('thesis', params.thesis);
		if (params.sort) searchParams.set('sort', params.sort);
		if (params.page) searchParams.set('page', String(params.page));
		if (params.per_page) searchParams.set('per_page', String(params.per_page));

		// Time the search request (client-side)
		const startTime = performance.now();
		const url = `${this.baseUrl}/search?${searchParams.toString()}`;
		const response = await fetch(url, {
			headers: { 'Content-Type': 'application/json' }
		});
		const clientTimeMs = performance.now() - startTime;

		if (!response.ok) {
			throw new Error(`API error: ${response.status} ${response.statusText}`);
		}

		// Capture Rails x-runtime header (in seconds, convert to ms)
		const xRuntime = response.headers.get('x-runtime');
		const serverTimeMs = xRuntime ? parseFloat(xRuntime) * 1000 : undefined;

		const result: SearchResult = await response.json();

		// Add timing info to result
		result.serverTimeMs = serverTimeMs;
		result.clientTimeMs = clientTimeMs;

		// Record timing for Speed dashboard
		recordSearchTiming({
			query: params.q,
			mode: params.mode || 'semantic',
			duration: clientTimeMs,
			resultCount: result.total_count
		});

		return result;
	}

	async getSuggestions(q: string): Promise<SuggestionsResult> {
		return this.fetch(`/search/suggestions?q=${encodeURIComponent(q)}`);
	}

	// Documents
	async getDocument(id: string): Promise<FullDocument> {
		return this.fetch(`/documents/${id}`);
	}

	async getSimilarDocuments(id: string, limit = 10): Promise<{ document_id: string; similar: Document[] }> {
		return this.fetch(`/documents/${id}/similar?limit=${limit}`);
	}

	// Facets
	async getFacets(params?: {
		q?: string;
		mode?: 'semantic' | 'keyword';
		year_start?: number;
		year_end?: number;
		thesis?: 'all' | 'thesis' | 'chds';
	}): Promise<FacetsResponse> {
		const searchParams = new URLSearchParams();
		if (params?.q) searchParams.set('q', params.q);
		if (params?.mode) searchParams.set('mode', params.mode);
		if (params?.year_start) searchParams.set('year_start', String(params.year_start));
		if (params?.year_end) searchParams.set('year_end', String(params.year_end));
		if (params?.thesis) searchParams.set('thesis', params.thesis);

		const query = searchParams.toString();
		return this.fetch(`/facets${query ? `?${query}` : ''}`);
	}
}

export const api = new ApiClient(API_BASE);
