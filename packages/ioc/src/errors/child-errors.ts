/**
 * `createChild()` was called with a module that no module of the parent
 * graph lists in `@Module({ children })`.
 */
export class ChildModuleNotDeclaredError extends Error {
	constructor(public readonly moduleName: string) {
		super(
			`Module "${moduleName}" is not declared as a child of any module in this application. Add it to @Module({ children: [...] }) of the module whose providers it should see.`,
		);
		this.name = "ChildModuleNotDeclaredError";
		Object.setPrototypeOf(this, ChildModuleNotDeclaredError.prototype);
	}
}
