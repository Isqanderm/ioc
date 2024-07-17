import type { ModuleMetadata, Type } from "../interfaces";

export class TestingCreator<T extends ModuleMetadata> {
	create(
		metatype: T,
		moduleDecorator: (metadata: T) => ClassDecorator,
	): Type<unknown> {
		const module = class {};

		moduleDecorator(metatype)(module);

		return module;
	}
}
