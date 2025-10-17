import { Editor, Plugin, PluginSettingTab, Setting, App } from 'obsidian';

export default class LinkCasingPlugin extends Plugin {
	private isApplying = false;
	settings: LinkCasingSettings;

	// Match wiki links ending with a casing command
	// [[Link Name\l]] -> groups: [1]=Link Name, [2]=l
	private static readonly LINK_CMD_RE = /\[\[([^\]|\\]+)\\([lutc])\]\]/g;

	// Match wiki links with aliases ending with a casing command
	// [[link name|alias\u]] -> groups: [1]=link name, [2]=alias, [3]=u
	private static readonly ALIAS_CMD_RE = /\[\[([^\]|]+)\|([^\]\\]+)\\([lutc])\]\]/g;

	// Match wiki links followed by a postfix casing command (immediately after ]])
	// [[Link Name]]\l -> groups: [1]=Link Name, [2]=l
	private static readonly POSTFIX_LINK_CMD_RE = /\[\[([^\]|\\]+)\]\]\\([lutc])/g;

	// Match wiki links with aliases followed by a postfix casing command
	// [[link name|alias]]\u -> groups: [1]=link name, [2]=alias, [3]=u
	private static readonly POSTFIX_ALIAS_CMD_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]\\([lutc])/g;

	async onload() {
		// Load settings and register settings tab
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.addSettingTab(new LinkCasingSettingTab(this.app, this));

		// React to editor changes (typing, paste, etc.) to transform links automatically
		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			if (!editor) return;
			this.applyTransformToEditor(editor);
		}));
	}

	// ---- Core transformation helpers ----

	private toLower(input: string): string {
		if (!this.settings?.lowercaseFirstWordOnly) return input.toLowerCase();
		// Lowercase only the first word (Unicode-aware), leaving the rest unchanged
		return input.replace(/^([\p{L}\p{M}']+)/u, (m: string) => m.toLowerCase());
	}

	private toUpper(input: string): string {
		return input.toUpperCase();
	}

	private toTitleCase(input: string): string {
		// Lowercase then capitalize first letter of each word (Unicode-aware)
		return input
			.toLowerCase()
			.replace(/\b(\p{L})([\p{L}\p{M}]*)/gu, (_m, first: string, rest: string) => first.toUpperCase() + rest);
	}

	private toCapitalCase(input: string): string {
		const lower = input.toLowerCase();
		if (lower.length === 0) return lower;
		return lower[0].toUpperCase() + lower.slice(1);
	}

	private transformContent(input: string): string {
		// First, handle postfix forms so they are consumed before in-link commands
		const postfixAliasReplacer = (_full: string, linkTarget: string, aliasText: string, cmd: string): string => {
			let transformedAlias: string = aliasText;
			switch (cmd) {
				case 'l':
					transformedAlias = this.toLower(aliasText);
					break;
				case 'u':
					transformedAlias = this.toUpper(aliasText);
					break;
				case 't':
					transformedAlias = this.toTitleCase(aliasText);
					break;
				case 'c':
					transformedAlias = this.toCapitalCase(aliasText);
					break;
				default:
					transformedAlias = aliasText;
			}
			return `[[${linkTarget}|${transformedAlias}]]`;
		};

		const postfixLinkReplacer = (_full: string, linkTarget: string, cmd: string): string => {
			let alias: string = linkTarget;
			switch (cmd) {
				case 'l':
					alias = this.toLower(linkTarget);
					break;
				case 'u':
					alias = this.toUpper(linkTarget);
					break;
				case 't':
					alias = this.toTitleCase(linkTarget);
					break;
				case 'c':
					alias = this.toCapitalCase(linkTarget);
					break;
				default:
					alias = linkTarget;
			}
			return alias === linkTarget ? `[[${linkTarget}]]` : `[[${linkTarget}|${alias}]]`;
		};

		// Then, handle links with aliases that have casing commands
		const aliasReplacer = (_full: string, linkTarget: string, aliasText: string, cmd: string): string => {
			let transformedAlias: string = aliasText;
			switch (cmd) {
				case 'l':
					transformedAlias = this.toLower(aliasText);
					break;
				case 'u':
					transformedAlias = this.toUpper(aliasText);
					break;
				case 't':
					transformedAlias = this.toTitleCase(aliasText);
					break;
				case 'c':
					transformedAlias = this.toCapitalCase(aliasText);
					break;
				default:
					transformedAlias = aliasText;
			}
			return `[[${linkTarget}|${transformedAlias}]]`;
		};

		// Then, handle regular links with casing commands
		const linkReplacer = (_full: string, linkTarget: string, cmd: string): string => {
			let alias: string = linkTarget;
			switch (cmd) {
				case 'l':
					alias = this.toLower(linkTarget);
					break;
				case 'u':
					alias = this.toUpper(linkTarget);
					break;
				case 't':
					alias = this.toTitleCase(linkTarget);
					break;
				case 'c':
					alias = this.toCapitalCase(linkTarget);
					break;
				default:
					alias = linkTarget;
			}
			// If the transformation does not change the text, strip the inline command
			// and do not add an alias — keep a plain wiki link.
			return alias === linkTarget ? `[[${linkTarget}]]` : `[[${linkTarget}|${alias}]]`;
		};

		// Apply transformations in order: postfix alias, postfix link, then in-link alias, in-link link
		let result = input.replace(LinkCasingPlugin.POSTFIX_ALIAS_CMD_RE, postfixAliasReplacer);
		result = result.replace(LinkCasingPlugin.POSTFIX_LINK_CMD_RE, postfixLinkReplacer);
		result = result.replace(LinkCasingPlugin.ALIAS_CMD_RE, aliasReplacer);
		return result.replace(LinkCasingPlugin.LINK_CMD_RE, linkReplacer);
	}

	private applyTransformToEditor(editor: Editor): void {
		if (this.isApplying) return;
		const original = editor.getValue();
		// Capture current cursor offset so we can restore it precisely
		const cursorPos = editor.getCursor();
		const cursorOffset = editor.posToOffset(cursorPos);

		// If the cursor is within a wiki-link casing command, we want to place it
		// at the end of the transformed link (just after the closing ]] ).
		let enclosingMatchStart: number | null = null;
		let transformedMatchText: string | null = null;
		let transformedPrefixLength: number | null = null;

		// Find enclosing match and compute transformed text lengths in a way that
		// accounts for earlier replacements that may change offsets.
		// Check postfix alias/link first, then in-link alias/link patterns
		const postfixAliasRe = new RegExp(LinkCasingPlugin.POSTFIX_ALIAS_CMD_RE);
		const postfixLinkRe = new RegExp(LinkCasingPlugin.POSTFIX_LINK_CMD_RE);
		const aliasRe = new RegExp(LinkCasingPlugin.ALIAS_CMD_RE);
		const linkRe = new RegExp(LinkCasingPlugin.LINK_CMD_RE);

		// Check postfix alias pattern first
		postfixAliasRe.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = postfixAliasRe.exec(original)) !== null) {
			const start = m.index;
			const end = start + m[0].length;
			if (cursorOffset >= start && cursorOffset <= end) {
				const linkTarget = m[1];
				const aliasText = m[2];
				const cmd = m[3];
				let transformedAlias = aliasText;
				switch (cmd) {
					case 'l':
						transformedAlias = this.toLower(aliasText);
						break;
					case 'u':
						transformedAlias = this.toUpper(aliasText);
						break;
					case 't':
						transformedAlias = this.toTitleCase(aliasText);
						break;
					case 'c':
						transformedAlias = this.toCapitalCase(aliasText);
						break;
					default:
						transformedAlias = aliasText;
				}
				const matchTransformed = `[[${linkTarget}|${transformedAlias}]]`;
				const prefixOriginal = original.slice(0, start);
				const prefixTransformed = this.transformContent(prefixOriginal);
				enclosingMatchStart = start;
				transformedMatchText = matchTransformed;
				transformedPrefixLength = prefixTransformed.length;
				break;
			}
		}

		// If no postfix alias match, check postfix link pattern
		if (enclosingMatchStart === null) {
			postfixLinkRe.lastIndex = 0;
			while ((m = postfixLinkRe.exec(original)) !== null) {
				const start = m.index;
				const end = start + m[0].length;
				if (cursorOffset >= start && cursorOffset <= end) {
					const linkTarget = m[1];
					const cmd = m[2];
					let alias = linkTarget;
					switch (cmd) {
						case 'l':
							alias = this.toLower(linkTarget);
							break;
						case 'u':
							alias = this.toUpper(linkTarget);
							break;
						case 't':
							alias = this.toTitleCase(linkTarget);
							break;
						case 'c':
							alias = this.toCapitalCase(linkTarget);
							break;
						default:
							alias = linkTarget;
					}
					const matchTransformed = (alias === linkTarget) ? `[[${linkTarget}]]` : `[[${linkTarget}|${alias}]]`;
					const prefixOriginal = original.slice(0, start);
					const prefixTransformed = this.transformContent(prefixOriginal);
					enclosingMatchStart = start;
					transformedMatchText = matchTransformed;
					transformedPrefixLength = prefixTransformed.length;
					break;
				}
			}
		}

		// If still not found, check in-link alias pattern
		if (enclosingMatchStart === null) {
			aliasRe.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = aliasRe.exec(original)) !== null) {
				const start = m.index;
				const end = start + m[0].length;
				if (cursorOffset >= start && cursorOffset <= end) {
					const linkTarget = m[1];
					const aliasText = m[2];
					const cmd = m[3];
					let transformedAlias = aliasText;
					switch (cmd) {
						case 'l':
							transformedAlias = this.toLower(aliasText);
							break;
						case 'u':
							transformedAlias = this.toUpper(aliasText);
							break;
						case 't':
							transformedAlias = this.toTitleCase(aliasText);
							break;
						case 'c':
							transformedAlias = this.toCapitalCase(aliasText);
							break;
						default:
							transformedAlias = aliasText;
					}
					const matchTransformed = `[[${linkTarget}|${transformedAlias}]]`;
					const prefixOriginal = original.slice(0, start);
					const prefixTransformed = this.transformContent(prefixOriginal);
					enclosingMatchStart = start;
					transformedMatchText = matchTransformed;
					transformedPrefixLength = prefixTransformed.length;
					break;
				}
			}
		}

		// If no alias match found, check link pattern
		if (enclosingMatchStart === null) {
			linkRe.lastIndex = 0;
			while ((m = linkRe.exec(original)) !== null) {
				const start = m.index;
				const end = start + m[0].length;
				if (cursorOffset >= start && cursorOffset <= end) {
					// Build transformed string for this specific link match
					const linkTarget = m[1];
					const cmd = m[2];
					let alias = linkTarget;
					switch (cmd) {
						case 'l':
							alias = this.toLower(linkTarget);
							break;
						case 'u':
							alias = this.toUpper(linkTarget);
							break;
						case 't':
							alias = this.toTitleCase(linkTarget);
							break;
						case 'c':
							alias = this.toCapitalCase(linkTarget);
							break;
						default:
							alias = linkTarget;
					}
					const matchTransformed = (alias === linkTarget)
						? `[[${linkTarget}]]`
						: `[[${linkTarget}|${alias}]]`;

					// Compute transformed length of everything before this match, to account
					// for earlier replacements that may change offsets.
					const prefixOriginal = original.slice(0, start);
					const prefixTransformed = this.transformContent(prefixOriginal);
					enclosingMatchStart = start;
					transformedMatchText = matchTransformed;
					transformedPrefixLength = prefixTransformed.length;
					break;
				}
			}
		}

		const transformed = this.transformContent(original);
		if (transformed !== original) {
			this.isApplying = true;
			try {
				editor.setValue(transformed);
				// Restore cursor: if we were inside a match, jump to end of the
				// transformed link (just after the ]]).
				if (
					enclosingMatchStart !== null &&
					transformedMatchText !== null &&
					transformedPrefixLength !== null
				) {
					const newOffset = transformedPrefixLength + transformedMatchText.length;
					editor.setCursor(editor.offsetToPos(newOffset));
				}
			} finally {
				this.isApplying = false;
			}
		}
	}
}

// ---- Settings ----

interface LinkCasingSettings {
	lowercaseFirstWordOnly: boolean;
}

const DEFAULT_SETTINGS: LinkCasingSettings = {
	lowercaseFirstWordOnly: false,
};

class LinkCasingSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: LinkCasingPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Lowercase only first word for \\l')
			.setDesc('If enabled, \\l makes only the first word lowercase; default lowers all words.(This is useful if your note names are sentence-cased and you want to preserve capitalization in later words, such as proper names.)')
			.addToggle(t =>
				t
					.setValue(this.plugin.settings.lowercaseFirstWordOnly)
					.onChange(async (v) => {
						this.plugin.settings.lowercaseFirstWordOnly = v;
						await this.plugin.saveData(this.plugin.settings);
					})
			);
	}
}
