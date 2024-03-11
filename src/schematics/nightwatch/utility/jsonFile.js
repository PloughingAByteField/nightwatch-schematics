"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONFile = void 0;
const jsonc_parser_1 = require("jsonc-parser");
/** @internal */
class JSONFile {
    constructor(host, path) {
        this.host = host;
        this.path = path;
        const buffer = this.host.read(this.path);
        if (buffer) {
            this.content = buffer.toString();
        }
        else {
            throw new Error(`Could not read '${path}'.`);
        }
    }
    get JsonAst() {
        if (this._jsonAst) {
            return this._jsonAst;
        }
        const errors = [];
        this._jsonAst = (0, jsonc_parser_1.parseTree)(this.content, errors, { allowTrailingComma: true });
        if (errors.length) {
            const { error, offset } = errors[0];
            throw new Error(`Failed to parse "${this.path}" as JSON AST Object. ${(0, jsonc_parser_1.printParseErrorCode)(error)} at location: ${offset}.`);
        }
        if (this._jsonAst === undefined) {
            throw new Error(`Failed to parse "${this.path}" as JSON AST Object.`);
        }
        return this._jsonAst;
    }
    get(jsonPath) {
        if (!this.JsonAst) {
            return undefined;
        }
        return (0, jsonc_parser_1.findNodeAtLocation)(this.JsonAst, jsonPath);
    }
    modify(jsonPath, value) {
        let updatedValue = value;
        if (jsonPath.includes('scripts')) {
            const currentValue = this.get(jsonPath);
            const newValue = value;
            updatedValue = Object.assign(Object.assign({}, currentValue), newValue);
        }
        const edits = (0, jsonc_parser_1.modify)(this.content, jsonPath, updatedValue, {
            formattingOptions: {
                insertSpaces: true,
                tabSize: 2,
            },
        });
        this.content = (0, jsonc_parser_1.applyEdits)(this.content, edits);
        this.host.overwrite(this.path, this.content);
        this._jsonAst = undefined;
    }
    remove(jsonPath) {
        if (this.get(jsonPath) !== undefined) {
            this.modify(jsonPath, undefined);
        }
    }
}
exports.JSONFile = JSONFile;
//# sourceMappingURL=jsonFile.js.map