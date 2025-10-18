const importsRegex = /imports:\s*\[\s*([\s\S]*?)\s*\],/;
const providersRegex = /providers:\s*\[\s*([\s\S]*?)\s*\],/;
const exportsRegex = /exports:\s*\[\s*([\s\S]*?)\s*\],/;

export class ModuleTemplate {
	private readonly _imports: string[] = [];
	private readonly _providers: string[] = [];
	private readonly _exports: string[] = [];

	constructor(
		private readonly params: { name: string },
		readonly template?: string,
	) {
		if (template) {
			this.parse(template);
		}
	}

	private get imports() {
		return this._imports.filter(Boolean).join(",");
	}

	private get providers() {
		return this._providers.filter(Boolean).join(",");
	}

	private get exports() {
		return this._exports.filter(Boolean).join(",");
	}

	private parse(template: string) {
		const [_, imports] = template.match(importsRegex) || [];
		const [__, providers] = template.match(providersRegex) || [];
		const [___, exports] = template.match(exportsRegex) || [];

		this._imports.push(imports.endsWith(",") ? imports.slice(0, -1) : imports);
		this._providers.push(
			providers.endsWith(",") ? providers.slice(0, -1) : providers,
		);
		this._exports.push(exports.endsWith(",") ? exports.slice(0, -1) : exports);
	}

	public addImport(importDep: string | string[]) {
		this._imports.push(...(Array.isArray(importDep) ? importDep : [importDep]));
	}

	public addProvider(provider: string | string[]) {
		this._providers.push(...(Array.isArray(provider) ? provider : [provider]));
	}

	public addExport(exportDep: string | string[]) {
		this._exports.push(...(Array.isArray(exportDep) ? exportDep : [exportDep]));
	}

	public generate() {
		return `
      @NsModule({
        imports: [${this.imports}],
        providers: [${this.providers}],
        exports: [${this.exports}],
      })
      export class ${this.params.name}Module {}
    `.trim();
	}
}
