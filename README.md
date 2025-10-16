# Obsidian Link Casing

Automatically applies casing aliases to wiki links using inline commands.

## What it does

Type casing commands directly in your wiki links, and the plugin replaces them with an alias automatically on editor changes:

- `[[Link Name\l]]` → `[[Link Name|link name]]`
- `[[Link Name\u]]` → `[[Link Name|LINK NAME]]`
- `[[Link Name\t]]` → `[[Link Name|Link Name]]`
- `[[link name\c]]` → `[[link name|Link name]]`

No commands, no settings, no UI — just automatic transformation while you edit.

## Install (local development)

- `npm install`
- `npm run dev` (watch) or `npm run build` (production)

## Manual install to a vault

Copy `main.js` and `manifest.json` to your vault at:

`<Vault>/.obsidian/plugins/obsidian-link-casing/`

Reload Obsidian and enable the plugin in Settings → Community plugins.

## Compatibility

- Requires Obsidian `0.15.0+`.
- Works on desktop and mobile.
