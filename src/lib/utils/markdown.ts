import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Single `\n` → <br>, so plain-text review_steps from before markdown support
// still render with preserved line breaks (no surprise reflow for legacy issues).
marked.setOptions({ breaks: true, gfm: true });

/**
 * Render a text blob (plain text OR markdown) to sanitized HTML with docID
 * auto-linking. Safe to pass to {@html} in Svelte.
 *
 * Pipeline:
 *   1. marked parses markdown → raw HTML (plain text passes through unchanged).
 *   2. DOMPurify strips anything unsafe; we explicitly allow target/rel on <a>
 *      so external-link behavior works after sanitization.
 *   3. linkifyDocIds promotes bare docIDs (UUIDs and 4-7 digit numbers) to
 *      HSDL detail links — only the ones NOT already inside an <a> tag
 *      (see lookbehind in the regexes).
 */
export function renderMarkdown(text: string | null | undefined): string {
	if (!text) return '';
	const raw = marked.parse(text, { async: false }) as string;
	const safe = DOMPurify.sanitize(raw, {
		ADD_ATTR: ['target', 'rel']
	});
	return linkifyDocIds(safe);
}

/**
 * Promote bare docID references (UUIDs and 4-7 digit numbers, optionally
 * prefixed by `docID`, `docid`, or `#`) into HSDL detail-page links.
 *
 * Operates on already-rendered HTML: lookbehinds skip numbers that are
 * already the text inside an <a> tag so we don't double-link markdown
 * links like [479633](/details.html?id=479633).
 */
export function linkifyDocIds(html: string): string {
	// UUIDs — only when not already inside a href="..." or between > and </a>
	let result = html.replace(
		/(?<!href="[^"]*?)(?<!>)\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b(?![^<]*<\/a>)/gi,
		'<a href="/details.html?id=$1" target="_blank" rel="noopener" class="text-interactive hover:underline">$1</a>'
	);
	// "docID 479633" / "#479633" forms
	result = result.replace(
		/(?:docID\s*|docid\s*|#)(\d{4,7})\b/gi,
		(match, id) =>
			match.replace(
				id,
				`<a href="/details.html?id=${id}" target="_blank" rel="noopener" class="text-interactive hover:underline">${id}</a>`
			)
	);
	// Bare 5-7 digit numbers (likely docIDs) — skip if already linked
	result = result.replace(
		/(?<!href="[^"]*?)(?<!>)\b(\d{5,7})\b(?![^<]*<\/a>)/g,
		'<a href="/details.html?id=$1" target="_blank" rel="noopener" class="text-interactive hover:underline">$1</a>'
	);
	return result;
}
