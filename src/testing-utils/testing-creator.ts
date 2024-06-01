import { Module } from "../decorators/module";
import type { ModuleMetadata } from "../interfaces/module-metadata.interface";
import type { Type } from "../interfaces/type.interface";

export class TestingCreator {
	create(metatype: ModuleMetadata): Type<unknown> {
		const module = class {};

		Module(metatype)(module);

		return module;
	}
}
