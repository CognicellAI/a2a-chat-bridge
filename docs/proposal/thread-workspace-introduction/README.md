# Proposal: Thread workspace introduction

- **Status**: implemented
- **Author**: dubh3124
- **Created**: 2026-08-09
- **Decision**: [ADR-0012](../../decisions/0012-thread-workspace-introduction.md)

## Problem

A public thread can have a selected Agent and shared Session, but participants
cannot reliably infer that identity or how to invoke it from the thread alone.

## Proposal

When a public thread creates a new shared Session, post one concise workspace
introduction containing the Agent name and alias, Session reference, and the
current bridge-bot mention required for requests. Existing agent replies remain
labeled with the remote Agent name.

## A2A integration points

The message exposes local bridge metadata only. It does not change Agent Card
discovery, authentication, A2A requests, Tasks, or remote `contextId` behavior.
