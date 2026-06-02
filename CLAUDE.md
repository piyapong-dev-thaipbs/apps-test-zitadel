# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Nx monorepo (Nx 22.7.5) managed as npm workspaces under `apps/*`. Three projects:

- **`@apps/apps`** (`apps/apps`) — NestJS 11 backend. Bundled with webpack + SWC, served via `@nx/js:node`. All routes are mounted under the `api` global prefix (set in [main.ts](apps/apps/src/main.ts)); listens on `process.env.PORT || 3000`.
- **`@apps/web`** (`apps/web`) — Next.js 16 / React 19 frontend with Tailwind CSS 3, using the App Router (`apps/web/src/app`).
- **`@apps/apps-e2e`** (`apps/apps-e2e`) — Jest e2e suite that hits the running `@apps/apps` server over HTTP. Implicitly depends on `@apps/apps` and starts/builds it before running.

## Commands

Run everything through Nx. Project names are the package names (`@apps/apps`, `@apps/web`).

```sh
# Backend (NestJS)
npx nx serve @apps/apps          # dev server (build + node, watch)
npx nx build @apps/apps          # production webpack bundle
npx nx docker:build @apps/apps   # build Docker image (builds + prunes lockfile first)

# Frontend (Next.js)
npx nx dev @apps/web             # Next dev server
npx nx build @apps/web
npx nx start @apps/web           # serve production build

# Quality (any project, or all)
npx nx lint @apps/apps
npx nx typecheck @apps/apps
npx nx run-many -t lint typecheck build   # across all projects

# e2e tests (builds + serves @apps/apps automatically)
npx nx e2e @apps/apps-e2e

# Run a single e2e test by name
npx nx e2e @apps/apps-e2e -- -t "should return a message"

# Discover available targets for a project
npx nx show project @apps/apps
```

Most targets (`build`, `serve`, `lint`, `typecheck`, `dev`, `start`) are **inferred** by Nx plugins (`@nx/webpack`, `@nx/next`, `@nx/eslint`, `@nx/js/typescript`, `@nx/docker`) configured in [nx.json](nx.json) — they are not written out in per-project `project.json` files. The backend's custom targets (`build`, `serve`, `docker:build`, prune steps) are defined inline under the `nx.targets` key in [apps/apps/package.json](apps/apps/package.json).

## Conventions

- **Module boundaries** are enforced by ESLint (`@nx/enforce-module-boundaries` in [eslint.config.mjs](eslint.config.mjs)). Cross-project imports must respect Nx tags; don't import across projects via relative paths.
- TypeScript is `strict` with `noUnusedLocals`, `noImplicitReturns`, and `noImplicitOverride` on, using `nodenext` module resolution and a custom `@apps/source` condition ([tsconfig.base.json](tsconfig.base.json)).
- Prettier uses single quotes ([.prettierrc](.prettierrc)).
- Nx Cloud is intentionally disabled (`neverConnectToCloud: true`); don't run `nx connect`.

## e2e test setup

The e2e suite ([apps/apps-e2e](apps/apps-e2e)) assumes the backend is reachable at `localhost:3000` (overridable via `HOST`/`PORT`). `global-setup.ts` waits for the port to open before tests run; axios `baseURL` is configured in `src/support/test-setup.ts`. Because the suite depends on a running server, prefer `npx nx e2e @apps/apps-e2e` (which builds and serves `@apps/apps`) over invoking Jest directly.
