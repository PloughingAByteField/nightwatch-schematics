"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestNodeVersion = exports.addPropertyToPackageJson = exports.getAngularVersion = void 0;
const https_1 = require("https");
const jsonc_parser_1 = require("jsonc-parser");
const enums_1 = require("../enums");
const dependencies_1 = require("./dependencies");
const json_utils_1 = require("./json-utils");
const jsonFile_1 = require("./jsonFile");
function getAngularVersion(tree) {
    const packageNode = (0, dependencies_1.getPackageJsonDependency)(tree, '@angular/core');
    const version = packageNode &&
        packageNode.version
            .replace(/[~^]/, '')
            .split('.')
            .find((x) => !!parseInt(x, 10));
    return version ? +version : 0;
}
exports.getAngularVersion = getAngularVersion;
function addPropertyToPackageJson(tree, context, propertyName, propertyValue) {
    const packageJsonAst = new jsonFile_1.JSONFile(tree, enums_1.pkgJson.Path);
    const pkgNode = packageJsonAst.get([propertyName]);
    const recorder = tree.beginUpdate('package.json');
    if (!pkgNode) {
        // outer node missing, add key/value
        (0, json_utils_1.insertPropertyInAstObjectInOrder)(recorder, packageJsonAst.JsonAst, propertyName, propertyValue, enums_1.Config.JsonIndentLevel);
    }
    else if (pkgNode.type === 'object') {
        // property exists, update values
        for (let [key, value] of Object.entries(propertyValue)) {
            const innerNode = (0, jsonc_parser_1.findNodeAtLocation)(pkgNode, [key]);
            if (!innerNode) {
                // script not found, add it
                context.logger.debug(`creating ${key} with ${value}`);
                (0, json_utils_1.insertPropertyInAstObjectInOrder)(recorder, pkgNode, key, value, enums_1.Config.JsonIndentLevel);
            }
            else {
                // script found, overwrite value
                context.logger.debug(`overwriting ${key} with ${value}`);
                recorder.remove(innerNode.offset, innerNode.length);
                recorder.insertRight(innerNode.offset, JSON.stringify(value));
            }
        }
    }
    tree.commitUpdate(recorder);
}
exports.addPropertyToPackageJson = addPropertyToPackageJson;
/**
 * Attempt to retrieve the latest package version from NPM
 * Return an optional "latest" version in case of error
 * @param packageName
 */
function getLatestNodeVersion(packageName) {
    const DEFAULT_VERSION = 'latest';
    return new Promise((resolve) => {
        return (0, https_1.get)(`https://registry.npmjs.org/${packageName}`, (res) => {
            let rawData = '';
            res.on('data', (chunk) => (rawData += chunk));
            res.on('end', () => {
                try {
                    const response = JSON.parse(rawData);
                    const version = (response && response['dist-tags']) || {};
                    resolve(buildPackage(packageName, version.latest));
                }
                catch (e) {
                    resolve(buildPackage(packageName));
                }
            });
        }).on('error', () => resolve(buildPackage(packageName)));
    });
    function buildPackage(name, version = DEFAULT_VERSION) {
        return { name, version };
    }
}
exports.getLatestNodeVersion = getLatestNodeVersion;
//# sourceMappingURL=util.js.map