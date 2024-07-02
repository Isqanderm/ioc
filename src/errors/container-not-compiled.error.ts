export class ContainerNotCompiledError extends Error {
	constructor(message = "container not compiled") {
		super(message);
		this.name = ContainerNotCompiledError.name;
		Object.setPrototypeOf(this, ContainerNotCompiledError.prototype);
	}
}
