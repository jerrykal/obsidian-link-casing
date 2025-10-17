# Obsidian Link Casing

Automatically applies casing aliases to wiki links using inline commands.

## What it does

Type casing commands directly in your wiki links, and the plugin replaces them with an alias automatically on editor changes:

- `[[Link Name\l]]` → `[[Link Name|link name]]`
- `[[Link Name\u]]` → `[[Link Name|LINK NAME]]`
- `[[Link Name\t]]` → `[[Link Name|Link Name]]`
- `[[link name\c]]` → `[[link name|Link name]]`

### Setting: Lowercase only first letter for `\l`

By default, `\l` lowercases all letters. You can enable a setting to lowercase only the first letter (useful if your note names are sentence-cased and you want to preserve capitalization in later words, such as proper names).

- When enabled: `[[Link Name\l]]` → `[[Link Name|link Name]]` (only first letter lowercased)
- When disabled (default): `[[Link Name\l]]` → `[[Link Name|link name]]` (all letters lowercased)

## Install (local development)

- `npm install`
- `npm run dev` (watch) or `npm run build` (production)

## Manual install to a vault

Copy `main.js` and `manifest.json` to your vault at:

`<Vault>/.obsidian/plugins/obsidian-link-casing/`

Reload Obsidian and enable the plugin in Settings → Community plugins. Open the plugin's settings to toggle "Lowercase only first letter for \\l" if desired.

## Compatibility

- Requires Obsidian `0.15.0+`.
- Works on desktop and mobile.
