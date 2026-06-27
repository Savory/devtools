/**
 * @module
 * Renders the self-contained HTML page for the dependency graph visualizer.
 *
 * The page pulls Cytoscape.js from a CDN and fetches the graph JSON from the
 * devtools server. Everything else (styles, interactions) is inlined so the
 * page works without a build step.
 */

/**
 * Build the devtools HTML page.
 *
 * @param basePath The path the devtools server is mounted at (no trailing
 * slash), used to locate the `graph.json` endpoint.
 * @returns A complete HTML document as a string.
 */
export function renderUI(basePath: string): string {
	const graphUrl = `${basePath}/graph.json`;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Danet Devtools — Dependency Graph</title>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
<style>
	:root {
		--bg: #0f1117;
		--panel: #181b24;
		--border: #272b36;
		--text: #e6e8ee;
		--muted: #9aa0ad;
		--module: #9b59b6;
		--controller: #3aa0ff;
		--provider: #f39c12;
	}
	* { box-sizing: border-box; }
	html, body { margin: 0; height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }
	#app { display: flex; flex-direction: column; height: 100%; }
	header { display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--panel); }
	header h1 { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: .2px; }
	header .spacer { flex: 1; }
	header input, header select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
	header input { width: 220px; }
	header button { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
	header button:hover { border-color: #3a4150; }
	main { flex: 1; position: relative; display: flex; min-height: 0; }
	#cy { flex: 1; height: 100%; }
	#sidebar { width: 300px; border-left: 1px solid var(--border); background: var(--panel); padding: 18px; overflow-y: auto; }
	#sidebar h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 0 0 12px; }
	#sidebar .empty { color: var(--muted); font-size: 13px; line-height: 1.5; }
	.kv { font-size: 13px; margin-bottom: 10px; }
	.kv .k { color: var(--muted); display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 2px; }
	.kv .v { color: var(--text); word-break: break-word; }
	.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
	.legend { position: absolute; left: 14px; bottom: 14px; background: rgba(24,27,36,.92); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 12px; }
	.legend .row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
	.legend .dot { width: 12px; height: 12px; border-radius: 3px; }
	.stat { color: var(--muted); font-size: 12px; }
	#error { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: 40px; text-align: center; color: #ff8080; font-size: 14px; }
</style>
</head>
<body>
<div id="app">
	<header>
		<h1>🕸️ Danet Devtools</h1>
		<span class="stat" id="stat"></span>
		<span class="spacer"></span>
		<input id="search" type="search" placeholder="Filter nodes…" />
		<select id="layout">
			<option value="cose">Layout: Force (cose)</option>
			<option value="breadthfirst">Layout: Hierarchy</option>
			<option value="concentric">Layout: Concentric</option>
			<option value="grid">Layout: Grid</option>
		</select>
		<button id="fit">Fit</button>
	</header>
	<main>
		<div id="cy"></div>
		<div id="error"></div>
		<div class="legend">
			<div class="row"><span class="dot" style="background:var(--module)"></span> Module</div>
			<div class="row"><span class="dot" style="background:var(--controller)"></span> Controller</div>
			<div class="row"><span class="dot" style="background:var(--provider)"></span> Provider</div>
			<div class="row"><span class="dot" style="background:#5a6072;height:2px;width:18px;border-radius:2px"></span> imports / declares</div>
			<div class="row"><span class="dot" style="background:#3aa0ff;height:2px;width:18px;border-radius:2px"></span> injects</div>
		</div>
		<aside id="sidebar">
			<h2>Selection</h2>
			<div id="details" class="empty">Click a node to inspect its type, scope and the module that declares it.</div>
		</aside>
	</main>
</div>
<script>
const GRAPH_URL = ${JSON.stringify(graphUrl)};
const COLORS = { module: '#9b59b6', controller: '#3aa0ff', provider: '#f39c12' };

function toElements(graph) {
	const nodes = graph.nodes.map((n) => ({ data: { ...n } }));
	const edges = graph.edges.map((e) => ({ data: { ...e } }));
	return [...nodes, ...edges];
}

function runLayout(cy, name) {
	const opts = { name, animate: true, animationDuration: 400, padding: 30, fit: true };
	if (name === 'cose') Object.assign(opts, { nodeRepulsion: 9000, idealEdgeLength: 110, nodeOverlap: 16 });
	if (name === 'breadthfirst') Object.assign(opts, { directed: true, spacingFactor: 1.3 });
	if (name === 'concentric') Object.assign(opts, { minNodeSpacing: 40 });
	cy.layout(opts).run();
}

function renderDetails(node) {
	const d = node.data();
	const scope = d.scope ? '<span class="kv"><span class="k">Scope</span><span class="v"><span class="badge" style="background:#2a2f3c">' + d.scope + '</span></span></span>' : '';
	const flags = [];
	if (d.tokenBased) flags.push('token-based');
	if (d.valueBased) flags.push('value provider');
	const flagsHtml = flags.length ? '<span class="kv"><span class="k">Flags</span><span class="v">' + flags.join(', ') + '</span></span>' : '';
	const mod = d.moduleId ? '<span class="kv"><span class="k">Declared in</span><span class="v">' + d.moduleId.split(':').slice(1).join(':') + '</span></span>' : '';
	document.getElementById('details').className = '';
	document.getElementById('details').innerHTML =
		'<span class="kv"><span class="k">Name</span><span class="v">' + d.label + '</span></span>' +
		'<span class="kv"><span class="k">Kind</span><span class="v"><span class="badge" style="background:' + COLORS[d.kind] + ';color:#0b0d12">' + d.kind + '</span></span></span>' +
		scope + flagsHtml + mod;
}

async function main() {
	let graph;
	try {
		const res = await fetch(GRAPH_URL, { headers: { accept: 'application/json' } });
		if (!res.ok) throw new Error('HTTP ' + res.status);
		graph = await res.json();
	} catch (err) {
		const el = document.getElementById('error');
		el.style.display = 'flex';
		el.textContent = 'Failed to load graph from ' + GRAPH_URL + ' — ' + err.message;
		return;
	}

	document.getElementById('stat').textContent =
		graph.nodes.length + ' nodes · ' + graph.edges.length + ' edges';

	const cy = cytoscape({
		container: document.getElementById('cy'),
		elements: toElements(graph),
		minZoom: 0.2,
		maxZoom: 2.5,
		style: [
			{ selector: 'node', style: {
				'background-color': (n) => COLORS[n.data('kind')] || '#888',
				'label': 'data(label)', 'color': '#e6e8ee', 'font-size': 11,
				'text-valign': 'bottom', 'text-margin-y': 5, 'width': 26, 'height': 26,
				'border-width': 2, 'border-color': '#0f1117',
			} },
			{ selector: 'node[kind = "module"]', style: { 'shape': 'round-rectangle', 'width': 34, 'height': 34 } },
			{ selector: 'node[kind = "controller"]', style: { 'shape': 'diamond', 'width': 30, 'height': 30 } },
			{ selector: 'node[scope = "REQUEST"]', style: { 'border-color': '#e74c3c', 'border-width': 3 } },
			{ selector: 'node[scope = "TRANSIENT"]', style: { 'border-color': '#2ecc71', 'border-width': 3 } },
			{ selector: 'edge', style: {
				'width': 1.5, 'line-color': '#5a6072', 'target-arrow-color': '#5a6072',
				'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.9,
			} },
			{ selector: 'edge[kind = "import"]', style: { 'line-style': 'dashed' } },
			{ selector: 'edge[kind = "injects"]', style: { 'line-color': '#3aa0ff', 'target-arrow-color': '#3aa0ff', 'width': 2 } },
			{ selector: '.faded', style: { 'opacity': 0.12 } },
			{ selector: '.highlight', style: { 'opacity': 1 } },
			{ selector: 'node:selected', style: { 'border-color': '#fff', 'border-width': 3 } },
		],
	});

	runLayout(cy, 'cose');

	cy.on('tap', 'node', (evt) => {
		const node = evt.target;
		renderDetails(node);
		const neighborhood = node.closedNeighborhood();
		cy.elements().addClass('faded');
		neighborhood.removeClass('faded');
	});
	cy.on('tap', (evt) => {
		if (evt.target === cy) cy.elements().removeClass('faded');
	});

	document.getElementById('fit').onclick = () => cy.fit(undefined, 30);
	document.getElementById('layout').onchange = (e) => runLayout(cy, e.target.value);
	document.getElementById('search').oninput = (e) => {
		const q = e.target.value.trim().toLowerCase();
		if (!q) { cy.elements().removeClass('faded'); return; }
		cy.nodes().forEach((n) => {
			const match = n.data('label').toLowerCase().includes(q);
			n.toggleClass('faded', !match);
		});
		cy.edges().addClass('faded');
	};
}
main();
</script>
</body>
</html>`;
}
