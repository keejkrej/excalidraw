# Excalidraw Desktop Fork

This repository is a desktop-only fork of Excalidraw built around a Tauri shell and the existing React renderer.

## Scope

- Local-first desktop editor
- Native open, save, and save-as for `.excalidraw` files
- Tauri packaging for desktop distribution
- Shared Excalidraw packages kept in-tree because the desktop app depends on them

Removed from this fork:

- Hosted web app support
- Firebase, share-link, and collaboration integrations
- Excalidraw+, AI, Sentry, PWA, and web deployment plumbing
- Integration examples and web-hosting docs

## Development

Install dependencies:

```bash
bun install
```

Run the desktop app in development:

```bash
bun run start:desktop
```

Build the renderer only:

```bash
bun run build
```

Build the desktop app:

```bash
bun run build:desktop
```

## Repository Layout

- `excalidraw-app/` desktop renderer and Tauri app
- `packages/` shared Excalidraw packages used by the renderer
- `scripts/` repo-level build utilities

## License

MIT. See [LICENSE](./LICENSE).
