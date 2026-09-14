import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Renders a Graphviz DOT string to a PNG file via the system `dot` binary.
 */
export class GraphGenerator {
	generate(dot: string, outputPath: string): void {
		mkdirSync(dirname(outputPath), { recursive: true });

		const dotProcess = spawnSync("dot", ["-Tpng", "-o", outputPath], {
			input: dot,
			encoding: "utf-8",
		});

		if (dotProcess.error) {
			throw new Error(
				`Failed to run Graphviz "dot" command: ${dotProcess.error.message}. Is Graphviz installed? See https://graphviz.org/download/`,
			);
		}

		if (dotProcess.status !== 0) {
			throw new Error(
				`Graphviz "dot" exited with code ${dotProcess.status}: ${dotProcess.stderr}`,
			);
		}
	}
}
