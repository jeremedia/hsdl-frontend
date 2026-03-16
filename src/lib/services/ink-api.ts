// INK Collection Management API Client
// Follows the same singleton pattern as api.ts but with session cookie auth

const API_BASE = import.meta.env.VITE_API_BASE || 'https://hsdl-ai.domt.app/api/spa/v1';
const INK_BASE = API_BASE.replace('/spa/', '/ink/');

// Types

export interface InkDocument {
	id: string;
	doc_id: number;
	title: string;
	description: string | null;
	publish_date: string | null;
	publish_year: number | null;
	source: string | null;
	report_number: string | null;
	health_score: number | null;
	enable_status: 'not_set' | 'enabled' | 'disabled';
	term_count: number;
	has_pdf: boolean;
	has_embedding: boolean;
	updated_at: string;
}

export interface InkDocumentFull extends InkDocument {
	url: string | null;
	alternate_title: string | null;
	file_extension: string | null;
	file_size: number | null;
	access_level: string | null;
	selected_audience: string | null;
	pdf_url: string | null;
	has_docling_markdown: boolean;
	taxonomy: Record<string, Array<{ id: string; name: string }>>;
	marc_subjects: Array<{ heading: string; heading_type: string }>;
	health_data: Record<string, number | boolean> | null;
	tag_data: Record<string, string[]> | null;
	summary_data: Record<string, string> | null;
	created_at: string;
}

export interface InkUser {
	id: string;
	email: string;
	name: string;
	role: string | null;
	created_at: string;
}

export interface PaginatedResponse<T> {
	total_count: number;
	page: number;
	per_page: number;
	total_pages: number;
	results: T[];
}

export interface DashboardData {
	total_documents: number;
	enabled_count: number;
	disabled_count: number;
	not_set_count: number;
	health_distribution: { excellent: number; good: number; fair: number; poor: number };
	recent_additions: InkDocument[];
	missing_metadata: {
		no_description: number;
		no_subjects: number;
		no_embedding: number;
		no_pdf: number;
	};
	by_year: Record<string, number>;
	collection_health_avg: number;
}

export interface VocabularyField {
	id: string;
	name: string;
	vocabulary_terms_count: number;
}

export interface VocabularyTerm {
	id: string;
	name: string;
	vocabulary_term_relations_count: number;
}

export interface DocumentSearchParams {
	page?: number;
	per_page?: number;
	sort?: string;
	direction?: string;
	q?: string;
	health_min?: number;
	health_max?: number;
	year_start?: number;
	year_end?: number;
	term_ids?: string[];
	enable_status?: string;
	has_pdf?: boolean;
	has_embedding?: boolean;
}

export interface SearchParams {
	q: string;
	mode?: string;
	page?: number;
	per_page?: number;
	health_min?: number;
	health_max?: number;
	year_start?: number;
	year_end?: number;
	enable_status?: string;
	has_pdf?: boolean;
	has_embedding?: boolean;
}

class InkApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = 'InkApiError';
	}
}

export interface ReleaseNote {
	version: string;
	release_date: string;
	release_type: string;
	tags: string[];
	highlights: string[];
	content_html: string;
}

class InkApiClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, {
			...options,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			}
		});

		if (!response.ok) {
			if (response.status === 401) throw new InkApiError(401, 'NOT_AUTHENTICATED');
			if (response.status === 403) throw new InkApiError(403, 'FORBIDDEN');
			throw new InkApiError(response.status, `API error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	// Auth
	async getMe(): Promise<InkUser> {
		return this.fetch('/auth/me');
	}

	// Dashboard
	async getDashboard(): Promise<DashboardData> {
		return this.fetch('/dashboard');
	}

	// Documents
	async getDocuments(params: DocumentSearchParams = {}): Promise<PaginatedResponse<InkDocument>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.set('page', String(params.page));
		if (params.per_page) searchParams.set('per_page', String(params.per_page));
		if (params.sort) searchParams.set('sort', params.sort);
		if (params.direction) searchParams.set('direction', params.direction);
		if (params.q) searchParams.set('q', params.q);
		if (params.health_min !== undefined) searchParams.set('health_min', String(params.health_min));
		if (params.health_max !== undefined) searchParams.set('health_max', String(params.health_max));
		if (params.year_start) searchParams.set('year_start', String(params.year_start));
		if (params.year_end) searchParams.set('year_end', String(params.year_end));
		if (params.term_ids) params.term_ids.forEach((t) => searchParams.append('term_ids[]', t));
		if (params.enable_status) searchParams.set('enable_status', params.enable_status);
		if (params.has_pdf !== undefined) searchParams.set('has_pdf', String(params.has_pdf));
		if (params.has_embedding !== undefined) searchParams.set('has_embedding', String(params.has_embedding));

		const query = searchParams.toString();
		return this.fetch(`/documents${query ? `?${query}` : ''}`);
	}

	async getDocument(id: string): Promise<InkDocumentFull> {
		return this.fetch(`/documents/${id}`);
	}

	async updateDocument(id: string, data: Record<string, unknown>): Promise<InkDocumentFull> {
		return this.fetch(`/documents/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	// Search
	async search(params: SearchParams): Promise<PaginatedResponse<InkDocument>> {
		const searchParams = new URLSearchParams();
		searchParams.set('q', params.q);
		if (params.mode) searchParams.set('mode', params.mode);
		if (params.page) searchParams.set('page', String(params.page));
		if (params.per_page) searchParams.set('per_page', String(params.per_page));
		if (params.health_min !== undefined) searchParams.set('health_min', String(params.health_min));
		if (params.health_max !== undefined) searchParams.set('health_max', String(params.health_max));
		if (params.year_start) searchParams.set('year_start', String(params.year_start));
		if (params.year_end) searchParams.set('year_end', String(params.year_end));
		if (params.enable_status) searchParams.set('enable_status', params.enable_status);
		if (params.has_pdf !== undefined) searchParams.set('has_pdf', String(params.has_pdf));
		if (params.has_embedding !== undefined) searchParams.set('has_embedding', String(params.has_embedding));

		return this.fetch(`/search?${searchParams.toString()}`);
	}

	// Vocabulary
	async getVocabularyFields(): Promise<VocabularyField[]> {
		return this.fetch('/vocabulary_fields');
	}

	async getTerms(
		fieldId: string,
		params?: { q?: string; page?: number; per_page?: number }
	): Promise<PaginatedResponse<VocabularyTerm>> {
		const searchParams = new URLSearchParams();
		if (params?.q) searchParams.set('q', params.q);
		if (params?.page) searchParams.set('page', String(params.page));
		if (params?.per_page) searchParams.set('per_page', String(params.per_page));

		const query = searchParams.toString();
		return this.fetch(`/vocabulary_fields/${fieldId}/terms${query ? `?${query}` : ''}`);
	}

	// Document terms
	async addDocumentTerm(docId: string, termId: string): Promise<void> {
		await this.fetch(`/documents/${docId}/terms`, {
			method: 'POST',
			body: JSON.stringify({ term_id: termId })
		});
	}

	async removeDocumentTerm(docId: string, termId: string): Promise<void> {
		await this.fetch(`/documents/${docId}/terms/${termId}`, {
			method: 'DELETE'
		});
	}

	// Release Notes
	async getReleaseNotes(tag?: string): Promise<ReleaseNote[]> {
		const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
		return this.fetch(`/release_notes${params}`);
	}
}

export const inkApi = new InkApiClient(INK_BASE);
