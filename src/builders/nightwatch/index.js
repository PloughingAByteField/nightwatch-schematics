"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const path = require("path");
const childProcess = require("child_process");
exports.default = (0, architect_1.createBuilder)(runNightwatch);
function runNightwatch(options, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const NightwatchCommandLineOptions = [
            'env',
            'config',
            'test',
            'testcase',
            'group',
            'skipgroup',
            'filter',
            'tag',
            'skiptags',
            'retries',
            'suiteRetries',
            'timeout',
            'reporter',
            'output',
            'headless',
            'verbose',
            'serial',
            'reuse-browser',
        ];
        const NightwatchLauncher = path.join(process.cwd(), 'node_modules', '.bin', 'nightwatch');
        const nightwatchRunCommand = `${NightwatchLauncher} ${createNightwatchCommand(options, NightwatchCommandLineOptions)}`;
        return runCommand(nightwatchRunCommand, context);
    });
}
function createNightwatchCommand(options, nightwatchCommandLIneOptions) {
    let command = '';
    nightwatchCommandLIneOptions.forEach((nightwatchOption, index) => {
        if (options[nightwatchOption] !== undefined) {
            if (typeof options[nightwatchOption] === 'boolean') {
                if (options[nightwatchOption] === true) {
                    command += `${index === 0 ? '' : ' '}--${nightwatchOption}`;
                }
            }
            else {
                command += `${index === 0 ? '' : ' '}--${nightwatchOption} "${options[nightwatchOption]}"`;
            }
        }
    });
    return command;
}
function runCommand(command, context) {
    return new Promise((resolve, reject) => {
        console.log(`⚙️  Running ${command}`);
        try {
            const child = childProcess.spawnSync(`${command}`, [], { shell: true, encoding: 'utf-8' });
            context.logger.info(child.stdout);
            if (child.status === 0) {
                return resolve({ success: true });
            }
            else {
                console.error(child.stderr);
                resolve({ success: false });
            }
        }
        catch (error) {
            context.logger.error(error);
            reject();
        }
    });
}
//# sourceMappingURL=index.js.map