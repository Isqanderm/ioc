import "reflect-metadata";
import { vi } from "vitest";
import {
	Inject,
	Injectable,
	NexusApplications,
	NsModule,
	type OnModuleInit,
	Scope,
} from "../src";

describe("Bootstrap Initialization via OnModuleInit", () => {
	it("should call onModuleInit during bootstrap and not during get", async () => {
		const initSpy = vi.fn();

		@Injectable()
		class AService implements OnModuleInit {
			onModuleInit() {
				initSpy();
			}
		}

		@Injectable()
		class BService implements OnModuleInit {
			constructor(@Inject(AService) public aService: AService) {}

			onModuleInit() {
				initSpy();
			}
		}

		@NsModule({ providers: [AService, BService] })
		class TestModule {}

		const app = await NexusApplications.create(TestModule).bootstrap();
		expect(initSpy).toHaveBeenCalledTimes(2);

		initSpy.mockClear();

		await app.get<AService>(AService);
		await app.get<BService>(BService);
		expect(initSpy).not.toHaveBeenCalled();
	});
});
