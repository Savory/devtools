# Devtools Server Specification

## Purpose

Mount the devtools onto a running Danet application, serving the dependency graph and routes explorer as self-contained browser UIs plus their raw JSON endpoints, entirely locally so no application data leaves the developer's machine.

## Requirements

### Requirement: Devtools Mounting

The system SHALL expose `setupDevtools(app, options?)` which registers four `GET` routes on the application — the dependency graph UI at the base path, the graph JSON at `{path}/graph.json`, the routes explorer UI at `{path}/routes` and the route map JSON at `{path}/routes.json` — and returns a handle reporting those four resolved paths.

#### Scenario: Default mount

- **WHEN** `setupDevtools(app)` is called and the application is then listening
- **THEN** `GET /_devtools`, `GET /_devtools/graph.json`, `GET /_devtools/routes` and `GET /_devtools/routes.json` SHALL each respond with status 200, and the returned handle SHALL report those four paths

### Requirement: Configurable Base Path

The system SHALL accept a `path` option defaulting to `/_devtools`, SHALL normalize it to have a leading slash and no trailing slash, and SHALL derive all four routes and every link inside the served pages from the normalized value.

#### Scenario: Custom base path

- **WHEN** `setupDevtools(app, { path: '/__graph' })` is called
- **THEN** the handle SHALL report a base path of `/__graph` and the devtools SHALL be served from that path instead of the default

### Requirement: Lazy Per-Request Introspection

The system SHALL build the dependency graph and the route map on each request from the application's current entry module, and SHALL therefore support being called either before or after `app.init`, provided it is called before the application starts listening.

#### Scenario: Setup called before initialization

- **WHEN** `setupDevtools` is called before `app.init` and a devtools JSON endpoint is requested after the application has initialized
- **THEN** the response SHALL reflect the initialized application's modules and routes

#### Scenario: Application-wide prefix reflected

- **WHEN** the application has registered an app-wide base path
- **THEN** the route map served at `{path}/routes.json` SHALL reconstruct paths using that prefix without the caller having to pass it

### Requirement: Uninitialized Application Handling

The system SHALL respond to the JSON endpoints with an empty but well-formed payload carrying an explanatory `error` field, rather than throwing, when the application has no entry module yet.

#### Scenario: Request before an entry module exists

- **WHEN** `{path}/graph.json` or `{path}/routes.json` is requested while the application has no entry module
- **THEN** the response SHALL be a successful JSON body with empty results and an `error` message stating the application is not initialized yet

### Requirement: Dependency Graph UI

The system SHALL serve an interactive dependency graph page that fetches the graph JSON, renders modules, controllers and providers as visually distinct nodes with their `import`, `declares` and `injects` edges, visually distinguishes non-singleton providers, and offers node filtering, selectable layouts, a fit control and a details panel showing a selected node's kind, scope and declaring module.

#### Scenario: Graph page loads its data

- **WHEN** a developer opens the devtools base path in a browser
- **THEN** the page SHALL request the graph JSON endpoint under the configured base path and render the returned nodes and edges

#### Scenario: Inspecting a node

- **WHEN** the developer selects a node in the graph
- **THEN** the details panel SHALL show that element's kind, DI scope where applicable, and the module that declares it, and its immediate neighborhood SHALL be highlighted

### Requirement: Routes Explorer UI

The system SHALL serve a routes explorer page listing every entrypoint grouped by controller with its declaring module and base path, showing verb-colored badges for HTTP verbs and WebSocket handlers, surfacing SSE and custom status-code tags inline, and supporting live filtering by text and by method.

#### Scenario: Filtering entrypoints

- **WHEN** the developer types into the filter field or selects a method
- **THEN** the list SHALL show only matching entrypoints, and SHALL show an explicit empty state when nothing matches

#### Scenario: Execution flow of a route

- **WHEN** the developer selects an entrypoint
- **THEN** the page SHALL render that route's execution flow as middlewares, then guards, then the handler, then filters, labelling each binding with whether it is bound at controller or method scope

### Requirement: Self-Contained Local Pages

The system SHALL serve both pages as self-contained HTML with inlined styles and behavior requiring no build step, SHALL cross-link them through a shared navigation, and SHALL keep all introspection local to the running application with no data sent to any external service.

#### Scenario: Switching views

- **WHEN** the developer is on either devtools page
- **THEN** a shared navigation SHALL let them switch between the dependency graph and the routes explorer, with the current view marked as active

### Requirement: Public Package Entry Points

The system SHALL publish the devtools as a Deno-native JSR package exposing the root entry point with the full public API, plus dedicated `./graph` and `./routes` entry points so the graph builder and route-map builder can be used standalone without the server.

#### Scenario: Using a builder without the server

- **WHEN** a consumer imports only the graph or routes entry point
- **THEN** the corresponding builder SHALL be usable on its own, without mounting the devtools onto an application
