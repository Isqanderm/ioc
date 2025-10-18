import { HtmlGenerator } from "../html-generator";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";

describe("HtmlGenerator", () => {
	let mockGraph: Map<string, ParseNsModule | ParseEntryFile>;
	let mockEntryModule: Partial<ParseEntryFile>;
	let mockAppModule: Partial<ParseNsModule>;
	let mockUserModule: Partial<ParseNsModule>;

	beforeEach(() => {
		// Create mock entry module
		mockEntryModule = {
			name: "AppModule",
			imports: ["AppModule"],
			filePath: "/project/src/entry.ts",
		};

		// Create mock app module
		mockAppModule = {
			name: "AppModule",
			filePath: "/project/src/app.module.ts",
			imports: ["UserModule"],
			exports: [],
			isGlobal: false,
			providers: [
				{
					token: "AppService",
					type: "Class",
					scope: "Singleton",
					dependencies: [],
					parse: () => ({} as any),
				},
			],
			deps: [],
		};

		// Create mock user module
		mockUserModule = {
			name: "UserModule",
			filePath: "/project/src/user/user.module.ts",
			imports: [],
			exports: ["UserService"],
			isGlobal: true,
			providers: [
				{
					token: "UserService",
					type: "Class",
					scope: "Singleton",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "DatabaseService",
							tokenType: "class",
							optional: false,
						},
					],
					parse: () => ({} as any),
				},
				{
					token: "CONFIG",
					type: "UseValue",
					value: "production",
					dependencies: [],
					parse: () => ({} as any),
				},
			],
			deps: [],
		};

		mockGraph = new Map();
		mockGraph.set("entry", mockEntryModule as ParseEntryFile);
		mockGraph.set("AppModule", mockAppModule as ParseNsModule);
		mockGraph.set("UserModule", mockUserModule as ParseNsModule);
	});

	describe("generate method", () => {
		it("should generate valid HTML document", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("<!DOCTYPE html>");
			expect(html).toContain("<html");
			expect(html).toContain("</html>");
			expect(html).toContain("<head>");
			expect(html).toContain("</head>");
			expect(html).toContain("<body>");
			expect(html).toContain("</body>");
		});

		it("should include Cytoscape.js library", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("cytoscape");
			expect(html).toContain("unpkg.com/cytoscape");
		});

		it("should include custom title when provided", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{
					title: "My Custom Graph",
				},
			);

			const html = generator.generate();

			expect(html).toContain("<title>My Custom Graph</title>");
			expect(html).toContain("<h1>My Custom Graph</h1>");
		});

		it("should use default title when not provided", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("<title>Dependency Graph</title>");
			expect(html).toContain("<h1>Dependency Graph</h1>");
		});

		it("should include metadata in HTML", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("/project/src/entry.ts");
			expect(html).toContain("Modules:");
			expect(html).toContain("Providers:");
		});

		it("should apply dark theme when specified", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{
					darkTheme: true,
				},
			);

			const html = generator.generate();

			// Dark theme colors
			expect(html).toContain("#1e1e1e"); // Dark background
			expect(html).toContain("#d4d4d4"); // Light text
		});

		it("should apply light theme by default", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			// Light theme colors
			expect(html).toContain("#ffffff"); // Light background
			expect(html).toContain("#333333"); // Dark text
		});
	});

	describe("IDE protocol support", () => {
		it("should use vscode protocol by default", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("vscode://file/");
		});

		it("should use webstorm protocol when specified", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{
					ideProtocol: "webstorm",
				},
			);

			const html = generator.generate();

			expect(html).toContain("idea://open?file=");
		});

		it("should use idea protocol when specified", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{
					ideProtocol: "idea",
				},
			);

			const html = generator.generate();

			expect(html).toContain("idea://open?file=");
		});

		it("should use custom IDE URL template when provided", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{
					customIdeUrl: "custom://open/{path}:{line}:{column}",
				},
			);

			const html = generator.generate();

			expect(html).toContain("custom://open/");
		});
	});

	describe("graph data conversion", () => {
		it("should include module nodes in graph data", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("module-AppModule");
			expect(html).toContain("module-UserModule");
		});

		it("should include provider nodes in graph data", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("AppService");
			expect(html).toContain("UserService");
			expect(html).toContain("CONFIG");
		});

		it("should include module import edges", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			// Check for edge data structure
			expect(html).toContain('"type": "import"');
		});

		it("should include provider dependency edges", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			// Check for dependency edge
			expect(html).toContain('"type": "dependency"');
		});

		it("should mark global modules", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain('"isGlobal": true');
		});

		it("should include provider types", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain('"providerType": "Class"');
			expect(html).toContain('"providerType": "UseValue"');
		});

		it("should include file paths", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("/project/src/app.module.ts");
			expect(html).toContain("/project/src/user/user.module.ts");
		});
	});

	describe("interactive features", () => {
		it("should include view mode controls", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("view-all");
			expect(html).toContain("view-modules");
			expect(html).toContain("view-providers");
		});

		it("should include search functionality", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain('id="search"');
			expect(html).toContain("Search modules or providers");
		});

		it("should include zoom controls", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain("reset-zoom");
			expect(html).toContain("fit-graph");
		});

		it("should include info panel", () => {
			const generator = new HtmlGenerator(
				mockGraph,
				"/project/src/entry.ts",
				{},
			);

			const html = generator.generate();

			expect(html).toContain('id="info-panel"');
			expect(html).toContain("Node Information");
		});
	});

	describe("Interactive Navigation", () => {
		it("should include navigateToNode function", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			expect(html).toContain("function navigateToNode(nodeId)");
			expect(html).toContain("cy.getElementById(nodeId)");
			expect(html).toContain("cy.animate");
		});

		it("should make module imports clickable", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			// Check that imports are rendered with node-link class
			expect(html).toContain("node-link");
			expect(html).toContain("data-node-id");
		});

		it("should make provider dependencies clickable", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			// Check that dependencies can be rendered as links
			expect(html).toContain("data.dependencies.map");
		});

		it("should attach click handlers to node links", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			// Check that click handlers are attached
			expect(html).toContain("querySelectorAll('.node-link')");
			expect(html).toContain("addEventListener('click'");
			expect(html).toContain("navigateToNode(nodeId)");
		});

		it("should include CSS styles for node links", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			expect(html).toContain(".node-link");
			expect(html).toContain("cursor: pointer");
		});

		it("should handle navigation animation", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			expect(html).toContain("cy.animate");
			expect(html).toContain("center: { eles: node }");
			expect(html).toContain("zoom: 1.5");
			expect(html).toContain("duration: 500");
			expect(html).toContain("easing: 'ease-in-out-cubic'");
		});

		it("should highlight target node on navigation", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			expect(html).toContain("node.addClass('highlighted')");
			expect(html).toContain("node.connectedEdges().addClass('highlighted')");
		});

		it("should check if node exists before navigating", () => {
			const generator = new HtmlGenerator(mockGraph, "/project/src/entry.ts");
			const html = generator.generate();

			expect(html).toContain("if (node.length > 0)");
		});
	});
});

