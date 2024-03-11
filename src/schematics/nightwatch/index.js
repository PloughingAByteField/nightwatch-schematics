"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNightwatchTsConfig = exports.removeE2EConfig = exports.removeE2ELinting = exports.addNightwatchTestsScriptToPackageJson = void 0;
const schematics_1 = require("@angular-devkit/schematics");
const tasks_1 = require("@angular-devkit/schematics/tasks");
const operators_1 = require("rxjs/operators");
const rxjs_1 = require("rxjs");
const enums_1 = require("./enums");
const util_1 = require("./utility/util");
const dependencies_1 = require("./utility/dependencies");
const framework_1 = require("./utility/framework");
const core_1 = require("@angular-devkit/core");
const jsonFile_1 = require("./utility/jsonFile");
const jsonc_parser_1 = require("jsonc-parser");
// You don't have to export the function as default. You can also have more than one rule factory
// per file.
function default_1(_options) {
    return (tree, _context) => {
        _options = Object.assign(Object.assign({}, _options), { __version__: (0, util_1.getAngularVersion)(tree) });
        if (_options.__version__ === 0) {
            throw new schematics_1.SchematicsException('Angular project not found');
        }
        return (0, schematics_1.chain)([
            updateDependencies(_options),
            _options.removeProtractor ? removeFiles() : schematics_1.noop,
            addNightwatchConfigFile(_options),
            addNightwatchTestsScriptToPackageJson(_options),
            !_options.noBuilder ? modifyAngularJson(_options) : (0, schematics_1.noop)(),
        ])(tree, _context);
    };
}
exports.default = default_1;
function addNightwatchTestsScriptToPackageJson(options) {
    return (tree, context) => {
        let scriptsToAdd = {};
        switch ((0, framework_1.default)(tree)) {
            case 'angular':
                scriptsToAdd['e2e'] = `ng e2e`;
                scriptsToAdd['e2e:test'] = `./node_modules/.bin/nightwatch --env '${options.environment}' --config './nightwatch.conf.js'`;
                break;
            case 'typescript':
                scriptsToAdd['e2e:test'] = `./node_modules/.bin/tsc -p ./nightwatch/tsconfig.e2e.json && ./node_modules/.bin/nightwatch --env '${options.environment}' --config './nightwatch.conf.js'`;
                break;
            default:
                scriptsToAdd['e2e:test'] = `./node_modules/.bin/nightwatch --env '${options.environment}' --config './nightwatch.conf.js'`;
                break;
        }
        (0, util_1.addPropertyToPackageJson)(tree, context, 'scripts', scriptsToAdd);
        return tree;
    };
}
exports.addNightwatchTestsScriptToPackageJson = addNightwatchTestsScriptToPackageJson;
function modifyAngularJson(options) {
    return (tree, context) => {
        if (tree.exists('./angular.json')) {
            const angularJsonVal = getAngularJsonValue(tree);
            const { projects } = angularJsonVal;
            if (!projects) {
                throw new schematics_1.SchematicsException('projects in angular.json is not defined');
            }
            Object.keys(projects).forEach((project) => {
                const NightwatchRunJson = {
                    builder: '@nightwatch/schematics:nightwatch',
                    options: {
                        devServerTarget: `${project}:serve`,
                        tsConfig: '../nightwatch/tsconfig.e2e.json',
                        config: './nightwatch.conf.js',
                        env: options.environment,
                    },
                    configurations: {
                        production: {
                            devServerTarget: `${project}:serve:production`,
                        },
                    },
                };
                context.logger.debug(`Adding Nightwatch command in angular.json`);
                const projectArchitectJson = angularJsonVal['projects'][project]['architect'];
                projectArchitectJson['nightwatch-run'] = NightwatchRunJson;
                if (options.removeProtractor) {
                    projectArchitectJson['e2e'] = NightwatchRunJson;
                }
                return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
            });
        }
    };
}
function updateDependencies(options) {
    let removeDependencies;
    return (tree, context) => {
        context.logger.debug('Updating dependencies...');
        context.addTask(new tasks_1.NodePackageInstallTask());
        if (options.removeProtractor) {
            removeDependencies = (0, rxjs_1.of)('protractor').pipe((0, operators_1.map)((packageName) => {
                context.logger.debug(`Removing ${packageName} dependency`);
                (0, dependencies_1.removePackageJsonDependency)(tree, {
                    type: enums_1.NodeDependencyType.Dev,
                    name: packageName,
                });
                return tree;
            }));
        }
        const dependencyList = [
            'nightwatch',
            '@types/node',
            'ts-node',
            '@types/nightwatch',
        ];
        let driver;
        switch (options.environment) {
            case 'chrome':
                driver = 'chromedriver';
                break;
            case 'firefox':
                driver = 'geckodriver';
                break;
            case 'selenium':
                driver = 'selenium-server';
                break;
            default:
                driver = 'geckodriver';
                break;
        }
        dependencyList.push(driver);
        if (options.componentTesting) {
            dependencyList.push('@nightwatch/angular');
        }
        const addDependencies = (0, rxjs_1.of)(...dependencyList).pipe((0, operators_1.concatMap)((packageName) => (0, util_1.getLatestNodeVersion)(packageName)), (0, operators_1.map)((packageFromRegistry) => {
            const { name, version } = packageFromRegistry;
            context.logger.debug(`Adding ${name}:${version} to ${enums_1.NodeDependencyType.Dev}`);
            (0, dependencies_1.addPackageJsonDependency)(tree, {
                type: enums_1.NodeDependencyType.Dev,
                name,
                version,
            });
            return tree;
        }));
        if (options.removeProtractor) {
            return (0, rxjs_1.concat)(removeDependencies, addDependencies);
        }
        return (0, rxjs_1.concat)(addDependencies);
    };
}
function addNightwatchConfigFile(options) {
    return (tree, context) => {
        context.logger.debug('adding Nightwatchjs config file to host dir');
        const angularJsonValue = getAngularJsonValue(tree);
        const { projects } = angularJsonValue;
        let cucumberRunner = '';
        let angularPlugin = '';
        return (0, schematics_1.chain)(Object.keys(projects).map((name) => {
            const project = projects[name];
            if (options.cucumberRunner) {
                cucumberRunner = `test_runner: {
            type: 'cucumber',
            options: {
              feature_path: 'tests/*.feature',
              auto_start_session: false
            }
          },`;
            }
            if (options.componentTesting) {
                angularPlugin = `'@nightwatch/angular'`;
            }
            return (0, schematics_1.mergeWith)((0, schematics_1.apply)((0, schematics_1.url)('./files'), [
                (0, schematics_1.move)((0, core_1.normalize)(project.root)),
                (0, schematics_1.applyTemplates)(Object.assign(Object.assign(Object.assign({}, core_1.strings), options), { root: project.root ? `${project.root}/` : project.root, cucumberRunner,
                    angularPlugin })),
            ]));
        }))(tree, context);
    };
}
function getAngularJsonValue(tree) {
    const angularJson = new jsonFile_1.JSONFile(tree, './angular.json');
    return (0, jsonc_parser_1.getNodeValue)(angularJson.JsonAst);
}
function removeFiles() {
    return (tree, context) => {
        if (tree.exists('./angular.json')) {
            const angularJsonValue = getAngularJsonValue(tree);
            const { projects } = angularJsonValue;
            if (!projects) {
                throw new schematics_1.SchematicsException('projects in angular.json is not defined');
            }
            // cleanup e2e config present in Angular.json file
            Object.keys(projects).forEach((project) => {
                context.logger.debug(`Removing e2e command in angular.json`);
                (0, exports.removeE2EConfig)(tree, angularJsonValue, project);
                (0, exports.removeE2ELinting)(tree, angularJsonValue, project);
                context.logger.debug(`Adding e2e/tsconfig.json to angular.json-tslint config`);
                (0, exports.addNightwatchTsConfig)(tree, angularJsonValue, project);
            });
            // clean up projects generated by cli with versions <= 7
            Object.keys(projects)
                .filter((name) => name.endsWith('-e2e'))
                .forEach((projectName) => {
                const projectRoot = projects[projectName].root;
                deleteDirectory(tree, projectRoot);
                context.logger.debug(`Removing ${projectName} from angular.json projects`);
                delete angularJsonValue.projects[projectName];
            });
            // clean up projects generated by cli with versions > 7
            Object.keys(projects)
                .filter((name) => !name.endsWith('-e2e'))
                .forEach((projectName) => {
                const projectRoot = projects[projectName].root;
                deleteDirectory(tree, `${projectRoot}/e2e`);
            });
            return tree.overwrite('./angular.json', JSON.stringify(angularJsonValue, null, 2));
        }
        return tree;
    };
}
function deleteDirectory(tree, path) {
    try {
        if (tree.getDir(path).subfiles.length > 0 || tree.getDir(path).subdirs.length > 0) {
            tree.rename('e2e', `protractor/${path}`);
        }
        else {
            console.warn(`⚠️  Skipping deletion: ${path} doesn't exist`);
        }
    }
    catch (error) { }
}
const removeE2ELinting = (tree, angularJsonVal, project) => {
    var _a, _b, _c, _d, _e;
    const projectLintOptionsJson = (_c = (_b = (_a = angularJsonVal.projects[project]) === null || _a === void 0 ? void 0 : _a.architect) === null || _b === void 0 ? void 0 : _b.lint) === null || _c === void 0 ? void 0 : _c.options;
    if (projectLintOptionsJson) {
        let filteredTsConfigPaths;
        if (Array.isArray(projectLintOptionsJson['tsConfig'])) {
            filteredTsConfigPaths = (_d = projectLintOptionsJson === null || projectLintOptionsJson === void 0 ? void 0 : projectLintOptionsJson.tsConfig) === null || _d === void 0 ? void 0 : _d.filter((path) => {
                const pathIncludesE2e = path.includes('e2e');
                return !pathIncludesE2e && path;
            });
        }
        else {
            filteredTsConfigPaths = !((_e = projectLintOptionsJson === null || projectLintOptionsJson === void 0 ? void 0 : projectLintOptionsJson.tsConfig) === null || _e === void 0 ? void 0 : _e.includes('e2e'))
                ? projectLintOptionsJson === null || projectLintOptionsJson === void 0 ? void 0 : projectLintOptionsJson.tsConfig
                : '';
        }
        projectLintOptionsJson['tsConfig'] = filteredTsConfigPaths;
    }
    return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
};
exports.removeE2ELinting = removeE2ELinting;
const removeE2EConfig = (tree, angularJsonVal, project) => {
    const projectArchitectJson = angularJsonVal['projects'][project]['architect'];
    delete projectArchitectJson['e2e'];
    return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
};
exports.removeE2EConfig = removeE2EConfig;
const addNightwatchTsConfig = (tree, angularJsonVal, projectName) => {
    var _a, _b, _c;
    const project = angularJsonVal.projects[projectName];
    let tsConfig = (_c = (_b = (_a = project === null || project === void 0 ? void 0 : project.architect) === null || _a === void 0 ? void 0 : _a.lint) === null || _b === void 0 ? void 0 : _b.options) === null || _c === void 0 ? void 0 : _c.tsConfig;
    if (tsConfig) {
        let prefix = '';
        if (project.root) {
            prefix = `${project.root}/`;
        }
        if (!Array.isArray(tsConfig)) {
            project.architect.lint.options.tsConfig = tsConfig = [tsConfig];
        }
        tsConfig.push(`${prefix}nightwatch/tsconfig.e2e.json`);
    }
    return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
};
exports.addNightwatchTsConfig = addNightwatchTsConfig;
//# sourceMappingURL=index.js.map