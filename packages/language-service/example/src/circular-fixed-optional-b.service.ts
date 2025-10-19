import { Inject, Injectable, Optional } from "@nexus-ioc/core";
import { CircularFixedOptionalAService } from "./circular-fixed-optional-a.service";

/**
 * This service is part of a circular dependency that is fixed using @Optional()
 *
 * Expected Behavior:
 * - NO error (the @Optional() decorator breaks the circular dependency)
 *
 * Note:
 * - The serviceA dependency is optional, so it might be undefined
 * - We need to check if it exists before using it
 */
@Injectable()
export class CircularFixedOptionalBService {
	constructor(
		@Inject(CircularFixedOptionalAService)
		@Optional()
		private serviceA?: CircularFixedOptionalAService,
	) {}

	methodB(): string {
		if (this.serviceA) {
			// This would create infinite recursion, but demonstrates the concept
			// In real code, you'd have different logic here
			return "B (with A)";
		}
		return "B (without A)";
	}
}
