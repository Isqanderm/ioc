import { Injectable, Inject } from "@nexus-ioc/core";

/**
 * This service demonstrates a MISSING DEPENDENCY error
 * 
 * Expected Error:
 * - Red squiggly under @Inject(NonExistentService)
 * - Message: "Class 'MissingDependencyService' is missing dependency: NonExistentService"
 * - Related info: "Module: AppModule"
 * 
 * Why:
 * - NonExistentService is not defined anywhere
 * - It's not provided in any module
 * - The plugin detects this and reports an error
 * 
 * How to fix:
 * 1. Create NonExistentService class with @Injectable()
 * 2. Add it to a module's providers array
 * 3. Make sure the module is imported by AppModule
 */

// This class doesn't exist - intentionally causing an error
declare class NonExistentService {
	doSomething(): void;
}

@Injectable()
export class MissingDependencyService {
	constructor(
		// ERROR: NonExistentService is not provided in any module
		@Inject(NonExistentService) private service: NonExistentService,
	) {}

	test(): void {
		this.service.doSomething();
	}
}

