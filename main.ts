import { Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';

export default class LinkCasingPlugin extends Plugin {
	private isApplying: boolean = false;
	settings: LinkCasingSettings;

	// Match wiki links ending with a casing command and optional double backslash
	// [[Link Name\l\\]] -> groups: [1]=Link Name, [2]=l, [3]=\\ (optional)
	private static readonly LINK_CMD_RE = /\[\[([^\]|\\]+)\\([lutc])(\\\\)?\]\]/g;

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
		if (!this.settings?.lowercaseFirstLetterOnly) return input.toLowerCase();
		// Lowercase only the first Unicode letter, leaving the rest unchanged
		return input.replace(/(\p{L})/u, (m: string) => m.toLowerCase());
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
		const replacer = (_full: string, linkTarget: string, cmd: string): string => {
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

		return input.replace(LinkCasingPlugin.LINK_CMD_RE, replacer);
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
		const re = new RegExp(LinkCasingPlugin.LINK_CMD_RE);
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(original)) !== null) {
			const start = m.index;
			const end = start + m[0].length;
			if (cursorOffset >= start && cursorOffset <= end) {
				// Build transformed string for this specific match
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
	lowercaseFirstLetterOnly: boolean;
}

const DEFAULT_SETTINGS: LinkCasingSettings = {
	lowercaseFirstLetterOnly: false,
};

class LinkCasingSettingTab extends PluginSettingTab {
	constructor(app: any, private plugin: LinkCasingPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Lowercase only first letter for \\l')
			.setDesc('If enabled, \\l makes only the first letter lowercase; default lowers all.')
			.addToggle(t =>
				t
					.setValue(this.plugin.settings.lowercaseFirstLetterOnly)
					.onChange(async (v) => {
						this.plugin.settings.lowercaseFirstLetterOnly = v;
						await this.plugin.saveData(this.plugin.settings);
					})
			);
	}
}
