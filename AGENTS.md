# AGENTS.md

## Project Structure

This repo is a **desktop-first monorepo** built around a Tauri shell and shared editor packages:

- **`excalidraw-app/`** - The desktop renderer and Tauri app
- **`excalidraw-app/src-tauri/`** - Native Tauri project and packaging config
- **`packages/excalidraw/`** - Main React component library published as `@excalidraw/excalidraw`
- **`packages/`** - Shared packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`

## Development Workflow

1. **Package development**: Work in `packages/*` for shared editor behavior
2. **App development**: Work in `excalidraw-app/` for desktop shell behavior
3. **Formatting and linting**: Use `oxfmt` and `oxlint` through the root Bun scripts
4. **Verification**: Run typecheck, lint, and renderer build before shipping changes

## Development Commands

```bash
bun run test:typecheck  # TypeScript type checking
bun run test:code       # Oxlint
bun run test:other      # Oxfmt check
bun run test:update     # Run all tests (with snapshot updates)
bun run fix             # Auto-fix formatting and linting issues
bun run build           # Build the desktop renderer
bun run start:desktop   # Run the Tauri app in dev mode
```

## Architecture Notes

- Uses Bun workspaces for monorepo dependency management
- Internal packages use path aliases defined in `vitest.config.mts`
- Packages build with the repo scripts in `scripts/`; the renderer builds with Vite
- The repo no longer ships the hosted web app path; changes should assume a local desktop target
