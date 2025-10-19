import { describe, expect, it } from "vitest";
import * as ts from "typescript/lib/tsserverlibrary";
import { CircularDependencyDetectorHelper } from "../../src/helpers/circular-dependency-detector.helper";
import type { InjectParameterDeclaration } from "../../src/parsers/inject.parser";

describe("CircularDependencyDetectorHelper", () => {
	// Helper function to create a mock InjectParameterDeclaration
	function createMockParam(
		name: string,
		isOptional: boolean,
		classDeclaration: ts.ClassDeclaration,
	): InjectParameterDeclaration {
		const identifier = ts.factory.createIdentifier(name);
		const param = ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			"dep",
			undefined,
			undefined,
			undefined,
		);

		// Set the parent to the class declaration
		(param as any).parent = classDeclaration;

		return {
			name: identifier,
			location: "constructor",
			declaration: param,
			start: 0,
			end: 10,
			length: 10,
			parameterName: "dep",
			isOptional,
		};
	}

	// Helper function to create a mock ClassDeclaration
	function createMockClass(name: string): ts.ClassDeclaration {
		return ts.factory.createClassDeclaration(
			undefined,
			ts.factory.createIdentifier(name),
			undefined,
			undefined,
			[],
		) as ts.ClassDeclaration;
	}

	it("should detect simple circular dependency (A -> B -> A)", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		paramsMap.set("ServiceB", [createMockParam("ServiceA", false, classB)]);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.circularDependencies).toHaveLength(1);

		const cycle = analysis.circularDependencies[0];
		expect(cycle.type).toBe("provider");
		expect(cycle.severity).toBe("error");
		expect(cycle.cycle).toEqual(["ServiceA", "ServiceB", "ServiceA"]);
		expect(cycle.message).toContain("Circular dependency detected");
	});

	it("should detect longer circular dependency (A -> B -> C -> A)", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");
		const classC = createMockClass("ServiceC");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		paramsMap.set("ServiceB", [createMockParam("ServiceC", false, classB)]);
		paramsMap.set("ServiceC", [createMockParam("ServiceA", false, classC)]);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB, classC],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.circularDependencies).toHaveLength(1);

		const cycle = analysis.circularDependencies[0];
		expect(cycle.cycle).toEqual(["ServiceA", "ServiceB", "ServiceC", "ServiceA"]);
	});

	it("should detect self-referencing dependency (A -> A)", () => {
		const classA = createMockClass("ServiceA");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceA", false, classA)]);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies([classA], paramsMap);

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.circularDependencies).toHaveLength(1);

		const cycle = analysis.circularDependencies[0];
		expect(cycle.cycle).toEqual(["ServiceA", "ServiceA"]);
	});

	it("should NOT detect circular dependency when optional dependency breaks the cycle", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		// ServiceB has optional dependency on ServiceA - should break the cycle
		paramsMap.set("ServiceB", [createMockParam("ServiceA", true, classB)]);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(false);
		expect(analysis.circularDependencies).toHaveLength(0);
	});

	it("should NOT detect circular dependency in linear dependency chain", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");
		const classC = createMockClass("ServiceC");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		paramsMap.set("ServiceB", [createMockParam("ServiceC", false, classB)]);
		paramsMap.set("ServiceC", []); // No dependencies

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB, classC],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(false);
		expect(analysis.circularDependencies).toHaveLength(0);
	});

	it("should handle multiple independent circular dependencies", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");
		const classC = createMockClass("ServiceC");
		const classD = createMockClass("ServiceD");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		// First cycle: A -> B -> A
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		paramsMap.set("ServiceB", [createMockParam("ServiceA", false, classB)]);
		// Second cycle: C -> D -> C
		paramsMap.set("ServiceC", [createMockParam("ServiceD", false, classC)]);
		paramsMap.set("ServiceD", [createMockParam("ServiceC", false, classD)]);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB, classC, classD],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.circularDependencies).toHaveLength(2);
	});

	it("should handle services with no dependencies", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", []);
		paramsMap.set("ServiceB", []);

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(false);
		expect(analysis.circularDependencies).toHaveLength(0);
	});

	it("should handle complex dependency graph with one cycle", () => {
		const classA = createMockClass("ServiceA");
		const classB = createMockClass("ServiceB");
		const classC = createMockClass("ServiceC");
		const classD = createMockClass("ServiceD");

		const paramsMap = new Map<string, InjectParameterDeclaration[]>();
		paramsMap.set("ServiceA", [createMockParam("ServiceB", false, classA)]);
		paramsMap.set("ServiceB", [
			createMockParam("ServiceC", false, classB),
			createMockParam("ServiceD", false, classB),
		]);
		paramsMap.set("ServiceC", [createMockParam("ServiceA", false, classC)]); // Creates cycle
		paramsMap.set("ServiceD", []); // No cycle

		const detector = new CircularDependencyDetectorHelper();
		const analysis = detector.detectCircularDependencies(
			[classA, classB, classC, classD],
			paramsMap,
		);

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.circularDependencies).toHaveLength(1);

		const cycle = analysis.circularDependencies[0];
		expect(cycle.cycle).toEqual(["ServiceA", "ServiceB", "ServiceC", "ServiceA"]);
	});
});

