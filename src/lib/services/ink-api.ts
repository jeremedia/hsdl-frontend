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

// Search Lab types
export interface SearchConfigSummary {
	id: string;
	name: string;
	description: string | null;
	active: boolean;
	locked: boolean;
	updated_at: string;
	activated_at: string | null;
}

export interface SearchConfigDetail extends SearchConfigSummary {
	field_boosts: Record<string, number>;
	synonyms: Record<string, string[]>;
	synonym_count: number;
	excluded_terms: string[];
	excluded_patterns: string[];
	defaults: Record<string, unknown>;
	prefix_matching: Record<string, unknown>;
	hybrid_params: {
		rrf_k: number;
		title_boost_weight: number;
		subject_boost_weight: number;
		phrase_title_boost_weight: number;
		publisher_authority_weight: number;
		fetch_size_multiplier: number;
		series_collapse_enabled: boolean;
		lists_boost_weight: number;
		tab_section_boost_weight: number;
		publisher_authority_tiers?: Record<string, { weight: number; publishers: string[] }>;
	};
	notes: string | null;
}

export interface PreviewResult {
	rank: number;
	doc_id: number;
	uuid: string;
	title: string;
	rrf_score: number;
	matched_by: string[];
}

export interface PreviewResponse {
	query: string;
	config_name: string;
	results: PreviewResult[];
	timing_ms: number;
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

export interface EnrichmentCoverage {
	count: number;
	total: number;
	pct: number;
	note?: string;
}

export interface EnrichmentStatus {
	coverage: Record<string, EnrichmentCoverage>;
	queues: Record<string, { size: number; latency: number }>;
	recent_activity: Array<{
		id: string;
		docID: number;
		title: string | null;
		enrichment: string | null;
		model: string | null;
		at: string | null;
		health_score: number | null;
	}>;
	model_provenance: Record<string, Record<string, number>>;
	totals: {
		total_documents: number;
		publicly_visible: number;
		pdfs: number;
	};
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

// Golden Query Evaluation types

export interface GoldenQuery {
	id: string;
	query_text: string;
	position: number;
	expected_doc_ids: number[];
	notes: string | null;
}

export interface RatingEntry {
	relevance: number;
	intent: string | null;
	failure: string | null;
}

export interface SearchResult {
	rank: number;
	doc_id: number;
	uuid: string;
	title: string;
	rrf_score: number;
	matched_by: string[];
}

export interface GoldenQueryRunResult {
	id: string;
	query_id: string;
	query_text: string;
	position: number;
	expected_doc_ids: number[];
	results: SearchResult[];
	ratings: Record<string, RatingEntry>;
	no_strong_matches: boolean;
	per_query_metrics: Record<string, number | Record<string, number>>;
	rated_by: string | null;
	rated_at: string | null;
}

export interface RatingProgress {
	rated: number;
	total: number;
	complete: boolean;
}

export interface GoldenQueryRunSummary {
	id: string;
	set_id: string;
	set_name: string;
	label: string | null;
	status: string;
	run_by: string | null;
	rating_progress: RatingProgress;
	aggregate_metrics: Record<string, unknown>;
	no_strong_matches_count: number;
	started_at: string | null;
	completed_at: string | null;
}

export interface GoldenQueryRunDetail extends GoldenQueryRunSummary {
	results: GoldenQueryRunResult[];
}

export interface GoldenQuerySet {
	id: string;
	name: string;
	description: string | null;
	query_count: number;
	latest_run: GoldenQueryRunSummary | null;
	created_at: string;
	updated_at: string;
}

export interface GoldenQuerySetDetail {
	id: string;
	name: string;
	description: string | null;
	queries: GoldenQuery[];
	runs: GoldenQueryRunSummary[];
	created_at: string;
}

export interface GoldenRunComparison {
	run_a: GoldenQueryRunSummary;
	run_b: GoldenQueryRunSummary;
	deltas: Record<string, { a: number; b: number; delta: number }>;
	per_query: Array<{ query_id: string; query_text: string; ndcg_a: number; ndcg_b: number; delta: number }>;
}

export interface RatedResult {
	id: string;
	ratings: Record<string, RatingEntry>;
	per_query_metrics: Record<string, unknown>;
	rated_at: string;
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

	// Enrichment
	async getEnrichmentStatus(): Promise<EnrichmentStatus> {
		return this.fetch('/enrichment');
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

	// Golden Query Evaluation
	async getGoldenSets(): Promise<GoldenQuerySet[]> {
		return this.fetch('/golden_sets');
	}

	async getGoldenSet(id: string): Promise<GoldenQuerySetDetail> {
		return this.fetch(`/golden_sets/${id}`);
	}

	async createGoldenSet(data: { name: string; description?: string; queries?: Array<{ query_text: string; expected_doc_ids?: number[] }> }): Promise<GoldenQuerySetDetail> {
		return this.fetch('/golden_sets', { method: 'POST', body: JSON.stringify(data) });
	}

	async updateGoldenSet(id: string, data: { name?: string; description?: string }): Promise<GoldenQuerySetDetail> {
		return this.fetch(`/golden_sets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
	}

	async deleteGoldenSet(id: string): Promise<void> {
		await this.fetch(`/golden_sets/${id}`, { method: 'DELETE' });
	}

	async importGoldenQueries(setId: string, csv: string): Promise<{ imported: number; set: GoldenQuerySetDetail }> {
		return this.fetch(`/golden_sets/${setId}/import`, { method: 'POST', body: JSON.stringify({ csv }) });
	}

	async addGoldenQuery(setId: string, data: { query_text: string; expected_doc_ids?: number[]; notes?: string }): Promise<GoldenQuery> {
		return this.fetch(`/golden_sets/${setId}/queries`, { method: 'POST', body: JSON.stringify(data) });
	}

	async updateGoldenQuery(setId: string, queryId: string, data: { query_text?: string; expected_doc_ids?: number[]; notes?: string }): Promise<GoldenQuery> {
		return this.fetch(`/golden_sets/${setId}/queries/${queryId}`, { method: 'PATCH', body: JSON.stringify(data) });
	}

	async deleteGoldenQuery(setId: string, queryId: string): Promise<void> {
		await this.fetch(`/golden_sets/${setId}/queries/${queryId}`, { method: 'DELETE' });
	}

	async createGoldenRun(setId: string, label?: string): Promise<GoldenQueryRunDetail> {
		return this.fetch(`/golden_sets/${setId}/runs`, { method: 'POST', body: JSON.stringify({ label }) });
	}

	async getGoldenRuns(setId: string): Promise<GoldenQueryRunSummary[]> {
		return this.fetch(`/golden_sets/${setId}/runs`);
	}

	async getGoldenRun(runId: string): Promise<GoldenQueryRunDetail> {
		return this.fetch(`/golden_runs/${runId}`);
	}

	async compareGoldenRuns(runIdA: string, runIdB: string): Promise<GoldenRunComparison> {
		return this.fetch(`/golden_runs/${runIdA}/compare/${runIdB}`);
	}

	async exportGoldenRunCsv(runId: string): Promise<Blob> {
		const url = `${this.baseUrl}/golden_runs/${runId}/export`;
		const response = await fetch(url, { credentials: 'include' });
		return response.blob();
	}

	async rateGoldenResult(resultId: string, data: { ratings: Record<string, RatingEntry>; no_strong_matches?: boolean }): Promise<RatedResult> {
		return this.fetch(`/golden_run_results/${resultId}/rate`, { method: 'PATCH', body: JSON.stringify(data) });
	}

	// Search Lab
	async getSearchConfigs(): Promise<SearchConfigSummary[]> {
		return this.fetch('/search_configs');
	}

	async getSearchConfig(id: string): Promise<SearchConfigDetail> {
		return this.fetch(`/search_configs/${id}`);
	}

	async createSearchConfig(data: { name: string; description?: string }): Promise<SearchConfigDetail> {
		return this.fetch('/search_configs', { method: 'POST', body: JSON.stringify(data) });
	}

	async updateSearchConfig(id: string, data: Partial<SearchConfigDetail>): Promise<{ status: string; updated_at: string }> {
		return this.fetch(`/search_configs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
	}

	async deleteSearchConfig(id: string): Promise<void> {
		const url = `${this.baseUrl}/search_configs/${id}`;
		const response = await fetch(url, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
		if (!response.ok) throw new InkApiError(response.status, `Delete failed: ${response.statusText}`);
	}

	async cloneSearchConfig(id: string, data: { name: string; description?: string }): Promise<SearchConfigDetail> {
		return this.fetch(`/search_configs/${id}/clone`, { method: 'POST', body: JSON.stringify(data) });
	}

	async activateSearchConfig(id: string): Promise<{ status: string; id: string; name: string }> {
		return this.fetch(`/search_configs/${id}/activate`, { method: 'POST' });
	}

	async previewSearch(data: { query: string; config_id?: string; config?: Partial<SearchConfigDetail> }): Promise<PreviewResponse> {
		return this.fetch('/search_configs/preview', { method: 'POST', body: JSON.stringify(data) });
	}
}

export const inkApi = new InkApiClient(INK_BASE);
