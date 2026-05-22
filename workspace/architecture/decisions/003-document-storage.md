# ADR-003: Document Storage Model

## Status

Accepted

## Context

Signal needs a storage layer for documents (notes, knowledge items). The storage model
must support local-first operation, be inspectable by Loom, and produce interesting
dependency graphs for the framework experiment.

## Decision

Use a simple in-memory store backed by JSON persistence. Documents have:

- `id` — unique identifier
- `title` — human-readable label
- `content` — markdown body
- `tags` — categorization labels
- `createdAt` / `updatedAt` — timestamps
- `links` — references to other document IDs (explicit graph edges)

The store exposes a typed interface that other modules import, creating the dependency
edges Loom will extract.

## Consequences

- The storage module becomes a high-connectivity node in Loom's graph
- Multiple modules (`editor`, `graph`, `ai`, `sync`) will depend on it
- This hub structure gives Weave meaningful activation propagation paths
