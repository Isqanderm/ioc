export class ServiceTemplate {
	constructor(
		private readonly params: { name: string },
		private readonly template?: string,
	) {}

	private parse() {}

	public generate() {
		return `
      import { Injectable } from "@nexus-ioc/core";
    
      @Injectable()
      export class ${this.params.name}Service {}
    `;
	}
}
