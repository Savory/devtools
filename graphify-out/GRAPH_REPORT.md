# Graph Report - Danet-devtools  (2026-08-16)

## Corpus Check
- Corpus is ~247 words - fits in a single context window. You may not need a graph.

## Summary
- 33 nodes · 36 edges · 8 communities (5 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- npm Package Manifest
- Graphify Conventions
- Package Manager Requirement
- CI Test Job
- Publish Gate and Permissions
- Deno Setup for Publishing
- JSR Publish Steps
- npm Scripts

## God Nodes (most connected - your core abstractions)
1. `CI test Job` - 7 edges
2. `CI publish Job` - 7 edges
3. `packageManager` - 4 edges
4. `Graphify Knowledge Graph` - 4 edges
5. `denoland/setup-deno Action` - 3 edges
6. `Graphify Query Commands` - 3 edges
7. `scripts` - 2 edges
8. `devEngines` - 2 edges
9. `CI Workflow` - 2 edges
10. `actions/checkout Action` - 2 edges

## Surprising Connections (you probably didn't know these)
- `CI Workflow` --references--> `CI test Job`  [EXTRACTED]
  .github/workflows/ci.yml → .github/workflows/ci.yml  _Bridges community 4 → community 3_
- `CI test Job` --calls--> `deno publish --dry-run Validation`  [EXTRACTED]
  .github/workflows/ci.yml → .github/workflows/ci.yml  _Bridges community 3 → community 6_
- `CI test Job` --calls--> `denoland/setup-deno Action`  [EXTRACTED]
  .github/workflows/ci.yml → .github/workflows/ci.yml  _Bridges community 3 → community 5_
- `CI publish Job` --calls--> `deno publish Step`  [EXTRACTED]
  .github/workflows/ci.yml → .github/workflows/ci.yml  _Bridges community 4 → community 6_
- `CI publish Job` --calls--> `denoland/setup-deno Action`  [EXTRACTED]
  .github/workflows/ci.yml → .github/workflows/ci.yml  _Bridges community 4 → community 5_

## Import Cycles
- None detected.

## Communities (8 total, 3 thin omitted)

### Community 0 - "npm Package Manifest"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, main, name, type, version

### Community 1 - "Graphify Conventions"
Cohesion: 0.60
Nodes (5): GRAPH_REPORT.md, Graphify Knowledge Graph, Graphify Query Commands, graphify update Command, Graphify Wiki Index

### Community 2 - "Package Manager Requirement"
Cohesion: 0.40
Nodes (5): devEngines, packageManager, name, onFail, version

### Community 3 - "CI Test Job"
Cohesion: 0.50
Nodes (4): actions/checkout Action, deno lint Step, deno task test Step, CI test Job

### Community 4 - "Publish Gate and Permissions"
Cohesion: 0.50
Nodes (4): CI Workflow, Main Branch Publish Gate, OIDC id-token Publish Permissions, CI publish Job

## Knowledge Gaps
- **15 isolated node(s):** `name`, `version`, `description`, `main`, `test` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devEngines` connect `Package Manager Requirement` to `npm Package Manifest`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `CI test Job` connect `CI Test Job` to `Publish Gate and Permissions`, `Deno Setup for Publishing`, `JSR Publish Steps`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._