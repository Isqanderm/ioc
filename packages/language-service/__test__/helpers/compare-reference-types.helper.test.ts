import * as ts from "typescript/lib/tsserverlibrary";
import { compareTypes } from "../../src/helpers/compare-types.helper";
import { tsquery } from "@phenomnomnominal/tsquery";

function findNodeInSF<T = ts.Node>(sourceFile: ts.SourceFile, query: string): T {
  const nodes = tsquery(sourceFile, query);

  if (!nodes || nodes.length === 0) {
    throw new Error(`Node with query "${query}" not found`);
  }

  return nodes[0] as T;
}

function createProgramFromText(sourceText: string): { program: ts.Program; sourceFile: ts.SourceFile; typeChecker: ts.TypeChecker } {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  // Create compiler host
  const compilerHost = ts.createCompilerHost({});
  const originalGetSourceFile = compilerHost.getSourceFile;
  compilerHost.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget) => {
    if (fileName === "test.ts") {
      return sourceFile;
    }
    return originalGetSourceFile(fileName, languageVersion);
  };

  // Create program
  const program = ts.createProgram({
    rootNames: ["test.ts"],
    options: {},
    host: compilerHost,
  });
  const typeChecker = program.getTypeChecker();

  return { program, sourceFile, typeChecker };
}

describe("Compare Reference Types", () => {
  describe("Array type comparisons", () => {
    it("should handle array types", () => {
      const sourceText = `
        const stringArray: string[] = ["test"];
        const numberArray: Array<number> = [1, 2, 3];
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const stringArrayDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="stringArray"])');
      const numberArrayDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="numberArray"])');

      expect(compareTypes(stringArrayDecl, stringArrayDecl, typeChecker)).toBe(true);
      expect(compareTypes(numberArrayDecl, numberArrayDecl, typeChecker)).toBe(true);
    });

    it("should handle readonly arrays", () => {
      const sourceText = `
        const readonlyArray: readonly string[] = ["test"];
        const normalArray: string[] = ["test"];
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const readonlyArrayDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="readonlyArray"])');
      const normalArrayDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="normalArray"])');

      expect(compareTypes(readonlyArrayDecl, normalArrayDecl, typeChecker)).toBe(true);
    });

    it("should not handle tuple types", () => {
      const sourceText = `
        const tupleType: [string, number] = ["test", 42];
        const arrayType: (string | number)[] = ["test", 42];
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const tupleDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="tupleType"])');
      const arrayDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="arrayType"])');

      expect(compareTypes(tupleDecl, arrayDecl, typeChecker)).toBe(false);
    });
  });

  describe("Object type comparisons", () => {
    it("should handle interface types", () => {
      const sourceText = `
        interface TestInterface {
          prop1: string;
          prop2: number;
        }
        const interfaceObj: TestInterface = { prop1: "test", prop2: 42 };
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestInterface"])');
      const variableDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="interfaceObj"])');

      expect(compareTypes(interfaceDecl, variableDecl, typeChecker)).toBe(true);
    });

    it("should handle class types", () => {
      const sourceText = `
        class TestClass {
          prop1: string = "test";
          prop2: number = 42;
        }
        const classInstance = new TestClass();
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const classDecl = findNodeInSF<ts.ClassDeclaration>(sourceFile, 'ClassDeclaration:has(Identifier[name="TestClass"])');
      const variableDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="classInstance"])');

      expect(compareTypes(classDecl, variableDecl, typeChecker)).toBe(true);
    });

    it("should handle type aliases", () => {
      const sourceText = `
        type TestType = {
          prop1: string;
          prop2: number;
        };
        const typeObj: TestType = { prop1: "test", prop2: 42 };
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const typeAlias = findNodeInSF<ts.TypeAliasDeclaration>(sourceFile, 'TypeAliasDeclaration:has(Identifier[name="TestType"])');
      const variableDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="typeObj"])');

      expect(compareTypes(typeAlias, variableDecl, typeChecker)).toBe(true);
    });

    it("should handle interface aliases", () => {
      const sourceText = `
        interface TestType1 {
          prop1: string;
          prop2: number;
        }
        
        interface TestType2 {
          prop1: string;
          prop2: number;
        }
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const typeAlias = findNodeInSF<ts.TypeAliasDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestType1"])');
      const typeAlias2 = findNodeInSF<ts.TypeAliasDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestType2"])');

      expect(compareTypes(typeAlias, typeAlias2, typeChecker)).toBe(true);
    });
  });

  describe("Generic type comparisons", () => {
    it("should handle generic classes", () => {
      const sourceText = `
        class GenericClass<T> {
          value: T;
          constructor(value: T) {
            this.value = value;
          }
        }
        const stringInstance = new GenericClass<string>("test");
        const numberInstance = new GenericClass<number>(42);
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const classDecl = findNodeInSF<ts.ClassDeclaration>(sourceFile, 'ClassDeclaration:has(Identifier[name="GenericClass"])');
      const stringInstance = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="stringInstance"])');
      const numberInstance = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="numberInstance"])');

      console.log('stringInstance: ', stringInstance.getText());
      console.log('numberInstance: ', numberInstance.getText());

      expect(compareTypes(classDecl, stringInstance, typeChecker)).toBe(true);
      expect(compareTypes(classDecl, numberInstance, typeChecker)).toBe(true);
    });

    it("should handle generic interfaces", () => {
      const sourceText = `
        interface GenericInterface<T> {
          value: T;
        }
        const stringValue: GenericInterface<string> = { value: "test" };
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="GenericInterface"])');
      const valueDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="stringValue"])');

      expect(compareTypes(interfaceDecl, valueDecl, typeChecker)).toBe(true);
    });
  });

  describe("Function type comparisons", () => {
    it("should handle function types", () => {
      const sourceText = `
        type FunctionType = (arg: string) => number;
        const arrowFunction: FunctionType = (str) => str.length;
        function normalFunction(str: string): number { return str.length; }
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const typeAlias = findNodeInSF<ts.TypeAliasDeclaration>(sourceFile, 'TypeAliasDeclaration:has(Identifier[name="FunctionType"])');
      const arrowFn = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="arrowFunction"])');
      const normalFn = findNodeInSF<ts.FunctionDeclaration>(sourceFile, 'FunctionDeclaration > Identifier[name="normalFunction"]');

      expect(compareTypes(typeAlias, arrowFn, typeChecker)).toBe(true);
      expect(compareTypes(typeAlias, normalFn, typeChecker)).toBe(true);
    });

    it("should handle callable interfaces", () => {
      const sourceText = `
        interface CallableInterface {
          (arg: string): number;
        }
        const callableFunction: CallableInterface = (str) => str.length;
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="CallableInterface"])');
      const functionDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="callableFunction"])');

      expect(compareTypes(interfaceDecl, functionDecl, typeChecker)).toBe(true);
    });
  });

  describe("Type compatibility edge cases", () => {
    it("should handle empty objects", () => {
      const sourceText = `
        interface TestInterface {
          prop1: string;
          prop2: number;
        }
        const emptyObj = {};
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestInterface"])');
      const emptyObjDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="emptyObj"])');

      expect(compareTypes(interfaceDecl, emptyObjDecl, typeChecker)).toBe(false);
    });

    it("should handle extra properties", () => {
      const sourceText = `
        interface TestInterface {
          prop1: string;
          prop2: number;
        }
        const extraProps = { prop1: "test", prop2: 42, extra: true };
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestInterface"])');
      const extraPropsDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="extraProps"])');

      expect(compareTypes(interfaceDecl, extraPropsDecl, typeChecker)).toBe(true);
    });

    it("should handle missing properties", () => {
      const sourceText = `
        interface TestInterface {
          prop1: string;
          prop2: number;
        }
        const missingProps = { prop1: "test" };
      `;

      const { sourceFile, typeChecker } = createProgramFromText(sourceText);

      const interfaceDecl = findNodeInSF<ts.InterfaceDeclaration>(sourceFile, 'InterfaceDeclaration:has(Identifier[name="TestInterface"])');
      const missingPropsDecl = findNodeInSF<ts.VariableStatement>(sourceFile, 'VariableStatement:has(Identifier[name="missingProps"])');

      expect(compareTypes(interfaceDecl, missingPropsDecl, typeChecker)).toBe(false);
    });
  });
});
