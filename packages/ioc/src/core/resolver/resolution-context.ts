import type { ProviderToken } from "../../interfaces";
import { ProvidersContainer } from "./providers-container";

export class ResolutionContext {
	/** Per-resolution-tree cache (Singleton + Scoped instances seen in this tree). */
	readonly cache = new ProvidersContainer();
	/** Tokens currently being constructed in this tree, outermost first. */
	readonly path: ProviderToken[] = [];
	/** onModuleInit promises started during synchronous creation. */
	readonly pendingInits: Promise<void>[] = [];

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

	/** Awaits and clears pendingInits in order, including ones added while draining. */
	async drainPendingInits(): Promise<void> {
		while (this.pendingInits.length) {
			await this.pendingInits.shift();
		}
	}
}
