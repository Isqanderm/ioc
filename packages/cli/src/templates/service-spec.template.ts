export class ServiceSpecTemplate {
	constructor(
		private readonly params: { name: string },
		private readonly template?: string,
	) {}

	private parse() {}

	public generate() {
		const serviceNameLC = this.params.name.toLowerCase();
		const serviceName = `${this.params.name}Service`;
		const variableServiceName = `${serviceNameLC}Service`;
		return `
      import { Test } from "@nexus-ioc/testing";
      import { ${serviceName} } from "./${serviceNameLC}.service";
      
      describe('${serviceName}', () => {
        it('should get service instance', async () => {
          const moduleRef = await Test.createModule({
            providers: [${serviceName}]
          }).compile();
          const ${variableServiceName} = await moduleRef.get<${serviceName}>(${serviceName});
      
          expect(${variableServiceName}).toBeInstanceOf(${serviceName});
        });
      });
    `;
	}
}
