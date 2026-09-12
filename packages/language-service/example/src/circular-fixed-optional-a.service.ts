import { Inject, Injectable } from "@nexus-ioc/core";
import { CircularFixedOptionalBService } from "./circular-fixed-optional-b.service";

/**
 * This service demonstrates how to fix circular dependencies using @Optional()
 *
 * Expected Behavior:
 * - NO error (circular dependency is broken by @Optional())
 * - The plugin recognizes that optional dependencies don't create circular dependencies
 *
 * How it works:
 * - CircularFixedOptionalAService depends on CircularFixedOptionalBService (required)
 * - CircularFixedOptionalBService depends on CircularFixedOptionalAService (optional)
 * - The optional dependency breaks the cycle, so no error is reported
 *
 * Trade-offs:
 * - The optional service might be undefined at runtime
 * - You need to handle the case where the dependency is not available
 * - This is a quick fix but might not be the best architectural solution
 */
@Injectable()
export class CircularFixedOptionalAService {
	constructor(
		@Inject(CircularFixedOptionalBService)
		private serviceB: CircularFixedOptionalBService,
	) {}

	methodA(): string {
		return `A -> ${this.serviceB.methodB()}`;
	}
}
