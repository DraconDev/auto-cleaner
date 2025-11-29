import * as cp from "child_process";
import * as vscode from "vscode";
import { Logger } from "../utils/Logger";

export class GitManager {
    constructor() {}

    public async isGitRepository(cwd: string): Promise<boolean> {
        try {
            await this.runCommand("git rev-parse --is-inside-work-tree", cwd);
            return true;
        } catch {
            return false;
        }
    }

    public async hasUnstagedChanges(cwd: string): Promise<boolean> {
        try {
            const output = await this.runCommand("git status --porcelain", cwd);
            return output.trim().length > 0;
        } catch {
            return false;
        }
    }

    public async commitChanges(cwd: string, message: string): Promise<boolean> {
        try {
            Logger.log(`[GitManager] Committing changes in ${cwd}`);

            // Check if there are changes to commit
            const status = await this.runCommand("git status --porcelain", cwd);
            if (!status.trim()) {
                Logger.log("[GitManager] No changes to commit.");
                return true;
            }

            // Add all changes
            await this.runCommand("git add .", cwd);

            // Commit
            await this.runCommand(`git commit -m "${message}"`, cwd);

            Logger.log("[GitManager] Commit successful.");
            vscode.window.showInformationMessage(
                `Auto Cleaner: Created backup commit: "${message}"`
            );
            return true;
        } catch (error) {
            Logger.error("[GitManager] Commit failed", error);
            vscode.window.showErrorMessage(
                `Auto Cleaner: Failed to create backup commit. Check Output channel.`
            );
            return false;
        }
    }

    private async runCommand(command: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(
                command,
                { cwd, maxBuffer: 1024 * 1024 * 10 },
                (error, stdout, stderr) => {
                    if (error) {
                        reject({ ...error, stdout, stderr });
                    } else {
                        resolve(stdout);
                    }
                }
            );
        });
    }
}
