# Routes Explorer Specification

## Purpose

Extract a JSON-serializable map of every entrypoint a Danet application exposes — HTTP routes and WebSocket message handlers, grouped by controller — including the exact registered path and the execution pipeline (middlewares, guards, filters) bound to each, from decorator metadata alone.

## Requirements

### Requirement: Route Map Construction

The system SHALL expose `buildRouteMap(entryModule, options?)` which walks the module tree from the entry module and returns a `RouteMap` of `{ prefix, controllers }`, built purely from decorator metadata without booting the application, and accepting either a `@Module`-decorated class or a dynamic module object as the entry point.

#### Scenario: Map built without app boot

- **WHEN** `buildRouteMap` is called with a module class that has never been initialized
- **THEN** it SHALL return the declared entrypoints without instantiating any controller

#### Scenario: Controller declared by several modules

- **WHEN** the same controller class is reachable through more than one module
- **THEN** it SHALL appear exactly once in the returned `controllers` list

### Requirement: Controller Grouping

The system SHALL group entrypoints by controller, reporting for each controller its class name, its `kind` (`http` or `ws`), its base `prefix` trimmed of surrounding slashes, the name of the module that declares it, and its routes in declaration order.

#### Scenario: Controller grouping metadata

- **WHEN** a module declares a controller with a base path such as `/users`
- **THEN** the entry for that controller SHALL report `prefix` as `users`, `module` as the declaring module's name, and the routes it exposes

### Requirement: HTTP Path Reconstruction

For HTTP controllers the system SHALL reconstruct the exact path Danet registers for each handler by joining the optional application-wide prefix, the controller base path and the handler path with single slashes, and SHALL apply the `prefix` option so the reconstructed paths match an app-wide base path set via `app.registerBasePath`.

#### Scenario: Controller base path joined with handler path

- **WHEN** a controller declares base path `users` and a handler declares path `:id`
- **THEN** the route's `path` SHALL be `/users/:id`

#### Scenario: Global prefix applied

- **WHEN** `buildRouteMap` is called with `{ prefix: '/api' }`
- **THEN** every HTTP route path SHALL be prefixed with `/api`

#### Scenario: Root route

- **WHEN** neither the controller nor the handler declares a path segment and no prefix is set
- **THEN** the route's `path` SHALL be `/`

### Requirement: HTTP Route Attributes

The system SHALL report for each HTTP entrypoint its verb, its handler method name and `kind: 'http'`, SHALL surface `ALL` as the verb for handlers registered for every verb, and SHALL include `sse: true` for Server-Sent-Events handlers and `statusCode` for handlers declaring a custom success status.

#### Scenario: Verb, SSE and status flags

- **WHEN** a controller exposes a `GET` handler, an `@All()` handler, an `@SSE()` handler and a handler with a custom `@HttpCode`
- **THEN** the map SHALL report verbs `GET` and `ALL` respectively, `sse: true` on the SSE entrypoint, and the declared `statusCode` on the last one

### Requirement: Non-Route Method Exclusion

The system SHALL treat a controller method as an entrypoint only when it carries routing metadata, so lifecycle hooks, helper methods and the constructor are excluded from the map.

#### Scenario: Helper method on a controller

- **WHEN** a controller defines a plain helper method with no routing decorator
- **THEN** that method SHALL NOT appear in the controller's `routes`

### Requirement: WebSocket Entrypoints

The system SHALL treat a WebSocket controller as `kind: 'ws'` whose `prefix` is its connection endpoint, and SHALL list each of its message handlers as an entrypoint with `method: 'WS'`, `kind: 'ws'` and a `path` equal to the message topic the handler listens to.

#### Scenario: WebSocket controller and topics

- **WHEN** a WebSocket controller declares handlers for two message topics
- **THEN** the map SHALL list two entrypoints with `method: 'WS'` and `kind: 'ws'`, whose paths are the two topics, alongside the application's HTTP controllers

### Requirement: Execution Pipeline Bindings

The system SHALL record, per entrypoint, the middlewares, guards and filters bound by decorators as a `bindings` list, each tagged with its `stage` (`middleware`, `guard` or `filter`) and its `scope` (`controller` or `method`), ordered controller-scope before method-scope. Globally-registered middlewares, guards and filters SHALL NOT be included, since they are not recorded in decorator metadata.

#### Scenario: Controller- and method-level bindings

- **WHEN** a guard is bound on the controller class and a middleware is bound on one handler
- **THEN** that handler's `bindings` SHALL contain both entries, the controller-scoped one first, each tagged with its stage and scope

#### Scenario: Route with no decorator bindings

- **WHEN** a handler and its controller declare no middleware, guard or filter
- **THEN** the entrypoint's `bindings` SHALL be an empty list

### Requirement: Serializable Route Model

The system SHALL produce a route map containing only JSON-friendly values — no class references and no object cycles — so it can be sent over HTTP, snapshotted, or diffed in CI.

#### Scenario: Route map survives serialization

- **WHEN** the returned route map is serialized with `JSON.stringify` and parsed back
- **THEN** the result SHALL be structurally identical to the original map
