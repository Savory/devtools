/**
 * @module
 * Renders the self-contained HTML page for the routes explorer.
 *
 * The page fetches the route map JSON from the devtools server and renders a
 * filterable, controller-grouped table of every HTTP route the application
 * exposes. Everything (styles, interactions) is inlined so the page works
 * without a build step.
 */

/**
 * Build the routes explorer HTML page.
 *
 * @param basePath The path the devtools server is mounted at (no trailing
 * slash), used to locate the `routes.json` endpoint and link back to the graph.
 * @returns A complete HTML document as a string.
 */
export function renderRoutesUI(basePath: string): string {
	const routesUrl = `${basePath}/routes.json`;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Danet Devtools — Routes</title>
<style>
	:root {
		--bg: #0f1117;
		--panel: #181b24;
		--border: #272b36;
		--text: #e6e8ee;
		--muted: #9aa0ad;
		--GET: #3aa0ff;
		--POST: #2ecc71;
		--PUT: #f39c12;
		--PATCH: #e67e22;
		--DELETE: #e74c3c;
		--OPTIONS: #9aa0ad;
		--HEAD: #9aa0ad;
		--ALL: #9b59b6;
	}
	* { box-sizing: border-box; }
	html, body { margin: 0; min-height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }
	#app { display: flex; flex-direction: column; min-height: 100vh; }
	header { display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--panel); position: sticky; top: 0; z-index: 5; }
	header h1 { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: .2px; }
	nav { display: flex; gap: 4px; }
	nav a { color: var(--muted); text-decoration: none; font-size: 13px; padding: 6px 10px; border-radius: 6px; border: 1px solid transparent; }
	nav a:hover { color: var(--text); border-color: var(--border); }
	nav a.active { color: var(--text); background: var(--bg); border-color: var(--border); }
	header .spacer { flex: 1; }
	header .stat { color: var(--muted); font-size: 12px; }
	header input, header select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
	header input { width: 240px; }
	main { flex: 1; padding: 18px; max-width: 1100px; width: 100%; margin: 0 auto; }
	.group { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; overflow: hidden; background: var(--panel); }
	.group > .head { display: flex; align-items: baseline; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
	.group > .head .name { font-size: 14px; font-weight: 600; }
	.group > .head .prefix { color: var(--muted); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.group > .head .mod { color: var(--muted); font-size: 12px; margin-left: auto; }
	.route { display: flex; align-items: center; gap: 14px; padding: 9px 16px; border-top: 1px solid var(--border); font-size: 13px; }
	.route:first-child { border-top: none; }
	.route .verb { flex: 0 0 64px; text-align: center; font-weight: 700; font-size: 11px; letter-spacing: .4px; padding: 3px 0; border-radius: 5px; color: #0b0d12; }
	.route .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text); word-break: break-all; }
	.route .path .param { color: #f1c40f; }
	.route .handler { color: var(--muted); margin-left: auto; font-size: 12px; }
	.route .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--muted); }
	.route .tag.sse { color: #2ecc71; border-color: #2ecc71; }
	.empty-routes { padding: 10px 16px; color: var(--muted); font-size: 12px; font-style: italic; }
	#empty, #error { display: none; padding: 40px; text-align: center; color: var(--muted); font-size: 14px; }
	#error { color: #ff8080; }
</style>
</head>
<body>
<div id="app">
	<header>
		<h1>🕸️ Danet Devtools</h1>
		<nav>
			<a href="${basePath}">Dependency Graph</a>
			<a href="${basePath}/routes" class="active">Routes</a>
		</nav>
		<span class="spacer"></span>
		<span class="stat" id="stat"></span>
		<input id="search" type="search" placeholder="Filter by path or handler…" />
		<select id="method">
			<option value="">All methods</option>
			<option value="GET">GET</option>
			<option value="POST">POST</option>
			<option value="PUT">PUT</option>
			<option value="PATCH">PATCH</option>
			<option value="DELETE">DELETE</option>
			<option value="OPTIONS">OPTIONS</option>
			<option value="HEAD">HEAD</option>
			<option value="ALL">ALL</option>
		</select>
	</header>
	<main>
		<div id="list"></div>
		<div id="empty">No routes match your filter.</div>
		<div id="error"></div>
	</main>
</div>
<script>
const ROUTES_URL = ${JSON.stringify(routesUrl)};
const VERB_COLORS = { GET: '#3aa0ff', POST: '#2ecc71', PUT: '#f39c12', PATCH: '#e67e22', DELETE: '#e74c3c', OPTIONS: '#9aa0ad', HEAD: '#9aa0ad', ALL: '#9b59b6' };

function esc(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function highlightParams(path) {
	return esc(path).replace(/(:[A-Za-z0-9_]+|\\*)/g, '<span class="param">$1</span>');
}

function routeRow(r) {
	const color = VERB_COLORS[r.method] || '#888';
	const tags = [];
	if (r.sse) tags.push('<span class="tag sse">SSE</span>');
	if (typeof r.statusCode === 'number') tags.push('<span class="tag">' + r.statusCode + '</span>');
	return '<div class="route" data-method="' + r.method + '" data-text="' + esc((r.path + ' ' + r.handler).toLowerCase()) + '">' +
		'<span class="verb" style="background:' + color + '">' + r.method + '</span>' +
		'<span class="path">' + highlightParams(r.path) + '</span>' +
		tags.join('') +
		'<span class="handler">' + esc(r.handler) + '()</span>' +
		'</div>';
}

function controllerGroup(c) {
	const rows = c.routes.length
		? c.routes.map(routeRow).join('')
		: '<div class="empty-routes">No routes declared.</div>';
	return '<section class="group" data-controller="' + esc(c.controller.toLowerCase()) + '">' +
		'<div class="head">' +
			'<span class="name">' + esc(c.controller) + '</span>' +
			'<span class="prefix">/' + esc(c.prefix) + '</span>' +
			'<span class="mod">' + esc(c.module) + '</span>' +
		'</div>' + rows +
		'</section>';
}

function applyFilter() {
	const q = document.getElementById('search').value.trim().toLowerCase();
	const verb = document.getElementById('method').value;
	let visible = 0;
	document.querySelectorAll('.group').forEach((group) => {
		let shown = 0;
		group.querySelectorAll('.route').forEach((row) => {
			const matchText = !q || row.dataset.text.includes(q);
			const matchVerb = !verb || row.dataset.method === verb;
			const ok = matchText && matchVerb;
			row.style.display = ok ? '' : 'none';
			if (ok) shown++;
		});
		group.style.display = shown ? '' : 'none';
		visible += shown;
	});
	document.getElementById('empty').style.display = visible ? 'none' : 'block';
}

async function main() {
	let map;
	try {
		const res = await fetch(ROUTES_URL, { headers: { accept: 'application/json' } });
		if (!res.ok) throw new Error('HTTP ' + res.status);
		map = await res.json();
	} catch (err) {
		const el = document.getElementById('error');
		el.style.display = 'block';
		el.textContent = 'Failed to load routes from ' + ROUTES_URL + ' — ' + err.message;
		return;
	}

	const controllers = map.controllers || [];
	const total = controllers.reduce((n, c) => n + c.routes.length, 0);
	document.getElementById('stat').textContent =
		total + ' routes · ' + controllers.length + ' controllers' +
		(map.prefix ? ' · prefix ' + map.prefix : '');

	document.getElementById('list').innerHTML = controllers.map(controllerGroup).join('');

	document.getElementById('search').oninput = applyFilter;
	document.getElementById('method').onchange = applyFilter;
}
main();
</script>
</body>
</html>`;
}
