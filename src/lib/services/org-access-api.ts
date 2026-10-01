// Org access admin API (INK, admin-only).
//
// Organization access is a licensing claim: every enabled rule says "everyone
// at this address counts as a registered user under our publishers' terms".
// Rails (production DB) is the only authority; these endpoints are the only UI.
// Contract: docs/plans/2026-10-01-org-access-ink.md, "API contract".
//
// Kept apart from ink-api.ts because 422s here carry structured field errors
// ({ errors: { field: [msg] } }) that the forms render next to each input, and
// the shared client flattens a non-2xx body into one message string.

import { INK_BASE, InkApiError } from './ink-api';

const BASE = `${INK_BASE}/org_access`;

// ── Vocabulary ──────────────────────────────────────────────────────────

export const ORG_TYPES = [
	'military',
	'federal',
	'tribal',
	'territorial',
	'state',
	'local',
	'university',
	'other'
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ROUTES = ['unknown', 'campus', 'vpn', 'ezproxy', 'openathens', 'other_proxy'] as const;
export type Route = (typeof ROUTES)[number];

export type RuleKind = 'cidr' | 'domain';

// Rule flags: broad_prefix zero_prefix catchall_glob overlaps_other_org
// duplicate_in_org proxy_egress proxy_shared unparseable.
// Org flags: no_enabled_rules gone_quiet review_due.
// Typed as string so a flag the server adds later still renders (labelled raw).
export type Flag = string;

export interface UserRef {
	id: string | number;
	name: string | null;
}

export interface OrgRef {
	id: number;
	name: string;
}

// ── Summary (dashboard) ─────────────────────────────────────────────────

export interface OrgAccessSummary {
	organizations: { total: number; enabled: number; with_enabled_rules: number };
	rules: {
		total: number;
		enabled: number;
		by_kind: { cidr: number; domain: number };
		by_route: Partial<Record<Route, number>>;
	};
	activity: { window_days: number; visits: number; orgs_seen: number; since: string };
	attention: {
		gone_quiet: number;
		flagged_rules: number; // addresses needing a look
		flagged_orgs?: number; // organizations holding them = the ?flag=flagged_rules list
		orgs_needing_attention?: number; // = the ?flag=flagged list
		review_due: number;
		pending_requests: number;
	};
	top_orgs: Array<{ id: number; name: string; visits: number }>;
}

// ── Organizations ───────────────────────────────────────────────────────

export interface OrgRow {
	id: number;
	legacy_id: number | null;
	name: string;
	disabled: boolean;
	org_type: OrgType | null;
	rules_enabled: number;
	rules_total: number;
	routes: Route[];
	visits_7d: number;
	visits_30d: number;
	last_seen_at: string | null;
	flags: Flag[];
	attention_rules?: number; // enabled addresses needing a look
}

export interface OrgListParams {
	q?: string;
	status?: 'enabled' | 'disabled' | 'all';
	flag?: string;
	sort?: 'activity' | 'name' | 'last_seen';
	page?: number;
	per?: number;
}

export interface OrgListResponse {
	organizations: OrgRow[];
	total: number;
	page: number;
	per: number;
}

// The fields a person can edit. `name` is shown to visitors verbatim.
export interface OrgEditable {
	name: string;
	disabled: boolean;
	org_type: OrgType | null;
	jurisdiction: string | null;
	city: string | null;
	state: string | null;
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
	secondary_contact: string | null;
	notes: string | null;
	review_by: string | null; // YYYY-MM-DD
}

export interface OrgFull extends OrgEditable {
	id: number;
	legacy_id: number | null;
	legacy_comments: string | null;
	source?: string;
	created_at: string;
	updated_at: string;
	created_by: UserRef | null;
	updated_by: UserRef | null;
	// Org-level and rule-level flags, as the org list shows them. The org page
	// works out the org-level ones itself only if a server omits this.
	flags?: Flag[];
}

export interface RuleOverlap {
	org_id: number;
	org_name: string;
	rule_id: number;
	cidr: string;
}

export interface RuleFull {
	id: number;
	organization_id: number;
	kind: RuleKind;
	cidr_text: string | null;
	domain_pattern: string | null;
	route: Route;
	note: string | null;
	justification: string | null;
	disabled: boolean;
	// The address as one string, whichever kind it is.
	pattern?: string | null;
	// CIDR rules only; null for host names and unreadable ranges.
	breadth?: Breadth | null;
	flags: Flag[];
	overlaps?: RuleOverlap[];
	visits_30d?: number;
	last_matched_at?: string | null;
	created_at?: string;
	updated_at?: string;
	created_by?: UserRef | null;
	updated_by?: UserRef | null;
}

// `addresses` is null for host-name rules, whose reach can't be counted.
export interface Breadth {
	addresses: number | null;
	label: string;
}

export interface HistoryEntry {
	at: string;
	who: UserRef | null;
	// Raw whodunnit for a non-person writer ("system:route-backfill"); null for people.
	actor?: string | null;
	item_type: string; // "Organization" | "OrgIpRule" | "OrgAccessRequest"
	item_id: number;
	event: string; // "create" | "update" | "destroy"
	// paper_trail object_changes: { field: [before, after] }
	changes: Record<string, [unknown, unknown]> | null;
}

export interface OrgDetail {
	organization: OrgFull;
	rules: RuleFull[];
	activity: {
		daily: Array<{ date: string; visits: number }>;
		recent: Array<{ started_at: string; rule_id: number | null; landing_page: string | null; masked_ip: string | null }>;
	};
	requests: RequestRow[];
	history: HistoryEntry[];
}

// ── Rules ───────────────────────────────────────────────────────────────

export interface RuleInput {
	kind: RuleKind;
	cidr_text?: string;
	domain_pattern?: string;
	route: Route;
	note?: string | null;
	justification?: string | null;
	disabled?: boolean;
}

// A warning may arrive as a plain sentence or as { code, message }.
export type ServerMessage = string | { code?: string; message: string; [k: string]: unknown };

export interface RuleSaveResult extends RuleFull {
	warnings?: ServerMessage[];
}

export interface RuleValidation {
	valid: boolean;
	normalized: string | null;
	// The corrected address when the typed one is fixable
	// ("205.155.65.236/16" -> "205.155.0.0/16", "204.17.196.*" -> "204.17.196.0/24").
	suggestion?: string | null;
	// A typed start-end range: the minimal networks that cover it exactly. With
	// one block the range is valid and `normalized` is that network; with more
	// it is an error, and each block has to be its own address.
	blocks?: string[] | null;
	errors: ServerMessage[]; // full sentences
	field_errors?: FieldErrors;
	warnings: ServerMessage[];
	suggested_route: Route | null; // only when the address is a known proxy
	breadth: Breadth | null;
}

// ── Address tester ──────────────────────────────────────────────────────

export type CandidateOutcome = 'winner' | 'shadowed' | 'disabled_rule' | 'disabled_org';

export interface IpTestResult {
	ip: string;
	parsed: boolean;
	ptr_host: string | null;
	// fcrdns, on a host-name match: true when a forward lookup of the reverse
	// DNS name led back to the address, false when it did not, null or absent
	// when not checked.
	matched: { organization: OrgRef; rule: RuleFull; matched_on: string; fcrdns?: boolean | null } | null;
	candidates: Array<{ rule: RuleFull; organization: OrgRef; outcome: CandidateOutcome; fcrdns?: boolean | null }>;
	explanation: string;
}

// ── Requests ────────────────────────────────────────────────────────────

export type RequestStatus = 'pending' | 'approved' | 'declined' | 'spam';

export interface RequestRow {
	id: number;
	org_name: string;
	display_name: string | null;
	org_type: OrgType | null;
	contact_name: string | null;
	contact_email: string | null;
	status: RequestStatus;
	organization_id: number | null;
	submitted_ip: string | null;
	created_at: string;
}

export interface RequestFull extends RequestRow {
	ip_ranges: string | null;
	proxy_addresses: string | null;
	ticket_number: string | null;
	contact_phone: string | null;
	secondary_contact: string | null;
	message: string | null;
	submitted_org_id: number | null;
	submitted_org?: OrgRef | null;
	reviewed_by?: UserRef | null;
	reviewed_at: string | null;
	review_note: string | null;
	organization?: OrgRef | null;
}

// One row per organization. `detail` says which existing rule covers which
// submitted range ("65.242.0.0/16 covers 65.242.55.0/32").
export interface SuggestedMatch {
	id: number;
	name: string;
	reasons: string[]; // "covers_range" | "similar_name", strongest first
	detail: string | null;
	disabled: boolean;
}

// Each network the requester typed, parsed the way a rule would be.
export interface ParsedRange {
	field: 'ip_ranges' | 'proxy_addresses';
	input: string;
	normalized: string | null;
	error: string | null;
	suggestion: string | null;
	suggested_route: Route | null;
}

export interface RequestDetail {
	request: RequestFull;
	parsed_ranges: ParsedRange[];
	suggested_matches: SuggestedMatch[];
}

export interface ApproveBody {
	organization?: Partial<OrgEditable>;
	organization_id?: number;
	rules: RuleInput[];
}

// The match row has carried the organization both flat ({id, name}) and
// nested ({organization: {id, name}}), and one `reason` or a `reasons` list.
type RawMatch = Partial<SuggestedMatch> & {
	organization?: OrgRef;
	reason?: string;
	covered?: Array<{ input: string; cidr: string }>;
};

function normalizeMatch(m: RawMatch): SuggestedMatch {
	const covered = m.covered?.map((c) => `${c.cidr} covers ${c.input}`).join('; ');
	return {
		id: m.organization?.id ?? (m.id as number),
		name: m.organization?.name ?? m.name ?? '',
		reasons: m.reasons?.length ? m.reasons : m.reason ? [m.reason] : [],
		detail: m.detail ?? (covered || null),
		disabled: !!m.disabled
	};
}

// ── Machine access keys ─────────────────────────────────────────────────
// Bearer keys for machine readers (CHDS Pulse's usage feed). INK lists and
// revokes them; it never creates one, so the plaintext key never crosses the
// web. Keys are made with `bin/rails service_keys:create`.

export interface ServiceKey {
	id: number;
	name: string;
	token_prefix: string; // the key's first characters, e.g. "hsdlk_Ab3xYz"
	scopes: string[];
	last_used_at: string | null;
	revoked_at: string | null;
	revoked: boolean;
	created_at: string;
	created_by: UserRef | null;
}

// ── Errors ──────────────────────────────────────────────────────────────

export type FieldErrors = Record<string, string[]>;

// A 422 from a write. `fields` maps an attribute to its messages; for approve,
// `rules[i]` holds the errors for the i-th submitted address ({} or null when fine).
export class OrgAccessValidationError extends InkApiError {
	fields: FieldErrors;
	rules: Array<FieldErrors | null>;
	constructor(fields: FieldErrors, rules: Array<FieldErrors | null> = []) {
		super(422, firstMessage(fields, rules) ?? 'Please fix the highlighted fields.');
		this.name = 'OrgAccessValidationError';
		this.fields = fields;
		this.rules = rules;
	}
}

function firstMessage(fields: FieldErrors, rules: Array<FieldErrors | null>): string | null {
	for (const msgs of Object.values(fields)) if (msgs?.length) return msgs[0];
	for (const r of rules) if (r) for (const msgs of Object.values(r)) if (msgs?.length) return msgs[0];
	return null;
}

function toMessages(v: unknown): string[] {
	if (v == null) return [];
	if (Array.isArray(v)) return v.map((m) => (typeof m === 'string' ? m : messageText(m as ServerMessage)));
	if (typeof v === 'string') return [v];
	return [String(v)];
}

// Rails field errors are fragments ("can't be blank", "is required for a
// network this broad…"); some are already sentences ("205.155.65.236/16 is
// really 205.155.0.0/16 — use that?"). Give a fragment its subject so it reads
// on its own under the field and in a summary line.
const FIELD_SUBJECTS: Record<string, string> = {
	name: 'The name',
	cidr_text: 'This address',
	domain_pattern: 'This host name',
	justification: 'A reason',
	route: '“How they connect”',
	organization_id: 'The organization',
	contact_email: 'The contact email',
	review_by: 'The review date',
	base: ''
};

export function asSentence(field: string, msg: string): string {
	if (!msg || /^[A-Z0-9*“"]/.test(msg)) return msg;
	const subject = FIELD_SUBJECTS[field] ?? field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
	const text = subject ? `${subject} ${msg}` : msg.replace(/^./, (c) => c.toUpperCase());
	return /[.?!]$/.test(text) ? text : `${text}.`;
}

function toFieldErrors(v: unknown): FieldErrors {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return v ? { base: toMessages(v) } : {};
	const out: FieldErrors = {};
	for (const [k, msgs] of Object.entries(v as Record<string, unknown>)) {
		if (k === 'rules' || k === 'organization') continue;
		out[k] = toMessages(msgs).map((m) => asSentence(k, m));
	}
	return out;
}

// Accepts { errors: {field: [msg]} } and, for approve, also
// { errors: { organization: {...}, rules: [ {...} | null ] } }.
export function parseValidationBody(body: unknown): OrgAccessValidationError {
	const errors = (body as { errors?: unknown })?.errors;
	if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
		const msg = (body as { error?: string })?.error;
		return new OrgAccessValidationError({ base: toMessages(errors ?? msg ?? 'Could not save.') });
	}
	const e = errors as Record<string, unknown>;
	const fields = { ...toFieldErrors(e), ...toFieldErrors(e.organization) };
	const rules = Array.isArray(e.rules) ? e.rules.map((r) => (r ? toFieldErrors(r) : null)) : [];
	return new OrgAccessValidationError(fields, rules);
}

export function messageText(m: ServerMessage): string {
	return typeof m === 'string' ? m : (m?.message ?? '');
}

export function isForbidden(err: unknown): boolean {
	return err instanceof InkApiError && err.status === 403;
}

// ── Client ──────────────────────────────────────────────────────────────

async function call<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${BASE}${path}`, {
		...init,
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});
	if (response.ok) return response.json();

	if (response.status === 401) throw new InkApiError(401, 'NOT_AUTHENTICATED');
	if (response.status === 403) throw new InkApiError(403, 'FORBIDDEN');
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		/* non-JSON body — keep the default below */
	}
	if (response.status === 422) throw parseValidationBody(body);
	const b = body as { error?: string; message?: string } | null;
	throw new InkApiError(response.status, b?.error ?? b?.message ?? `API error: ${response.status} ${response.statusText}`);
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function qs(params: Record<string, string | number | undefined | null>): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
	const s = sp.toString();
	return s ? `?${s}` : '';
}

export const orgAccessApi = {
	summary: () => call<OrgAccessSummary>('/summary'),

	listOrganizations: (p: OrgListParams = {}) =>
		call<OrgListResponse>(`/organizations${qs({ ...p })}`),
	getOrganization: (id: number | string) => call<OrgDetail>(`/organizations/${id}`),
	// Both answer with the full organization page payload.
	createOrganization: (body: Partial<OrgEditable>) => call<OrgDetail>('/organizations', json('POST', body)),
	updateOrganization: (id: number | string, body: Partial<OrgEditable>) =>
		call<OrgDetail>(`/organizations/${id}`, json('PATCH', body)),

	createRule: (orgId: number | string, body: RuleInput) =>
		call<RuleSaveResult>(`/organizations/${orgId}/rules`, json('POST', body)),
	updateRule: (id: number | string, body: Partial<RuleInput>) =>
		call<RuleSaveResult>(`/rules/${id}`, json('PATCH', body)),
	// rule_id (not in the contract) lets the server skip the rule being edited
	// when it checks for duplicates; servers that predate it ignore it.
	validateRule: (body: RuleInput & { organization_id?: number; rule_id?: number }, signal?: AbortSignal) =>
		call<RuleValidation>('/rules/validate', { ...json('POST', body), signal }),

	// No ip → the server tests the caller's own address.
	ipTest: (ip?: string) => call<IpTestResult>(`/ip_test${qs({ ip })}`),

	listRequests: (status?: RequestStatus | 'all') =>
		call<{ requests: RequestRow[] }>(`/requests${qs({ status: status === 'all' ? undefined : status })}`),
	getRequest: async (id: number | string): Promise<RequestDetail> => {
		const data = await call<{ request: RequestFull; parsed_ranges?: ParsedRange[]; suggested_matches?: RawMatch[] }>(
			`/requests/${id}`
		);
		return {
			request: data.request,
			parsed_ranges: data.parsed_ranges ?? [],
			suggested_matches: (data.suggested_matches ?? []).map(normalizeMatch)
		};
	},
	updateRequest: (
		id: number | string,
		body: { status?: RequestStatus; review_note?: string | null; organization_id?: number | null }
	) => call<{ request: RequestFull }>(`/requests/${id}`, json('PATCH', body)),
	listServiceKeys: () => call<{ service_keys: ServiceKey[] }>('/service_keys'),
	revokeServiceKey: (id: number | string) =>
		call<{ service_key: ServiceKey }>(`/service_keys/${id}/revoke`, { method: 'POST' }),

	approveRequest: (id: number | string, body: ApproveBody) =>
		call<{ request: RequestFull; organization: OrgFull; rules: RuleFull[]; warnings: ServerMessage[] }>(
			`/requests/${id}/approve`,
			json('POST', body)
		)
};
