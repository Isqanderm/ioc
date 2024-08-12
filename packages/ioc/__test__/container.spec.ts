import "reflect-metadata";

import { Inject, Injectable, NsModule } from "../src";
import { Container } from "../src/core/modules/container";
// @ts-ignore
import { hashUtilsMock } from "./hashUtils.mock";

describe("Container", () => {
	let container: Container;

	beforeEach(() => {
		container = new Container(hashUtilsMock);
	});

	@Injectable()
	class ServiceA {
		getHello() {
			return "Hello from ServiceA";
		}
	}

	@Injectable()
	class ServiceB {
		constructor(@Inject(ServiceA) private readonly serviceA: ServiceA) {}

		getHello() {
			return `ServiceB says: ${this.serviceA.getHello()}`;
		}
	}

	@Injectable()
	class ServiceC {
		constructor(
			@Inject(ServiceA) private readonly serviceA: ServiceA,
			@Inject(ServiceB) private readonly serviceB: ServiceB,
		) {}

		getHello() {
			return `ServiceC says: ${this.serviceA.getHello()} and ${this.serviceB.getHello()}`;
		}
	}

	it("should register and resolve a simple module", async () => {
		@NsModule({
			providers: [ServiceA, ServiceB, ServiceC],
		})
		class AppModule {}

		await container.addModule(AppModule);

		const appModule = await container.getModule(AppModule);

		expect(appModule?.metatype).toEqual(AppModule);
	});

	it("should replace registered module", async () => {
		@NsModule({
			providers: [ServiceA, ServiceB, ServiceC],
		})
		class AppModule {}

		@NsModule({
			providers: [ServiceA, ServiceB, ServiceC],
		})
		class SecondAppModule {}

		await container.addModule(AppModule);
		const appModule = await container.getModule(AppModule);

		expect(appModule?.metatype).toBe(AppModule);

		await container.replaceModule(AppModule, SecondAppModule);

		const replacedAppModule = await container.getModule(AppModule);

		expect(replacedAppModule?.metatype).toBe(SecondAppModule);
	});
});
