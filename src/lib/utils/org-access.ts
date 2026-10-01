// Plain-language vocabulary and pure helpers for the org access screens.
//
// The person using these screens administers access, not networks. Every label
// here answers "what does this mean for a visitor?" rather than naming the
// mechanism. Keep the words in one place so the dashboard, the list, the org
// page and the address tester never describe the same thing two ways.

import type {
	CandidateOutcome,
	HistoryEntry,
	OrgType,
	RequestStatus,
	Route,
	RuleFull,
	RuleInput,
	RuleKind
} from '$lib/services/org-access-api';

export type Tone = 'error' | 'warning' | 'info' | 'success' | 'neutral';

// Chip/box classes per tone. Text stays on the primary text token in every tone:
// the light-mode warning token is a bright yellow that fails contrast as text,
// so tones color the background and border only (both modes verified via the
// *-light tokens in app.css).
export const TONE_CLASSES: Record<Tone, string> = {
	error: 'bg-error-light border-error text-text-theme-primary',
	warning: 'bg-warning-light border-warning text-text-theme-primary',
	info: 'bg-info-light border-info text-text-theme-primary',
	success: 'bg-success-light border-success text-text-theme-primary',
	neutral: 'bg-surface-secondary border-border-theme text-text-theme-secondary'
};

export const ROUTE_INFO: Record<Route, { label: string; help: string }> = {
	unknown: { label: 'Not sure', help: 'We have not recorded how these visitors reach us.' },
	campus: { label: 'Campus network', help: "The organization's own network: on-site computers and Wi-Fi." },
	vpn: { label: 'VPN', help: "Staff working remotely through the organization's VPN." },
	ezproxy: { label: 'EZproxy', help: "The library's EZproxy server forwards its users to us." },
	openathens: { label: 'OpenAthens', help: 'OpenAthens forwards the organization’s users to us from its own servers.' },
	other_proxy: { label: 'Other proxy', help: 'Another proxy service forwards the organization’s users to us.' }
};

export function routeLabel(route: string | null | undefined): string {
	return ROUTE_INFO[route as Route]?.label ?? route ?? 'Not sure';
}

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
	military: 'Military',
	federal: 'Federal',
	tribal: 'Tribal',
	territorial: 'Territorial',
	state: 'State',
	local: 'Local',
	university: 'University or college',
	other: 'Other'
};

export function orgTypeLabel(t: string | null | undefined): string {
	if (!t) return '—';
	return ORG_TYPE_LABELS[t as OrgType] ?? t;
}

export const FLAG_INFO: Record<string, { label: string; help: string; tone: Tone }> = {
	// Address (rule) flags
	broad_prefix: {
		label: 'Very broad',
		help: 'Covers a very large block of addresses. Keep a reason on file for why the whole block belongs to this organization.',
		tone: 'warning'
	},
	zero_prefix: { label: 'Covers everyone', help: 'This would match every address on the internet.', tone: 'error' },
	catchall_glob: {
		label: 'Catch-all name',
		help: 'Matches every host under a whole top-level domain (like *.mil), not just this organization.',
		tone: 'warning'
	},
	overlaps_other_org: {
		label: 'Overlaps another org',
		help: 'Part of this range also belongs to a different organization. The more specific range wins.',
		tone: 'warning'
	},
	duplicate_in_org: { label: 'Duplicate', help: 'This organization already has this exact address.', tone: 'error' },
	proxy_egress: {
		label: 'Proxy address',
		help: "A proxy service's outgoing address. It should belong to exactly one customer.",
		tone: 'info'
	},
	proxy_shared: {
		label: 'Proxy shared',
		help: 'The same proxy address is on two or more organizations. Visitors get whichever organization wins.',
		tone: 'warning'
	},
	unparseable: { label: "Can't be read", help: 'This address is not a valid range or host name. It matches nothing.', tone: 'error' },
	// Organization flags
	no_enabled_rules: {
		label: 'No active addresses',
		help: 'Nothing grants this organization access right now.',
		tone: 'warning'
	},
	gone_quiet: {
		label: 'Quiet for 30 days',
		help: 'People used to arrive from these addresses, but nobody has in the last 30 days. The organization’s addresses may have changed.',
		tone: 'info'
	},
	review_due: { label: 'Review due', help: 'The review date on file has passed.', tone: 'warning' }
};

// Filters the org list accepts beyond single flags.
const FILTER_INFO: Record<string, { label: string; help: string; tone: Tone }> = {
	flagged_rules: {
		label: 'Addresses to check',
		help: 'Has an active address worth a second look: very broad without a reason, overlapping, a shared proxy, unreadable.',
		tone: 'warning'
	},
	flagged: {
		label: 'Anything to check',
		help: 'Quiet for 30 days, past its review date, or has an address worth a second look.',
		tone: 'warning'
	}
};

export function flagInfo(flag: string): { label: string; help: string; tone: Tone } {
	if (FILTER_INFO[flag]) return FILTER_INFO[flag];
	return FLAG_INFO[flag] ?? { label: flag.replace(/_/g, ' '), help: '', tone: 'neutral' };
}

// The org list's flag filter: org flags first (what an admin asks about), then
// the address flags meaning "has an address with this flag".
export const FILTER_FLAGS = [
	'flagged_rules',
	'gone_quiet',
	'review_due',
	'no_enabled_rules',
	'broad_prefix',
	'catchall_glob',
	'overlaps_other_org',
	'proxy_shared',
	'unparseable'
] as const;

export const OUTCOME_INFO: Record<CandidateOutcome, { label: string; help: string; tone: Tone }> = {
	winner: { label: 'Grants access', help: 'This is the address that decides.', tone: 'success' },
	shadowed: {
		label: 'Overruled',
		help: 'This address also matches, but a more specific one wins.',
		tone: 'neutral'
	},
	disabled_rule: { label: 'Address turned off', help: 'Would match, but this address is turned off.', tone: 'warning' },
	disabled_org: {
		label: 'Organization turned off',
		help: 'Would match, but the whole organization is turned off.',
		tone: 'warning'
	}
};

export function outcomeInfo(o: string) {
	return OUTCOME_INFO[o as CandidateOutcome] ?? { label: o.replace(/_/g, ' '), help: '', tone: 'neutral' as Tone };
}

export const REQUEST_STATUS_INFO: Record<RequestStatus, { label: string; tone: Tone }> = {
	pending: { label: 'Waiting', tone: 'info' },
	approved: { label: 'Approved', tone: 'success' },
	declined: { label: 'Declined', tone: 'neutral' },
	spam: { label: 'Spam', tone: 'neutral' }
};

// ── Address text ────────────────────────────────────────────────────────

export function ruleTarget(rule: Pick<RuleFull, 'kind' | 'cidr_text' | 'domain_pattern' | 'pattern'>): string {
	return rule.pattern ?? (rule.kind === 'domain' ? rule.domain_pattern : rule.cidr_text) ?? '';
}

const IPV4_LIKE = /^\d{1,3}(\.\d{1,3}){0,3}(\/\d{1,2})?$/;
// "65.242.55.0 - 65.242.55.255", "…–…", "… to …": a start-end range. The
// server turns it into the network (or networks) it covers.
const ADDRESS_RANGE = /^[0-9a-f:.]*\d[0-9a-f:.]*\s*(?:-|–|—|\bto\b)\s*[0-9a-f:.]*\d[0-9a-f:.]*$/i;

// What a typed address most likely is. A glob ("204.17.196.*", "*.mil") is a
// host-name pattern, matched against reverse DNS or the address text; only a
// plain address or CIDR block is a network range. An IPv6 address has a colon.
export function detectKind(value: string): RuleKind {
	const v = value.trim();
	if (!v) return 'cidr';
	if (v.includes('*')) return 'domain';
	if (IPV4_LIKE.test(v)) return 'cidr';
	if (ADDRESS_RANGE.test(v) && /[.:]/.test(v)) return 'cidr';
	if (v.includes(':') && /^[0-9a-f:./]+$/i.test(v)) return 'cidr';
	return 'domain';
}

// Would the server require a written reason? Mirrors the model rule so the field
// appears as Eric types instead of after a failed save. The server stays the
// judge: its validation errors are shown regardless of this guess.
export function needsJustification(kind: RuleKind, value: string): boolean {
	const v = value.trim().toLowerCase();
	if (!v) return false;
	if (kind === 'domain') return v === '*' || /^\*\.[a-z0-9-]+$/.test(v);
	const m = v.match(/\/(\d{1,3})$/);
	if (!m) return false;
	const prefix = Number(m[1]);
	return v.includes(':') ? prefix < 32 : prefix < 16;
}

function ipv4ToInt(ip: string): number | null {
	const parts = ip.trim().split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const p of parts) {
		if (!/^\d{1,3}$/.test(p)) return null;
		const o = Number(p);
		if (o > 255) return null;
		n = n * 256 + o;
	}
	return n;
}

function intToIpv4(n: number): string {
	return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
}

// "65.242.55.0 - 65.242.55.255" → ["65.242.55.0/24"]. Request forms collect
// ranges the way people write them; rules need CIDR blocks. Returns null for
// anything that is not an IPv4 start-end pair.
export function rangeToCidrs(text: string): string[] | null {
	const m = text.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*(?:-|–|—|to)\s*(\d{1,3}(?:\.\d{1,3}){3})$/i);
	if (!m) return null;
	let start = ipv4ToInt(m[1]);
	const end = ipv4ToInt(m[2]);
	if (start === null || end === null || end < start) return null;
	const out: string[] = [];
	while (start <= end) {
		let size = 32;
		// Grow the block while it stays aligned on `start` and inside the range.
		while (size > 0) {
			const block = 2 ** (32 - (size - 1));
			if (start % block !== 0 || start + block - 1 > end) break;
			size--;
		}
		out.push(`${intToIpv4(start)}/${size}`);
		start += 2 ** (32 - size);
		if (out.length > 64) return null; // not a range anyone means
	}
	return out;
}

// Split a free-text "IP ranges" answer into one entry per address, expanding
// start-end ranges into CIDR blocks. Unrecognised entries pass through so the
// live validation can say what is wrong with them.
export function parseAddressList(text: string | null | undefined): string[] {
	if (!text) return [];
	const out: string[] = [];
	for (const raw of text.split(/[\n,;]+/)) {
		const piece = raw.trim();
		if (!piece) continue;
		const expanded = rangeToCidrs(piece);
		if (expanded) {
			out.push(...expanded);
			continue;
		}
		// "1.2.3.4 5.6.7.8" on one line: two addresses. A range keeps its spaces.
		out.push(...piece.split(/\s+/).filter(Boolean));
	}
	return [...new Set(out)];
}

// ── Numbers and dates ───────────────────────────────────────────────────

const nf = new Intl.NumberFormat('en-US');

export function fmtNumber(n: number | null | undefined): string {
	return n == null ? '—' : nf.format(n);
}

export function fmtDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	// A bare date ("2026-10-01") is a calendar day, not midnight UTC.
	const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relativeDays(iso: string | null | undefined, now: Date = new Date()): string {
	if (!iso) return 'Never';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
	if (days <= 0) return 'Today';
	if (days === 1) return 'Yesterday';
	if (days < 60) return `${days} days ago`;
	return fmtDate(iso);
}

// ── History ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
	name: 'Name visitors see',
	disabled: 'Turned off',
	org_type: 'Type',
	jurisdiction: 'Jurisdiction',
	city: 'City',
	state: 'State',
	contact_name: 'Contact name',
	contact_email: 'Contact email',
	contact_phone: 'Contact phone',
	secondary_contact: 'Other contacts',
	notes: 'Notes',
	review_by: 'Review by',
	cidr_text: 'Address range',
	domain_pattern: 'Host name',
	kind: 'Kind',
	route: 'How they connect',
	note: 'Note',
	justification: 'Reason',
	status: 'Status',
	review_note: 'Review note',
	organization_id: 'Linked organization'
};

// Bookkeeping columns nobody needs to read in a history list.
const HIDDEN_FIELDS = new Set([
	'id',
	'created_at',
	'updated_at',
	'created_by_id',
	'updated_by_id',
	'reviewed_by_id',
	'source',
	'synced_at',
	'legacy_id'
]);

function showValue(field: string, v: unknown): string {
	if (v === null || v === undefined || v === '') return '(blank)';
	if (field === 'disabled') return v ? 'yes' : 'no';
	if (field === 'route') return routeLabel(String(v));
	if (field === 'org_type') return orgTypeLabel(String(v));
	if (field === 'kind') return v === 'domain' ? 'host name' : v === 'cidr' ? 'network range' : String(v);
	if (typeof v === 'boolean') return v ? 'yes' : 'no';
	return String(v);
}

export function describeChanges(entry: HistoryEntry): Array<{ field: string; before: string; after: string }> {
	if (!entry.changes) return [];
	return Object.entries(entry.changes)
		.filter(([f]) => !HIDDEN_FIELDS.has(f))
		// An address's own organization is the page you're on.
		.filter(([f]) => !(entry.item_type === 'OrgIpRule' && f === 'organization_id'))
		.map(([f, pair]) => {
			const [before, after] = Array.isArray(pair) ? pair : [null, pair];
			return { field: FIELD_LABELS[f] ?? f.replace(/_/g, ' '), before: showValue(f, before), after: showValue(f, after) };
		});
}

// Who made a change: a person's name, or a plain reading of a system writer
// ("system:route-backfill" -> "System (route backfill)").
export function historyActor(entry: HistoryEntry): string {
	if (entry.who?.name) return entry.who.name;
	const actor = entry.actor?.trim();
	if (!actor) return 'System';
	const m = actor.match(/^system:(.+)$/);
	return m ? `System (${m[1].replace(/[-_]/g, ' ')})` : actor;
}

export function describeHistoryEvent(entry: HistoryEntry): string {
	const what =
		entry.item_type === 'OrgIpRule'
			? 'address'
			: entry.item_type === 'OrgAccessRequest'
				? 'request'
				: 'organization';
	if (entry.event === 'create') return `Added ${what}`;
	if (entry.event === 'destroy') return `Removed ${what}`;
	const changes = entry.changes ?? {};
	if ('disabled' in changes && Object.keys(changes).filter((k) => !HIDDEN_FIELDS.has(k)).length === 1) {
		const after = (changes.disabled as [unknown, unknown])[1];
		return after ? `Turned off ${what}` : `Turned on ${what}`;
	}
	return `Changed ${what}`;
}

// ── Address drafts (the add/edit form and the approve flow) ─────────────

export interface RuleDraft {
	value: string;
	route: Route;
	note: string;
	justification: string;
	disabled: boolean;
	// Once a person picks a route themselves, a server suggestion never overwrites it.
	routeTouched: boolean;
}

export function emptyDraft(value = '', route: Route = 'unknown'): RuleDraft {
	return { value, route, note: '', justification: '', disabled: false, routeTouched: route !== 'unknown' };
}

export function draftFromRule(rule: RuleFull): RuleDraft {
	return {
		value: ruleTarget(rule),
		route: rule.route ?? 'unknown',
		note: rule.note ?? '',
		justification: rule.justification ?? '',
		disabled: rule.disabled,
		routeTouched: true
	};
}

export function draftToInput(d: RuleDraft): RuleInput {
	const kind = detectKind(d.value);
	const value = d.value.trim();
	return {
		kind,
		...(kind === 'cidr' ? { cidr_text: value } : { domain_pattern: value }),
		route: d.route,
		note: d.note.trim() || null,
		justification: d.justification.trim() || null,
		disabled: d.disabled
	};
}

// ── One-shot notice across a navigation ─────────────────────────────────
// Approving a request lands on the new organization's page; the server's
// warnings from that approval (overlaps, shared proxies) are shown there once.

let flash: { tone: Tone; lines: string[] } | null = null;

export function setFlash(notice: { tone: Tone; lines: string[] }) {
	flash = notice;
}

export function takeFlash(): { tone: Tone; lines: string[] } | null {
	const f = flash;
	flash = null;
	return f;
}

// ── Machine access keys ─────────────────────────────────────────────────

export const SCOPE_INFO: Record<string, { label: string; help: string }> = {
	org_access_feed: {
		label: 'Organization usage feed',
		help: 'Daily visit counts per organization (no addresses or visitor details), read by CHDS Pulse.'
	}
};

export function scopeLabel(scope: string): string {
	return SCOPE_INFO[scope]?.label ?? scope.replace(/_/g, ' ');
}
