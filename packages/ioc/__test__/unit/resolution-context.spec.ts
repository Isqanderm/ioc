import { describe, expect, it } from "vitest";
import { ResolutionContext } from "../../src/core/resolver/resolution-context";

describe("ResolutionContext", () => {
	class A {}
	class B {}

	it("tracks entered tokens via isConstructing", () => {
		const ctx = new ResolutionContext();
		expect(ctx.isConstructing(A)).toBe(false);
		ctx.enter(A);
		ctx.enter(B);
		expect(ctx.path).toEqual([A, B]);
		expect(ctx.isConstructing(A)).toBe(true);
		ctx.leave(B);
		expect(ctx.isConstructing(B)).toBe(false);
		expect(ctx.isConstructing(A)).toBe(true);
		ctx.leave(A);
		expect(ctx.path).toEqual([]);
	});

	it("leave throws when the token is not on top of the path", () => {
		const ctx = new ResolutionContext();
		ctx.enter(A);
		ctx.enter(B);
		expect(() => ctx.leave(A)).toThrow();
		expect(ctx.path).toEqual([A, B]);
	});

	it("drainPendingInits awaits every init in order and clears the list", async () => {
		const ctx = new ResolutionContext();
		const done: string[] = [];
		ctx.pendingInits.push(
			new Promise<void>((r) =>
				setTimeout(() => {
					done.push("slow");
					r();
				}, 10),
			),
			Promise.resolve().then(() => {
				done.push("fast");
			}),
		);
		await ctx.drainPendingInits();
		expect(done).toContain("slow");
		expect(done).toContain("fast");
		expect(ctx.pendingInits).toHaveLength(0);
	});

	it("drainPendingInits rejects with the first failing init", async () => {
		const ctx = new ResolutionContext();
		ctx.pendingInits.push(Promise.reject(new Error("boom")));
		await expect(ctx.drainPendingInits()).rejects.toThrow("boom");
	});

	it("drainPendingInits also awaits inits added while draining", async () => {
		const ctx = new ResolutionContext();
		let late = false;
		ctx.pendingInits.push(
			Promise.resolve().then(() => {
				ctx.pendingInits.push(
					new Promise<void>((r) =>
						setTimeout(() => {
							late = true;
							r();
						}, 5),
					),
				);
			}),
		);
		await ctx.drainPendingInits();
		expect(late).toBe(true);
		expect(ctx.pendingInits).toHaveLength(0);
	});
});
