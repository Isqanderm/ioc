import { Test } from "nexus-ioc-testing";
import { Inject, Injectable, Scope, forwardRef } from "../../src";

describe("forwardRef", () => {
	it("should resolve cycle dependency", async () => {
		interface IServiceA {
			foo: string;
			serviceB: IServiceB;
		}
		interface IServiceB {
			foo: string;
			serviceA: IServiceA;
		}

		@Injectable({ scope: Scope.Request })
		class ServiceA implements IServiceA {
			constructor(
				@Inject("foo") public readonly foo: string,
				@Inject("ServiceB") public readonly serviceB: IServiceB,
			) {}
		}

		@Injectable({ scope: Scope.Request })
		class ServiceB implements IServiceB {
			constructor(
				@Inject("foo") public readonly foo: string,
				@Inject("ServiceA") public readonly serviceA: IServiceA,
			) {}
		}

		const container = await Test.createModule({
			providers: [
				{
					provide: "foo",
					useValue: "bar",
				},
				{
					provide: "ServiceA",
					useClass: ServiceA,
				},
				{
					provide: "ServiceB",
					useClass: ServiceB,
				},
			],
		}).compile();

		const instanceA = await container.get<ServiceA>("ServiceA");
		const instanceB = await container.get<ServiceB>("ServiceB");

		// console.log("instanceA: ", instanceA?.serviceB.foo);

		expect(instanceA?.serviceB.foo).toEqual("bar");
		expect(instanceB?.serviceA.foo).toEqual("bar");
	});

	it("should resolve cycle dependency with third Singletone dependency", async () => {
		interface IServiceA {
			foo: string;
			serviceB: IServiceB;
			serviceC: ServiceC;
		}
		interface IServiceB {
			foo: string;
			// serviceA: IServiceA;
			serviceC: ServiceC;
		}

		@Injectable()
		class ServiceC {}

		@Injectable({ scope: Scope.Request })
		class ServiceA implements IServiceA {
			constructor(
				@Inject("foo") public readonly foo: string,
				@Inject(ServiceC) public readonly serviceC: ServiceC,
				@Inject("ServiceB") public readonly serviceB: IServiceB,
			) {}
		}

		@Injectable({ scope: Scope.Request })
		class ServiceB implements IServiceB {
			constructor(
				@Inject("foo") public readonly foo: string,
				@Inject(ServiceC) public readonly serviceC: ServiceC,
				@Inject("ServiceA") public readonly serviceA: IServiceA,
			) {}
		}

		const container = await Test.createModule({
			providers: [
				ServiceC,
				{
					provide: "foo",
					useValue: "bar",
				},
				{
					provide: "ServiceA",
					useClass: ServiceA,
				},
				{
					provide: "ServiceB",
					useClass: ServiceB,
				},
			],
		}).compile();

		const instanceA = await container.get<ServiceA>("ServiceA");
		const instanceB = await container.get<ServiceB>("ServiceB");
		const instanceC = await container.get<ServiceC>(ServiceC);

		expect(instanceA?.serviceC).toBeInstanceOf(ServiceC);
		expect(instanceB?.serviceC).toBeInstanceOf(ServiceC);
		expect(instanceA?.serviceC === instanceB?.serviceC).toEqual(true);
		expect(instanceA?.serviceC === instanceC).toEqual(true);
		expect(instanceB?.serviceC === instanceC).toEqual(true);
	});
});
