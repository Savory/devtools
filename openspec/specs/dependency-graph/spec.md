# Dependency Graph Specification

## Purpose

Extract a JSON-serializable dependency graph of a Danet application — its modules, controllers and providers, wired by import, declaration and constructor-injection relationships — from decorator metadata alone, so it can be rendered, snapshotted or diffed without booting the app.

## Requirements

### Requirement: Metadata-Only Graph Construction

The system SHALL expose `buildDependencyGraph(entryModule)` which returns a `DependencyGraph` of `{ nodes, edges }` built purely by reading the decorator metadata written by `@danet/core`, without instantiating any provider and without requiring the application to be booted.

#### Scenario: Graph built before initialization

- **WHEN** `buildDependencyGraph` is called with a `@Module`-decorated class that has never been passed to `app.init`
- **THEN** it SHALL return the graph of the declared wiring without throwing and without constructing any provider instance

#### Scenario: Dynamic module as entry point

- **WHEN** the entry point is a dynamic module object carrying `module`, `imports`, `controllers` and `injectables`
- **THEN** the system SHALL use those inline declarations instead of the class metadata, and name the module node after the `module` constructor

### Requirement: Module Traversal

The system SHALL start at the entry module, recurse through each module's `imports`, and emit one `module` node per distinct module together with an `import` edge from the importing module to each imported module.

#### Scenario: Nested module imports

- **WHEN** the entry module imports a module that itself imports a third module
- **THEN** the graph SHALL contain a node for all three modules and `import` edges following the declared import chain

#### Scenario: Repeated or cyclic imports

- **WHEN** the same module is reachable through more than one import path, or the import graph contains a cycle
- **THEN** the traversal SHALL visit that module exactly once and SHALL terminate, emitting a single node for it

### Requirement: Declaration Edges

The system SHALL emit a `controller` node for every class listed in a module's `controllers` and a `provider` node for every entry in its `injectables`, each linked to its declaring module by a `declares` edge and carrying that module's id as `moduleId`.

#### Scenario: Module declaring a controller and a provider

- **WHEN** a module declares one controller and one injectable provider
- **THEN** the graph SHALL contain a `controller` node and a `provider` node, each with a `declares` edge from the module node and each carrying the module's id in `moduleId`

### Requirement: Provider Classification

The system SHALL classify provider nodes by how they are registered: class providers SHALL carry their DI `scope` (`GLOBAL`, `REQUEST` or `TRANSIENT`) when declared, token-based providers SHALL be labelled with their injection token and flagged `tokenBased`, and `useValue` providers SHALL additionally be flagged `valueBased`.

#### Scenario: Non-singleton provider

- **WHEN** a provider is declared with a request- or transient-scoped `@Injectable`
- **THEN** its node SHALL carry the corresponding `scope` value so non-singletons are distinguishable from globals

#### Scenario: Token and value providers

- **WHEN** a module declares a `{ token, useClass }` provider and a `{ token, useValue }` provider
- **THEN** both nodes SHALL be labelled with their token and flagged `tokenBased`, and only the `useValue` one SHALL be flagged `valueBased`

### Requirement: Constructor Injection Edges

The system SHALL read each controller's and each class-backed provider's constructor parameter types plus any `@Inject(token)` metadata, and emit an `injects` edge from the consumer node to the resolved provider node, mirroring how the framework's injector resolves dependencies.

#### Scenario: Class dependency

- **WHEN** a controller takes a provider declared in its own or an imported module as a constructor parameter
- **THEN** the graph SHALL contain an `injects` edge from the controller node to that provider node

#### Scenario: Token dependency

- **WHEN** a constructor parameter is annotated with `@Inject(token)` for a token-registered provider
- **THEN** the `injects` edge SHALL target the token-based provider node rather than the parameter's declared type

#### Scenario: Unresolvable dependency

- **WHEN** a constructor parameter resolves to neither a declared provider nor a known token
- **THEN** the system SHALL skip that parameter and produce no edge, rather than failing

### Requirement: Serializable Graph Model

The system SHALL produce nodes and edges that contain only JSON-friendly values — no class references and no object cycles — with a stable unique `id` per node and per edge, and SHALL emit at most one edge of a given kind between the same pair of nodes.

#### Scenario: Graph survives the HTTP boundary

- **WHEN** the returned graph is serialized with `JSON.stringify` and parsed back
- **THEN** the result SHALL be structurally identical to the original graph

#### Scenario: Name collision between elements

- **WHEN** two distinct elements of the same kind share a class name or token label
- **THEN** each SHALL still receive its own node with a distinct `id`
