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
	// Format detection (content-type scan, c01ec923). file_format = catalogued/derived
	// human format; format_mismatch = true when the scan auto-corrected this record's
	// file type (content_type_status === 'corrected') -- a "was fixed" marker.
	file_format: string | null;
	content_type_status: string | null;
	format_mismatch: boolean;
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
		publisher_name_boost_weight?: number;
		publisher_name_min_docs?: number;
		publisher_name_max_terms?: number;
		recency_boost_weight: number;
		recency_decay_rate: number;
		fetch_size_multiplier: number;
		constant_pool_enabled?: boolean;
		candidate_pool_size?: number;
		hybrid_counts_v2_enabled?: boolean;
		creator_surname_match_enabled?: boolean;
		creator_surname_max_authorities?: number;
		creator_surname_max_corpus_freq?: number;
		question_interpret_enabled?: boolean;
		question_interpret_model?: string;
		question_interpret_timeout_ms?: number;
		question_interpret_apply_year_range?: boolean;
		series_collapse_enabled: boolean;
		bm25_enabled?: boolean;
		semantic_search_enabled?: boolean;
		lists_boost_weight: number;
		tab_section_boost_weight: number;
		publisher_authority_tiers?: Record<string, { weight: number; publishers: string[] }>;
		quality_banner_threshold: number;
		semantic_similarity_threshold: number;
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
	// Admin unlocks the verify-queue reporter picker (same User#admin? as the
	// Rails /sidekiq gate).
	admin?: boolean;
	created_at: string;
	// Verification queue: the Slack identity this account's reported issues are
	// filed under (null if not a known reporter), and how many fixes are live
	// and awaiting their sign-off (powers the nav badge).
	slack_user_id?: string | null;
	verify_pending?: number;
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

// Cross-field vocab term shape returned by /vocabulary_terms/search and
// /vocabulary_terms/lookup. Carries `field` (the vocabulary field name)
// so the FilterPicker can group chips and label dropdown rows.
export interface FilterTerm {
	id: string;
	name: string;
	field: string | null;
	document_count: number;
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

// Feedback Dashboard types

export interface FeedbackSummary {
	total: number;
	open: number;
	investigating: number;
	needs_feedback: number;
	resolved: number;
	wont_fix: number;
	duplicate: number;
	resolution_rate: number;
	resolved_last_7d: number;
	avg_resolution_days: number | null;
}

export interface FeedbackReporter {
	name: string;
	count: number;
	resolved: number;
}

export interface FeedbackTimelineDay {
	date: string;
	opened: number;
	resolved: number;
}

export type FeedbackVerdict = 'ready' | 'not_ready' | 'human_review';

export interface FeedbackIssue {
	id: string;
	full_id: string;
	title: string;
	category: string;
	priority: string;
	status: string;
	assignee: string | null;
	reporter_review_status: string | null;
	latest_verdict: FeedbackVerdict | null;
	reported_by: string | null;
	notes_count: number;
	created_at: string;
	age_days: number;
}

// Signed-URL image payload as returned by the Rails issue_images/notes_with_images
// helpers. Shape matches ImageGallery's expected props.
export interface IssueImage {
	id: number | string;
	filename: string;
	content_type?: string;
	byte_size?: number;
	// number | undefined to match ImageGallery's GalleryImage contract. The
	// Rails serializer may send null when blob metadata lacks dimensions;
	// ImageGallery tolerates that via `img.width || fallback`.
	width?: number;
	height?: number;
	url: string;
}

export interface FeedbackIssueExpanded extends FeedbackIssue {
	description: string | null;
	search_query: string | null;
	url_example: string | null;
	doc_id: string | null;
	resolution: string | null;
	resolved_at: string | null;
	fixed_in_version: string | null;
	review_steps: string | null;
	notes: Array<{
		text: string;
		author: string;
		timestamp: string;
		verdict?: FeedbackVerdict;
		images?: IssueImage[];
	}>;
	images?: IssueImage[];
}

// A row in the reporter verification queue: the full expanded issue plus the
// queue-specific fields the verify UI renders.
export interface VerifyQueueItem extends FeedbackIssueExpanded {
	is_active: boolean; // the one Slack is currently waiting on (DM out)
	queue_position: number | null; // 1-based rank in the pending list
	test_url: string | null; // where to go verify the fix
}

// One row of the admin queue picker: a reporter identity plus how many fixes
// are live and awaiting their sign-off. Only present in admin responses.
export interface VerifyReporterOption {
	slack_user_id: string;
	name: string;
	pending: number;
}

export interface VerifyQueueResponse {
	linked: boolean; // false → this account isn't a known reporter
	reporter?: { name: string; slack_user_id: string };
	viewing_other?: boolean; // admin is viewing someone else's queue (read-only)
	admin?: boolean;
	reporters?: VerifyReporterOption[]; // admin-only queue-picker directory
	total?: number;
	results: VerifyQueueItem[];
	recent: VerifyQueueItem[]; // confirmed/rejected in the last 14 days
}

export interface FeedbackIssueFilters {
	statuses: string[];
	categories: string[];
	priorities: string[];
	reporters: string[];
	assignees: string[];
}

export interface FeedbackIssueListParams {
	page?: number;
	per_page?: number;
	sort?: string;
	direction?: 'asc' | 'desc';
	status?: string;
	category?: string;
	priority?: string;
	reporter?: string;
	assignee?: string;
	q?: string;
	subproject?: string;
	inbox?: boolean;
}

export interface FeedbackIssueListResponse {
	total_count: number;
	page: number;
	per_page: number;
	total_pages: number;
	filters: FeedbackIssueFilters;
	results: FeedbackIssueExpanded[];
}

export interface FeedbackDashboardData {
	summary: FeedbackSummary;
	by_category: Record<string, number>;
	by_reporter: FeedbackReporter[];
	timeline: FeedbackTimelineDay[];
	recent: FeedbackIssue[];
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

// Browse Editor types

export type BrowseNodeKind = 'hub' | 'sub_hub' | 'collection_group' | 'collection_item';
export type BrowseNodeMode = 'hybrid' | 'keyword';
export type BrowseNodeVisibility = 'published' | 'draft';

export interface BrowseNodeChild {
	id: string;
	slug: string;
	name: string;
	kind: BrowseNodeKind;
	visibility: BrowseNodeVisibility;
	position?: number | null;
}

export interface InkBrowseNode {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	kind: BrowseNodeKind;
	query: string | null;
	mode: BrowseNodeMode;
	filters: Record<string, unknown>;
	placement: Record<string, unknown>;
	visibility: BrowseNodeVisibility;
	parent_ids: string[];
	position?: number | null;
	children?: BrowseNodeChild[];
	created_at?: string;
	updated_at?: string;
	// Phase 1 BrowseTree fields (cached_doc_count populated by
	// BrowseNodeCountJob; null when not yet computed).
	cached_doc_count?: number | null;
}

export type BrowseTreeReorderOp = 'move' | 'cross_assign';
export interface BrowseTreeReorderPayload {
	parent_id: string | null;
	position: number;
	op: BrowseTreeReorderOp;
}

export interface BrowseNodeListParams {
	kind?: BrowseNodeKind;
	parent_id?: string;
	visibility?: BrowseNodeVisibility;
	q?: string;
	limit?: number;
}

export interface BrowseNodePayload {
	slug?: string;
	name?: string;
	description?: string | null;
	kind?: BrowseNodeKind;
	query?: string | null;
	mode?: BrowseNodeMode;
	filters?: Record<string, unknown>;
	placement?: Record<string, unknown>;
	visibility?: BrowseNodeVisibility;
	parent_ids?: string[];
	position?: number | null;
}

// ── WorkGroups (developer queue board) ─────────────────────────────────
// The horizontal scheduling axis on top of each issue's lifecycle: named,
// ordered, shippable per-developer issue bundles. Backs the kanban board at
// /ink/feedback/queue. See Api::Ink::V1::WorkGroupsController.
export interface WorkGroupMember {
	id: string; // 8-char short id
	full_id: string;
	title: string;
	category: string;
	priority: string;
	status: string;
	subproject: string | null;
	assignee: string | null;
	position: number;
	reporter_review_status: string | null;
	age_days: number;
}

export interface WorkGroup {
	id: string; // 8-char short id
	full_id: string;
	name: string;
	assignee: string;
	status: 'forming' | 'active' | 'parked' | 'shipped';
	target_version: string | null;
	position: number;
	member_count: number;
	shipped_at: string | null;
	created_at: string;
	issues?: WorkGroupMember[];
}

export interface WorkGroupBoard {
	groups: WorkGroup[];
	inbox: { total: number; shown: number; issues: WorkGroupMember[] };
	filters: { assignees: string[]; group_statuses: string[] };
}

export interface ShipResult extends WorkGroup {
	not_deploy_ready: Array<{ id: string; short_id: string; status: string; title: string }>;
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

	// Multipart POST (file uploads). Deliberately omits the Content-Type header
	// so the browser sets multipart/form-data with the correct boundary — if we
	// set it ourselves the boundary is lost and Rails can't parse the parts.
	// On a non-2xx the server may return a JSON { error } body; surface it.
	private async fetchMultipart<T>(endpoint: string, body: FormData): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, { method: 'POST', credentials: 'include', body });

		if (!response.ok) {
			if (response.status === 401) throw new InkApiError(401, 'NOT_AUTHENTICATED');
			if (response.status === 403) throw new InkApiError(403, 'FORBIDDEN');
			let detail = `API error: ${response.status} ${response.statusText}`;
			try {
				const data = await response.json();
				if (data?.error) detail = data.error;
			} catch {
				/* non-JSON body — keep the default */
			}
			throw new InkApiError(response.status, detail);
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

	// Feedback
	async getFeedbackDashboard(): Promise<FeedbackDashboardData> {
		return this.fetch('/issues');
	}

	async getFeedbackList(params: FeedbackIssueListParams = {}): Promise<FeedbackIssueListResponse> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.set('page', String(params.page));
		if (params.per_page) searchParams.set('per_page', String(params.per_page));
		if (params.sort) searchParams.set('sort', params.sort);
		if (params.direction) searchParams.set('direction', params.direction);
		if (params.status) searchParams.set('status', params.status);
		if (params.category) searchParams.set('category', params.category);
		if (params.priority) searchParams.set('priority', params.priority);
		if (params.reporter) searchParams.set('reporter', params.reporter);
		if (params.assignee) searchParams.set('assignee', params.assignee);
		if (params.q) searchParams.set('q', params.q);
		if (params.subproject) searchParams.set('subproject', params.subproject);
		if (params.inbox) searchParams.set('inbox', 'true');
		const qs = searchParams.toString();
		return this.fetch(`/issues/list${qs ? '?' + qs : ''}`);
	}

	// One issue's full (expanded) detail — for the triage viewer.
	async getFeedbackIssue(id: string): Promise<FeedbackIssueExpanded> {
		return this.fetch(`/issues/${id}`);
	}

	async updateIssuePriority(id: string, priority: string): Promise<FeedbackIssueExpanded> {
		return this.fetch(`/issues/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ priority })
		});
	}

	// assignee: a handle ("jeremy" / "andrew") to assign, or "" / "none" to unassign.
	async updateIssueAssignee(id: string, assignee: string): Promise<FeedbackIssueExpanded> {
		return this.fetch(`/issues/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ assignee })
		});
	}

	// ── Reporter verification queue ──────────────────────────────────────
	// The web complement to the Slack DM review loop. Scoped server-side to the
	// logged-in user's own reported issues via current_reporter_slack_id.
	// Admins may pass a reporter slack_user_id to view that user's queue
	// (read-only — the action endpoints stay reporter-gated server-side).

	async getVerifyQueue(reporter?: string): Promise<VerifyQueueResponse> {
		const qs = reporter ? `?reporter=${encodeURIComponent(reporter)}` : '';
		return this.fetch(`/issues/verify_queue${qs}`);
	}

	// Accept the fix — confirms the resolution and releases the reporter's next
	// queued review (Slack DM) if one is waiting.
	async confirmIssue(id: string): Promise<VerifyQueueItem> {
		return this.fetch(`/issues/${id}/confirm`, { method: 'POST' });
	}

	// Reject the fix (reopens the issue, notifies team + assignee). reason is
	// required; files are optional screenshot attachments. Sent as multipart so
	// the files ride along — the first multipart call in this client.
	async rejectIssue(id: string, reason: string, files?: File[]): Promise<VerifyQueueItem> {
		const form = new FormData();
		form.append('reason', reason);
		if (files) for (const f of files) form.append('images[]', f);
		return this.fetchMultipart(`/issues/${id}/reject`, form);
	}

	// "Send myself the verify message" — re-posts this item's review DM and makes
	// it the one Slack is waiting on.
	async resendReviewDm(id: string): Promise<{ ok: boolean }> {
		return this.fetch(`/issues/${id}/resend_review_dm`, { method: 'POST' });
	}

	// WorkGroups — the developer queue board
	async getWorkGroupBoard(): Promise<WorkGroupBoard> {
		return this.fetch('/work_groups');
	}

	async createWorkGroup(name: string, assignee: string, targetVersion?: string): Promise<WorkGroup> {
		return this.fetch('/work_groups', {
			method: 'POST',
			body: JSON.stringify({ name, assignee, target_version: targetVersion })
		});
	}

	async updateWorkGroup(
		id: string,
		patch: { name?: string; target_version?: string | null; status?: string; position?: number }
	): Promise<WorkGroup> {
		return this.fetch(`/work_groups/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
	}

	async deleteWorkGroup(id: string): Promise<{ ok: boolean; deleted: string; rehomed_to_inbox: number }> {
		return this.fetch(`/work_groups/${id}`, { method: 'DELETE' });
	}

	async shipWorkGroup(id: string, version: string): Promise<ShipResult> {
		return this.fetch(`/work_groups/${id}/ship`, { method: 'POST', body: JSON.stringify({ version }) });
	}

	// The unified drag endpoint. work_group_id null returns the issue to the
	// inbox; position is the 1-based slot within the destination group (omit to
	// append). Returns the full recomputed board (server is the source of truth
	// for sibling positions).
	async moveIssue(
		issueId: string,
		workGroupId: string | null,
		position?: number
	): Promise<WorkGroupBoard> {
		return this.fetch('/work_groups/move_issue', {
			method: 'POST',
			body: JSON.stringify({ issue_id: issueId, work_group_id: workGroupId, position })
		});
	}

	// Enrichment
	async getEnrichmentStatus(): Promise<EnrichmentStatus> {
		return this.fetch('/enrichment');
	}

	// Search performance dashboard (real-traffic telemetry; SearchMetrics)
	async getSearchPerformance(range: SearchPerfRange = '7d'): Promise<SearchPerformance> {
		return this.fetch(`/search_performance?range=${range}`);
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
		// API returns {fields: [...]} wrapper; unwrap so callers get a plain
		// array (matches the return-type annotation). Without this, the
		// MetadataForm Vocabulary Terms section's #each iterates a plain
		// object and renders nothing — issue 3d604d5a.
		const res = await this.fetch<{ fields: VocabularyField[] } | VocabularyField[]>(
			'/vocabulary_fields'
		);
		if (Array.isArray(res)) return res;
		return res?.fields ?? [];
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

	// Cross-field vocab term autocomplete for the BrowseNode filter picker.
	// Returns FilterTerm[] (id + name + field + count) ordered by usage.
	async searchVocabTerms(q: string, limit = 15): Promise<FilterTerm[]> {
		if (!q || q.length < 2) return [];
		const sp = new URLSearchParams({ q, limit: String(limit) });
		const res = await this.fetch<{ terms: FilterTerm[] }>(`/vocabulary_terms/search?${sp}`);
		return res.terms ?? [];
	}

	// Batch resolve term UUIDs to FilterTerm. Used to hydrate chips
	// for filters previously saved on a BrowseNode.
	async lookupVocabTerms(ids: string[]): Promise<FilterTerm[]> {
		if (!ids.length) return [];
		const sp = new URLSearchParams();
		for (const id of ids) sp.append('ids[]', id);
		const res = await this.fetch<{ terms: FilterTerm[] }>(`/vocabulary_terms/lookup?${sp}`);
		return res.terms ?? [];
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

	// Browse Editor
	async listBrowseNodes(filters: BrowseNodeListParams = {}): Promise<InkBrowseNode[]> {
		const searchParams = new URLSearchParams();
		if (filters.kind) searchParams.set('kind', filters.kind);
		if (filters.parent_id) searchParams.set('parent_id', filters.parent_id);
		if (filters.visibility) searchParams.set('visibility', filters.visibility);
		if (filters.q) searchParams.set('q', filters.q);
		if (filters.limit) searchParams.set('limit', String(filters.limit));
		const qs = searchParams.toString();
		// API returns { browse_nodes: [...] } — unwrap to a plain array for callers.
		const res = await this.fetch<{ browse_nodes: InkBrowseNode[] } | InkBrowseNode[]>(
			`/browse_nodes${qs ? '?' + qs : ''}`
		);
		if (Array.isArray(res)) return res;
		return res?.browse_nodes ?? [];
	}

	async getBrowseNode(id: string): Promise<InkBrowseNode> {
		const res = await this.fetch<{ browse_node: InkBrowseNode }>(`/browse_nodes/${id}`);
		return res.browse_node;
	}

	async createBrowseNode(payload: BrowseNodePayload): Promise<InkBrowseNode> {
		const res = await this.fetch<{ browse_node: InkBrowseNode }>('/browse_nodes', {
			method: 'POST',
			body: JSON.stringify({ browse_node: payload })
		});
		return res.browse_node;
	}

	async updateBrowseNode(id: string, payload: BrowseNodePayload): Promise<InkBrowseNode> {
		const res = await this.fetch<{ browse_node: InkBrowseNode }>(`/browse_nodes/${id}`, {
			method: 'PATCH',
			body: JSON.stringify({ browse_node: payload })
		});
		return res.browse_node;
	}

	// Atomic move (or cross-assign) for the BrowseTree drag-and-drop UX.
	// See app/controllers/api/ink/v1/browse_nodes_controller.rb#reorder for
	// the contract (move vs cross_assign, multi-parent 409, etc.).
	async reorderBrowseNode(id: string, payload: BrowseTreeReorderPayload): Promise<InkBrowseNode> {
		const res = await this.fetch<{ browse_node: InkBrowseNode }>(
			`/browse_nodes/${id}/reorder`,
			{ method: 'POST', body: JSON.stringify(payload) }
		);
		return res.browse_node;
	}

	async deleteBrowseNode(id: string): Promise<void> {
		const url = `${this.baseUrl}/browse_nodes/${id}`;
		const response = await fetch(url, {
			method: 'DELETE',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' }
		});
		if (!response.ok) throw new InkApiError(response.status, `Delete failed: ${response.statusText}`);
	}
}

// Search performance dashboard types (SearchMetrics#dashboard)
export type SearchPerfRange = '24h' | '7d' | '30d';
export interface SearchPerfSummary {
	total_searches: number;
	query_searches: number;
	p50_ms: number | null;
	p95_ms: number | null;
	p99_ms: number | null;
	avg_keyword_ms: number | null;
	avg_semantic_ms: number | null;
	avg_hybridize_ms: number | null;
	avg_results: number | null;
	zero_result_rate: number;
	zero_result_count: number;
}
export interface SearchPerfBucket {
	bucket: string;
	p50_ms: number | null;
	p95_ms: number | null;
	count: number;
}
export interface SearchPerfMode { mode: string; count: number }
export interface SearchPerfSlowest {
	query: string | null;
	mode: string;
	elapsed_ms: number | null;
	total_count: number;
	created_at: string;
}
export interface SearchPerfTopQuery { query: string; count: number; avg_ms: number | null; zero_count: number }
export interface SearchPerfZeroQuery { query: string; count: number; last_seen: string }
export interface SearchPerformance {
	range: string;
	since: string;
	summary: SearchPerfSummary;
	latency_series: SearchPerfBucket[];
	mode_breakdown: SearchPerfMode[];
	slowest: SearchPerfSlowest[];
	top_queries: SearchPerfTopQuery[];
	zero_result_queries: SearchPerfZeroQuery[];
}

export const inkApi = new InkApiClient(INK_BASE);
