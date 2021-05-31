import {
  apply,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { map, concatMap } from 'rxjs/operators';
import { Observable, of, concat } from 'rxjs';
import { NodeDependencyType } from './enums';
import { NodePackage, SchematicsOptions } from './interfaces';
import {
  getAngularVersion,
  getLatestNodeVersion,
  parseJsonAtPath,
  removePackageJsonDependency,
} from './utility/util';
import { addPackageJsonDependency } from './utility/dependencies';

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export default function (_options: SchematicsOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    _options = { ..._options, __version__: getAngularVersion(tree) };

    return chain([
      updateDependencies(_options),
      _options.removeProtractor ? removeFiles() : noop,
      addNightwatchConfigFile(),
      !_options.noBuilder ? modifyAngularJson(_options) : noop(),
    ])(tree, _context);
  };
}

function modifyAngularJson(options: SchematicsOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    if (tree.exists('./angular.json')) {
      const angularJsonVal = getAngularJsonValue(tree);
      const { projects } = angularJsonVal;
      if (!projects) {
        throw new SchematicsException('projects in angular.json is not defined');
      }

      Object.keys(projects).forEach((project) => {
        const NightwatchRunJson = {
          builder: 'nightwatch-schematics:nightwatch',
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

        context.logger.debug(`Adding Nighjtwatch command in angular.json`);
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

function updateDependencies(options: SchematicsOptions): Rule {
  let removeDependencies: Observable<Tree>;
  return (tree: Tree, context: SchematicContext): Observable<Tree> => {
    context.logger.debug('Updating dependencies...');
    context.addTask(new NodePackageInstallTask());

    if (options.removeProtractor) {
      removeDependencies = of('protractor').pipe(
        map((packageName: string) => {
          context.logger.debug(`Removing ${packageName} dependency`);

          removePackageJsonDependency(tree, {
            type: NodeDependencyType.Dev,
            name: packageName,
          });

          return tree;
        })
      );
    }

    let driver: string;

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
        driver = 'firefox';
        break;
    }

    const addDependencies = of('nightwatch', driver).pipe(
      concatMap((packageName: string) => getLatestNodeVersion(packageName)),
      map((packageFromRegistry: NodePackage) => {
        const { name, version } = packageFromRegistry;
        context.logger.debug(`Adding ${name}:${version} to ${NodeDependencyType.Dev}`);

        addPackageJsonDependency(tree, {
          type: NodeDependencyType.Dev,
          name,
          version,
        });

        return tree;
      })
    );

    if (options.removeProtractor) {
      return concat(removeDependencies, addDependencies);
    }
    return concat(addDependencies);
  };
}

function addNightwatchConfigFile(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding Nightwatchjs config file to host dir');

    return chain([mergeWith(apply(url('./files'), [move('./')]))])(tree, context);
  };
}

function getAngularJsonValue(tree: Tree) {
  const angularJsonAst = parseJsonAtPath(tree, './angular.json');
  return angularJsonAst.value as any;
}

function removeFiles(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    if (tree.exists('./angular.json')) {
      const angularJsonValue = getAngularJsonValue(tree);
      const { projects } = angularJsonValue;

      if (!projects) {
        throw new SchematicsException('projects in angular.json is not defined');
      }

      // cleanup e2e config present in Angular.json file
      Object.keys(projects).forEach((project) => {
        context.logger.debug(`Removing e2e command in angular.json`);
        removeE2EConfig(tree, angularJsonValue, project);
        removeE2ELinting(tree, angularJsonValue, project);

        context.logger.debug(`Adding e2e/tsconfig.json to angular.json-tslint config`);

        addNightwatchTsConfig(tree, angularJsonValue, project);
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

function deleteDirectory(tree: Tree, path: string): void {
  try {
    tree.delete(path);
  } catch (error) {
    throw new SchematicsException(`Got Error while deleting ${path}: ${error}`);
  }
}

export const removeE2ELinting = (tree: Tree, angularJsonVal: any, project: string) => {
  const projectLintOptionsJson = angularJsonVal.projects[project]?.architect?.lint?.options;
  if (projectLintOptionsJson) {
    let filteredTsConfigPaths;

    if (Array.isArray(projectLintOptionsJson['tsConfig'])) {
      filteredTsConfigPaths = projectLintOptionsJson?.tsConfig?.filter((path: string) => {
        const pathIncludesE2e = path.includes('e2e');
        return !pathIncludesE2e && path;
      });
    } else {
      filteredTsConfigPaths = !projectLintOptionsJson?.tsConfig?.includes('e2e')
        ? projectLintOptionsJson?.tsConfig
        : '';
    }

    projectLintOptionsJson['tsConfig'] = filteredTsConfigPaths;
  }

  return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
};

export const removeE2EConfig = (tree: Tree, angularJsonVal: any, project: string): void => {
  const projectArchitectJson = angularJsonVal['projects'][project]['architect'];
  delete projectArchitectJson['e2e'];
  return tree.overwrite('./angular.json', JSON.stringify(angularJsonVal, null, 2));
};

export const addNightwatchTsConfig = (tree: Tree, angularJsonVal: any, projectName: string) => {
  const project = angularJsonVal.projects[projectName];
  let tsConfig = project?.architect?.lint?.options?.tsConfig;
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