import type { NexusClass, NexusSourceSpan } from "./nexus-semantic-model";

export type NexusApplication = {
	entryPoint: NexusSourceSpan;
	classes: readonly NexusClass[];
};
