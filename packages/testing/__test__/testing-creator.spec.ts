import "reflect-metadata";
import {
	MODULE_METADATA,
	MODULE_WATERMARK,
	type ModuleMetadata,
	NsModule,
} from "@nexus-ioc/core";
import { TestingCreator } from "../src/core/testing-creator";

describe("TestingCreator", () => {
	let creator: TestingCreator<ModuleMetadata>;

	beforeEach(() => {
		creator = new TestingCreator<ModuleMetadata>();
	});

	describe("create", () => {
		it("should create a module class from metadata", () => {
			const metadata: ModuleMetadata = {
				providers: [],
			};

			const moduleClass = creator.create(metadata, NsModule);

			expect(moduleClass).toBeDefined();
			expect(typeof moduleClass).toBe("function");
		});

		it("should apply the module decorator to the created class", () => {
			const metadata: ModuleMetadata = {
				providers: [],
				imports: [],
				exports: [],
			};

			const moduleClass = creator.create(metadata, NsModule);

			// Check that the decorator was applied by verifying watermark exists
			const hasWatermark = Reflect.getMetadata(MODULE_WATERMARK, moduleClass);
			expect(hasWatermark).toBe(true);
		});

		it("should create a module with providers", () => {
			class TestService {}

			const metadata: ModuleMetadata = {
				providers: [TestService],
			};

			const moduleClass = creator.create(metadata, NsModule);

			const providers = Reflect.getMetadata(
				MODULE_METADATA.PROVIDERS,
				moduleClass,
			);
			expect(providers).toBeDefined();
			expect(providers).toContain(TestService);
		});

		it("should create a module with imports", () => {
			class ImportedModule {}

			const metadata: ModuleMetadata = {
				imports: [ImportedModule],
				providers: [],
			};

			const moduleClass = creator.create(metadata, NsModule);

			const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass);
			expect(imports).toBeDefined();
			expect(imports).toContain(ImportedModule);
		});

		it("should create a module with exports", () => {
			class ExportedService {}

			const metadata: ModuleMetadata = {
				providers: [ExportedService],
				exports: [ExportedService],
			};

			const moduleClass = creator.create(metadata, NsModule);

			const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, moduleClass);
			expect(exports).toBeDefined();
			expect(exports).toContain(ExportedService);
		});

		it("should create a module with all metadata properties", () => {
			class ImportedModule {}
			class ProvidedService {}
			class ExportedService {}

			const metadata: ModuleMetadata = {
				imports: [ImportedModule],
				providers: [ProvidedService, ExportedService],
				exports: [ExportedService],
			};

			const moduleClass = creator.create(metadata, NsModule);

			const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass);
			const providers = Reflect.getMetadata(
				MODULE_METADATA.PROVIDERS,
				moduleClass,
			);
			const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, moduleClass);

			expect(imports).toContain(ImportedModule);
			expect(providers).toContain(ProvidedService);
			expect(providers).toContain(ExportedService);
			expect(exports).toContain(ExportedService);
		});

		it("should work with custom module decorators", () => {
			const customDecorator = (metadata: ModuleMetadata): ClassDecorator => {
				return (target: object) => {
					Reflect.defineMetadata("custom-module", metadata, target);
				};
			};

			const metadata: ModuleMetadata = {
				providers: [],
			};

			const moduleClass = creator.create(metadata, customDecorator);

			const customMetadata = Reflect.getMetadata("custom-module", moduleClass);
			expect(customMetadata).toBeDefined();
			expect(customMetadata).toEqual(metadata);
		});

		it("should create different module classes for different metadata", () => {
			const metadata1: ModuleMetadata = {
				providers: [],
			};

			const metadata2: ModuleMetadata = {
				providers: [],
				imports: [],
			};

			const moduleClass1 = creator.create(metadata1, NsModule);
			const moduleClass2 = creator.create(metadata2, NsModule);

			// They should be different class instances
			expect(moduleClass1).not.toBe(moduleClass2);
		});

		it("should handle empty metadata", () => {
			const metadata: ModuleMetadata = {};

			const moduleClass = creator.create(metadata, NsModule);

			expect(moduleClass).toBeDefined();
			const hasWatermark = Reflect.getMetadata(MODULE_WATERMARK, moduleClass);
			expect(hasWatermark).toBe(true);
		});
	});
});
