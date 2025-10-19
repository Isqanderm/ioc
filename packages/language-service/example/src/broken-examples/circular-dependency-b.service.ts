import { Injectable, Inject } from "@nexus-ioc/core";
import { CircularDependencyAService } from "./circular-dependency-a.service";

/**
 * This service is part of a circular dependency with CircularDependencyAService
 * 
 * Expected Error:
 * - Red squiggly under @Inject(CircularDependencyAService)
 * - Message: "Circular dependency detected: CircularDependencyBService -> CircularDependencyAService -> CircularDependencyBService. Consider using forwardRef() to resolve this circular dependency."
 * 
 * See circular-dependency-a.service.ts for more details on how to fix this.
 */
@Injectable()
export class CircularDependencyBService {
	constructor(
		@Inject(CircularDependencyAService)
		private serviceA: CircularDependencyAService,
	) {}

	methodB(): string {
		return `B -> ${this.serviceA.methodA()}`;
	}
}

