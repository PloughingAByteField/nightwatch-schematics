import { JsonValue } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import {
  Node,
  ParseError,
  applyEdits,
  findNodeAtLocation,
  modify,
  parseTree,
  printParseErrorCode,
} from 'jsonc-parser';

export type InsertionIndex = (properties: string[]) => number;

export type JSONPath = (string | number)[];

/** @internal */
export class JSONFile {
  content: string;

  constructor(private readonly host: Tree, private readonly path: string) {
    const buffer = this.host.read(this.path);

    if (buffer) {
      this.content = buffer.toString();
    } else {
      throw new Error(`Could not read '${path}'.`);
    }
  }

  private _jsonAst: Node | undefined;
  public get JsonAst(): Node {
    if (this._jsonAst) {
      return this._jsonAst;
    }

    const errors: ParseError[] = [];

    this._jsonAst = parseTree(this.content, errors, { allowTrailingComma: true });
    if (errors.length) {
      const { error, offset } = errors[0];

      throw new Error(
        `Failed to parse "${this.path}" as JSON AST Object. ${printParseErrorCode(
          error
        )} at location: ${offset}.`
      );
    }

    if (this._jsonAst === undefined) {
      throw new Error(`Failed to parse "${this.path}" as JSON AST Object.`);
    }

    return this._jsonAst;
  }

  get(jsonPath: JSONPath): Node | undefined {
    if (!this.JsonAst) {
      return undefined;
    }

    return findNodeAtLocation(this.JsonAst, jsonPath);
  }

  modify(jsonPath: JSONPath, value: JsonValue | undefined): void {
    let updatedValue = value;

    if (jsonPath.includes('scripts')) {
      const currentValue = this.get(jsonPath) as object;
      const newValue = value as object;

      updatedValue = { ...currentValue, ...newValue };
    }

    const edits = modify(this.content, jsonPath, updatedValue, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
      },
    });

    this.content = applyEdits(this.content, edits);
    this.host.overwrite(this.path, this.content);
    this._jsonAst = undefined;
  }

  remove(jsonPath: JSONPath): void {
    if (this.get(jsonPath) !== undefined) {
      this.modify(jsonPath, undefined);
    }
  }
}
