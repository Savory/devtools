/**
 * @module
 * Renders the self-contained HTML page for the routes explorer.
 *
 * The page fetches the route map JSON from the devtools server and renders a
 * filterable, controller-grouped list of every entrypoint the application
 * exposes (HTTP routes and WebSocket handlers). Selecting an entrypoint shows
 * its execution flow — the middlewares, guards and filters bound to it — much
 * like the NestJS Devtools "Routes explorer". Everything (styles, interactions)
 * is inlined so the page works without a build step.
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
		--panel2: #1f2330;
		--border: #272b36;
		--text: #e6e8ee;
		--muted: #9aa0ad;
		--accent: #e5397f;
	}
	* { box-sizing: border-box; }
	html, body { margin: 0; height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }
	#app { display: flex; flex-direction: column; height: 100%; }
	header { display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--panel); }
	header h1 { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: .2px; white-space: nowrap; }
	nav { display: flex; gap: 4px; }
	nav a { color: var(--muted); text-decoration: none; font-size: 13px; padding: 6px 10px; border-radius: 6px; border: 1px solid transparent; }
	nav a:hover { color: var(--text); border-color: var(--border); }
	nav a.active { color: var(--text); background: var(--bg); border-color: var(--border); }
	header .spacer { flex: 1; }
	header .stat { color: var(--muted); font-size: 12px; white-space: nowrap; }
	header input, header select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
	header input { width: 220px; }
	main { flex: 1; display: flex; min-height: 0; }
	#sidebar { width: 440px; max-width: 50%; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; padding: 14px; }
	#sidebar .filtering { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 0 0 10px 2px; }
	.group { margin-bottom: 14px; }
	.group > .head { display: flex; align-items: baseline; gap: 8px; padding: 0 2px 6px; }
	.group > .head .name { font-size: 13px; font-weight: 600; }
	.group > .head .prefix { color: var(--muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.group > .head .mod { color: var(--muted); font-size: 11px; margin-left: auto; }
	.route { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; cursor: pointer; background: var(--bg); }
	.route:hover { border-color: #3a4150; }
	.route.selected { border-color: var(--accent); background: var(--panel2); }
	.route .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; word-break: break-all; }
	.route .path .param { color: #f1c40f; }
	.route .pipe { margin-left: auto; color: var(--muted); font-size: 11px; white-space: nowrap; }
	.route .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border); color: var(--muted); }
	.route .tag.sse { color: #2ecc71; border-color: #2ecc71; }
	.verb { flex: 0 0 58px; text-align: center; font-weight: 700; font-size: 11px; letter-spacing: .4px; padding: 3px 0; border-radius: 5px; }
	.empty-routes { padding: 6px 10px; color: var(--muted); font-size: 12px; font-style: italic; }

	#detail { flex: 1; overflow: auto; padding: 26px; }
	#detail .placeholder { color: var(--muted); font-size: 14px; display: flex; height: 100%; align-items: center; justify-content: center; text-align: center; }
	#detail h2 { font-size: 15px; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
	#detail .sub { color: var(--muted); font-size: 12px; margin-bottom: 26px; }
	#detail .sub code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text); }
	.flow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
	.lane { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
	.lane > .lane-head { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); text-align: center; margin-bottom: 2px; }
	.box { background: var(--panel2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; min-width: 130px; text-align: center; }
	.box .bname { font-size: 13px; font-weight: 500; }
	.box .bscope { font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin-top: 2px; }
	.box.handler { background: linear-gradient(180deg, #e5397f, #c52e6b); border-color: #e5397f; }
	.box.handler .bname { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff; }
	.box.handler .bscope { color: rgba(255,255,255,.85); }
	.arrow { color: #5a6072; font-size: 18px; padding: 0 6px; align-self: center; margin-top: 16px; }
	.note { margin-top: 26px; color: var(--muted); font-size: 12px; line-height: 1.5; max-width: 640px; }
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
		<input id="search" type="search" placeholder="Filter entrypoints…" />
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
			<option value="WS">WS</option>
		</select>
	</header>
	<main>
		<aside id="sidebar">
			<p class="filtering">Filtering</p>
			<div id="list"></div>
			<div id="empty">No entrypoints match your filter.</div>
			<div id="error"></div>
		</aside>
		<section id="detail">
			<div class="placeholder" id="placeholder">Select an entrypoint to see its execution flow.</div>
		</section>
	</main>
</div>
<script>
const ROUTES_URL = ${JSON.stringify(routesUrl)};
// NestJS-inspired verb palette: translucent colored pill + matching text.
const VERB_COLORS = {
	GET: '#10b981', POST: '#ec4899', PUT: '#3b82f6', PATCH: '#94a3b8',
	DELETE: '#a855f7', OPTIONS: '#64748b', HEAD: '#64748b', ALL: '#f59e0b', WS: '#06b6d4',
};
const STAGE_LABEL = { middleware: 'Middleware', guard: 'Guards', filter: 'Filters' };
let selectedEl = null;

function esc(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function highlightParams(path) {
	return esc(path).replace(/(:[A-Za-z0-9_]+|\\*)/g, '<span class="param">$1</span>');
}
function verbBadge(method) {
	const c = VERB_COLORS[method] || '#888';
	return '<span class="verb" style="color:' + c + ';background:' + c + '22">' + esc(method) + '</span>';
}

function routeRow(r) {
	const tags = [];
	if (r.sse) tags.push('<span class="tag sse">SSE</span>');
	if (typeof r.statusCode === 'number') tags.push('<span class="tag">' + r.statusCode + '</span>');
	const pipe = r.bindings.length
		? '<span class="pipe">' + r.bindings.length + ' in pipeline</span>'
		: '';
	const row = document.createElement('div');
	row.className = 'route';
	row.dataset.method = r.method;
	row.dataset.text = (r.path + ' ' + r.handler).toLowerCase();
	row.innerHTML = verbBadge(r.method) +
		'<span class="path">' + highlightParams(r.path) + '</span>' +
		tags.join('') + pipe;
	return row;
}

function box(binding) {
	return '<div class="box"><div class="bname">' + esc(binding.name) + '</div>' +
		'<div class="bscope">' + esc(binding.scope) + '</div></div>';
}
function lane(stage, bindings) {
	const boxes = bindings.filter((b) => b.stage === stage);
	if (!boxes.length) return '';
	return '<div class="lane"><div class="lane-head">' + STAGE_LABEL[stage] + '</div>' +
		boxes.map(box).join('') + '</div>';
}
const ARROW = '<span class="arrow">→</span>';

function renderFlow(r, controller) {
	const handlerLane = '<div class="lane">' +
		'<div class="lane-head">' + esc(controller.controller) + '</div>' +
		'<div class="box handler"><div class="bname">' + esc(r.method) + ' ' +
			esc(r.kind === 'http' ? r.path : controller.prefix ? '/' + controller.prefix : '/') +
			'</div><div class="bscope">' + esc(r.handler) + '()</div></div></div>';

	const lanes = [
		lane('middleware', r.bindings),
		lane('guard', r.bindings),
		handlerLane,
		lane('filter', r.bindings),
	].filter(Boolean);

	const flow = lanes.join(ARROW);

	const sub = r.kind === 'http'
		? 'HTTP route · <code>' + esc(r.method) + ' ' + esc(r.path) + '</code>'
		: 'WebSocket handler · topic <code>' + esc(r.path) + '</code> on <code>/' + esc(controller.prefix) + '</code>';

	const note = r.bindings.length
		? 'Pipeline runs left to right; filters only run if the handler throws. Globally-registered middleware, guards and filters also run but are not shown here (they live in the injector, not in decorator metadata).'
		: 'No middleware, guards or filters are bound to this entrypoint via decorators. Any globally-registered ones still run.';

	document.getElementById('detail').innerHTML =
		'<h2>' + verbBadge(r.method) + esc(r.handler) + '()</h2>' +
		'<div class="sub">' + sub + '</div>' +
		'<div class="flow">' + flow + '</div>' +
		'<p class="note">' + note + '</p>';
}

function controllerGroup(c) {
	const group = document.createElement('section');
	group.className = 'group';
	group.dataset.controller = c.controller.toLowerCase();
	const head = document.createElement('div');
	head.className = 'head';
	head.innerHTML = '<span class="name">' + esc(c.controller) + '</span>' +
		'<span class="prefix">' + (c.kind === 'ws' ? 'ws:' : '') + '/' + esc(c.prefix) + '</span>' +
		'<span class="mod">' + esc(c.module) + '</span>';
	group.appendChild(head);

	if (!c.routes.length) {
		const e = document.createElement('div');
		e.className = 'empty-routes';
		e.textContent = 'No entrypoints declared.';
		group.appendChild(e);
		return group;
	}

	for (const r of c.routes) {
		const row = routeRow(r);
		row.onclick = () => {
			if (selectedEl) selectedEl.classList.remove('selected');
			row.classList.add('selected');
			selectedEl = row;
			renderFlow(r, c);
		};
		group.appendChild(row);
	}
	return group;
}

function applyFilter() {
	const q = document.getElementById('search').value.trim().toLowerCase();
	const verb = document.getElementById('method').value;
	let visible = 0;
	document.querySelectorAll('.group').forEach((group) => {
		let shown = 0;
		group.querySelectorAll('.route').forEach((row) => {
			const ok = (!q || row.dataset.text.includes(q)) &&
				(!verb || row.dataset.method === verb);
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
		total + ' entrypoints · ' + controllers.length + ' controllers' +
		(map.prefix ? ' · prefix ' + map.prefix : '');

	const list = document.getElementById('list');
	for (const c of controllers) list.appendChild(controllerGroup(c));

	document.getElementById('search').oninput = applyFilter;
	document.getElementById('method').onchange = applyFilter;
}
main();
</script>
</body>
</html>`;
}
