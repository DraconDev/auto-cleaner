import * as cp from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";

export class TSAnalyzer implements IAnalyzer {
    name = "typescript";
    description = "TypeScript Analyzer (via tsc)";
    languages = ["typescript"];
    fileExtensions = [".ts", ".tsx"];

    constructor(private configManager: ConfigurationManager) {}

    isEnabled(): boolean {
        const enabledAnalyzers = this.configManager.getEnabledAnalyzers();
        return enabledAnalyzers.includes("typescript");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        const result: AnalysisResult = {
            analyzerName: this.name,
            language: "typescript",
            summary: {
                totalFiles: 0,
                totalIssues: 0,
                breakdown: {},
            },
            items: [],
        };

        if (!this.isEnabled()) {
            return result;
        }

        const items: CleanableItem[] = [];

        try {
            // Check if tsconfig.json exists
            const tsConfigPath = path.join(
                workspace.uri.fsPath,
                "tsconfig.json"
            );
            if (!(await fs.pathExists(tsConfigPath))) {
                return result;
            }

            // Run tsc with flags to detect unused locals/params
            const command =
                "tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false";

            const output = await this.runCommand(command, workspace.uri.fsPath);
            items.push(...this.parseTSOutput(output, workspace.uri.fsPath));
        } catch (error) {
            console.error("TSAnalyzer scan failed:", error);
            if (error instanceof Error && (error as any).stdout) {
                items.push(
                    ...this.parseTSOutput(
                        (error as any).stdout,
                        workspace.uri.fsPath
                    )
                );
            }
        }

        // Calculate summary
        result.items = items;
        result.summary.totalIssues = items.length;

        const breakdown: Record<string, number> = {};
        for (const item of items) {
            breakdown[item.type] = (breakdown[item.type] || 0) + 1;
        }
        result.summary.breakdown = breakdown;

        // Count files (approximate)
        const files = new Set(items.map((i) => i.file));
        result.summary.totalFiles = files.size;

        return result;
    }

    async clean(items: CleanableItem[]): Promise<CleanResult> {
        const result: CleanResult = {
            success: true,
            itemsCleaned: 0,
            errors: [],
        };

        const sortedItems = [...items].sort((a, b) => {
            if (a.file !== b.file) {
                return a.file.localeCompare(b.file);
            }
            return (b.line || 0) - (a.line || 0);
        });

        for (const item of sortedItems) {
            try {
                if (item.type === "unused-import") {
                    await this.removeUnusedImport(item);
                    result.itemsCleaned++;
                } else if (item.type === "unused-variable") {
                    await this.removeUnusedVariable(item);
                    result.itemsCleaned++;
                }
            } catch (error) {
                console.error(`Failed to clean item in ${item.file}:`, error);
                result.errors.push({ item, error: String(error) });
                result.success = false;
            }
        }

        return result;
    }

    private async runCommand(command: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(
                command,
                { cwd, maxBuffer: 1024 * 1024 * 10 },
                (error, stdout, stderr) => {
                    if (stdout) {
                        resolve(stdout);
                    } else {
                        resolve("");
                    }
                }
            );
        });
    }

    private parseTSOutput(
        output: string,
        workspacePath: string
    ): CleanableItem[] {
        const items: CleanableItem[] = [];
        const lines = output.split("\n");
        const regex = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const [_, relativePath, lineStr, colStr, code, message] = match;
                const file = path.join(workspacePath, relativePath);
                const lineNum = parseInt(lineStr, 10);
                const colNum = parseInt(colStr, 10);

                let type = "other";
                if (code === "6133" || code === "6196") {
                    if (message.includes("import")) {
                        type = "unused-import";
                    } else {
                        type = "unused-variable";
                    }
                } else if (code === "6192") {
                    type = "unused-import";
                }

                if (type !== "other") {
                    items.push({
                        type,
                        file,
                        line: lineNum,
                        column: colNum,
                        description: message,
                        severity: "warning",
                        confidence: "high",
                        category: "dead-code",
                        isGrayArea: false,
                    });
                }
            }
        }

        return items;
    }

    private async removeUnusedImport(item: CleanableItem): Promise<void> {
        if (!item.line) return;

        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(item.file)
        );
        const lineContent = document.lineAt(item.line - 1).text;

        if (lineContent.trim().startsWith("import")) {
            const edit = new vscode.WorkspaceEdit();
            edit.delete(
                vscode.Uri.file(item.file),
                document.lineAt(item.line - 1).rangeIncludingLineBreak
            );
            await vscode.workspace.applyEdit(edit);
        }
    }

    private async removeUnusedVariable(item: CleanableItem): Promise<void> {
        if (!item.line || !item.column) return;

        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(item.file)
        );
        const range = document.getWordRangeAtPosition(
            new vscode.Position(item.line - 1, item.column - 1)
        );

        if (range) {
            const edit = new vscode.WorkspaceEdit();
            const variableName = document.getText(range);
            if (!variableName.startsWith("_")) {
                edit.replace(
                    vscode.Uri.file(item.file),
                    range,
                    `_${variableName}`
                );
                await vscode.workspace.applyEdit(edit);
            }
        }
    }
}
