import { Inject, Injectable } from "@nexus-ioc/core";
import { CircularDependencyBService } from "./circular-dependency-b.service";

/**
 * This service demonstrates a CIRCULAR DEPENDENCY error
 *
 * Expected Error:
 * - Red squiggly under @Inject(CircularDependencyBService)
 * - Message: "Circular dependency detected: CircularDependencyAService -> CircularDependencyBService -> CircularDependencyAService. Consider using forwardRef() to resolve this circular dependency."
 * - Related info: "Circular dependency path: CircularDependencyAService -> CircularDependencyBService -> CircularDependencyAService"
 *
 * Why:
 * - CircularDependencyAService depends on CircularDependencyBService
 * - CircularDependencyBService depends on CircularDependencyAService
 * - This creates a circular dependency that cannot be resolved
 *
 * How to fix:
 * Option 1: Use forwardRef() to break the cycle
 * ```typescript
 * constructor(
 *   @Inject(forwardRef(() => CircularDependencyBService))
 *   private serviceB: CircularDependencyBService
 * ) {}
 * ```
 *
 * Option 2: Refactor to remove the circular dependency
 * - Extract shared logic into a third service
 * - Use events/observers instead of direct dependencies
 * - Redesign the architecture to avoid the cycle
 *
 * Option 3: Make one dependency optional
 * ```typescript
 * constructor(
 *   @Inject(CircularDependencyBService)
 *   @Optional()
 *   private serviceB?: CircularDependencyBService
 * ) {}
 * ```
 */
@Injectable()
export class CircularDependencyAService {
	constructor(
		@Inject(CircularDependencyBService)
		private serviceB: CircularDependencyBService,
	) {}

	methodA(): string {
		return `A -> ${this.serviceB.methodB()}`;
	}
}
