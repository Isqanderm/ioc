import type { ModuleMetadata, Type } from "../interfaces";
import { randomStringGenerator } from "../utils/random-string-generator.util";

export class TestingCreator<T extends ModuleMetadata> {
	create(
		metatype: T,
		moduleDecorator: (metadata: T) => ClassDecorator,
	): Type<unknown> {
		const module = this.createNamedClass("TestModule");

		moduleDecorator(metatype)(module);

		return module;
	}

	private createNamedClass(name: string) {
		const className = `${name}_${randomStringGenerator()}`;
		return {
			[className]: class {},
		}[className];
	}
}
