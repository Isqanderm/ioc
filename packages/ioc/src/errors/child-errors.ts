/**
 * `createChild()` was called with a module that no module of the parent
 * graph lists in `@Module({ children })`, or (`reason: "unloaded"`) the
 * lazy module declaring it was unloaded while the child was being created.
 */
export class ChildModuleNotDeclaredError extends Error {
	constructor(
		public readonly moduleName: string,
		public readonly reason: "not-declared" | "unloaded" = "not-declared",
	) {
		super(
			reason === "unloaded"
				? `The module declaring child "${moduleName}" was unloaded while the child was being created; the child was closed. Load the declaring module again and call createChild() anew.`
				: `Module "${moduleName}" is not declared as a child of any module in this application. Add it to @Module({ children: [...] }) of the module whose providers it should see.`,
		);
		this.name = "ChildModuleNotDeclaredError";
		Object.setPrototypeOf(this, ChildModuleNotDeclaredError.prototype);
	}
}
