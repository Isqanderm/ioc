export class ServiceTemplate {
	constructor(
		private readonly params: { name: string },
		readonly _template?: string,
	) {}

	public generate() {
		return `
      import { Injectable } from "@nexus-ioc/core";
    
      @Injectable()
      export class ${this.params.name}Service {}
    `;
	}
}
