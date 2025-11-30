"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitManager = void 0;
const cp = __importStar(require("child_process"));
const vscode = __importStar(require("vscode"));
const Logger_1 = require("../utils/Logger");
class GitManager {
    constructor() { }
    async isGitRepository(cwd) {
        try {
            await this.runCommand("git rev-parse --is-inside-work-tree", cwd);
            return true;
        }
        catch {
            return false;
        }
    }
    async hasUnstagedChanges(cwd) {
        try {
            const output = await this.runCommand("git status --porcelain", cwd);
            return output.trim().length > 0;
        }
        catch {
            return false;
        }
    }
    async commitChanges(cwd, message) {
        try {
            Logger_1.Logger.log(`[GitManager] Committing changes in ${cwd}`);
            // Check if there are changes to commit
            const status = await this.runCommand("git status --porcelain", cwd);
            if (!status.trim()) {
                Logger_1.Logger.log("[GitManager] No changes to commit.");
                return true;
            }
            // Add all changes
            await this.runCommand("git add .", cwd);
            // Commit
            await this.runCommand(`git commit -m "${message}"`, cwd);
            Logger_1.Logger.log("[GitManager] Commit successful.");
            vscode.window.showInformationMessage(`auto cleaner pro: Created backup commit: "${message}"`);
            return true;
        }
        catch (error) {
            Logger_1.Logger.error("[GitManager] Commit failed", error);
            vscode.window.showErrorMessage(`auto cleaner pro: Failed to create backup commit. Check Output channel.`);
            return false;
        }
    }
    async pushChanges(cwd) {
        try {
            Logger_1.Logger.log(`[GitManager] Pushing changes in ${cwd}`);
            await this.runCommand("git push", cwd);
            Logger_1.Logger.log("[GitManager] Push successful.");
            return true;
        }
        catch (error) {
            Logger_1.Logger.error("[GitManager] Push failed", error);
            vscode.window.showErrorMessage(`auto cleaner pro: Failed to push changes. Check Output channel.`);
            return false;
        }
    }
    async runCommand(command, cwd) {
        return new Promise((resolve, reject) => {
            cp.exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    reject({ ...error, stdout, stderr });
                }
                else {
                    resolve(stdout);
                }
            });
        });
    }
}
exports.GitManager = GitManager;
//# sourceMappingURL=GitManager.js.map