import { JsonValue } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { Node } from 'jsonc-parser';
export type InsertionIndex = (properties: string[]) => number;
export type JSONPath = (string | number)[];
/** @internal */
export declare class JSONFile {
    private readonly host;
    private readonly path;
    content: string;
    constructor(host: Tree, path: string);
    private _jsonAst;
    get JsonAst(): Node;
    get(jsonPath: JSONPath): Node | undefined;
    modify(jsonPath: JSONPath, value: JsonValue | undefined): void;
    remove(jsonPath: JSONPath): void;
}
