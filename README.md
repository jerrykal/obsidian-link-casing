# Obsidian Link Casing

Automatically applies casing aliases to wiki links using inline commands.

## What it does

Type casing commands directly in your wiki links, and the plugin replaces them with an alias automatically on editor changes:

- `[[Link Name\l]]` → `[[Link Name|link name]]`
- `[[Link Name\u]]` → `[[Link Name|LINK NAME]]`
- `[[Link Name\t]]` → `[[Link Name|Link Name]]`
- `[[link name\c]]` → `[[link name|Link name]]`

You can also place the command immediately after the link:

- `[[Link Name]]\l` → `[[Link Name|link name]]`
- `[[Link Name|Alias]]\u` → `[[Link Name|ALIAS]]`

The command must be adjacent to the closing `]]` (no spaces).

You can also transform existing aliases by adding casing commands to the alias part:

- `[[link name|alias\u]]` → `[[link name|ALIAS]]`
- `[[link name|ALIAS\l]]` → `[[link name|alias]]`
- `[[link name|title case\t]]` → `[[link name|Title Case]]`
- `[[link name|title case\c]]` → `[[link name|Title case]]`

### Setting: Lowercase only first word for `\l`

By default, `\l` lowercases all words. You can enable a setting to lowercase only the first word (useful if your note names are sentence-cased and you want to preserve capitalization in later words, such as proper names).

- When enabled: `[[Link Name\l]]` → `[[Link Name|link Name]]` (only first word lowercased)
- When disabled (default): `[[Link Name\l]]` → `[[Link Name|link name]]` (all words lowercased)

This setting applies to both link targets and aliases when using the `\l` command.

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
