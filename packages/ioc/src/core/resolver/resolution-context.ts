import type { ProviderToken } from "../../interfaces";
import { ProvidersContainer } from "./providers-container";

export class ResolutionContext {
	/** Per-resolution-tree cache (Singleton + Scoped instances seen in this tree). */
	readonly cache = new ProvidersContainer();
	/** Tokens currently being constructed in this tree, outermost first. */
	readonly path: ProviderToken[] = [];
	/** onModuleInit promises started during synchronous creation. */
	readonly pendingInits: Promise<unknown>[] = [];

	enter(token: ProviderToken): void {
		this.path.push(token);
	}

	leave(token: ProviderToken): void {
		const top = this.path[this.path.length - 1];
		if (top !== token) {
			throw new Error(
				`ResolutionContext.leave: expected top of path to be ${String(token)} but was ${String(top)}`,
			);
		}
		this.path.pop();
	}

	isConstructing(token: ProviderToken): boolean {
		return this.path.includes(token);
	}

	/**
	 * Queues an init promise. A no-op rejection handler is attached right
	 * away so a failure is never reported as an unhandled rejection before
	 * drainPendingInits() collects it; the original promise still rejects.
	 */
	addPendingInit(promise: Promise<unknown>): void {
		promise.catch(() => {});
		this.pendingInits.push(promise);
	}

	/**
	 * Waits for every pending init (allSettled semantics), including ones
	 * added while draining, clears the list, then rethrows the first failure
	 * in queue order.
	 */
	async drainPendingInits(): Promise<void> {
		let failed = false;
		let firstError: unknown;
		try {
			while (this.pendingInits.length) {
				const batch = this.pendingInits.splice(0);
				const results = await Promise.allSettled(batch);
				for (const result of results) {
					if (result.status === "rejected" && !failed) {
						failed = true;
						firstError = result.reason;
					}
				}
			}
		} finally {
			this.pendingInits.length = 0;
		}
		if (failed) {
			throw firstError;
		}
	}
}
