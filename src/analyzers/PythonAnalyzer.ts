import * as cp from "child_process";
import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";

export class PythonAnalyzer implements IAnalyzer {
    name = "python";
    description = "Python Analyzer (via pyflakes)";
    languages = ["python"];
    fileExtensions = [".py"];

    constructor(private configManager: ConfigurationManager) {}

    isEnabled(): boolean {
        const enabledAnalyzers = this.configManager.getEnabledAnalyzers();
        return enabledAnalyzers.includes("python");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        const result: AnalysisResult = {
            analyzerName: this.name,
            language: "python",
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
            // Try pyflakes first (simpler, faster)
            const command = `pyflakes ${workspace.uri.fsPath}`;
            const output = await this.runCommand(command, workspace.uri.fsPath);
            items.push(
                ...this.parsePyflakesOutput(output, workspace.uri.fsPath)
            );
        } catch (error) {
            console.error("PythonAnalyzer scan failed:", error);
            if (error instanceof Error && (error as any).stdout) {
                items.push(
                    ...this.parsePyflakesOutput(
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

        // Count files
        const files = new Set(items.map((i) => i.file));
        result.summary.totalFiles = files.size;

        return result;
    }

    async clean(items: CleanableItem[]): Promise<CleanResult> {
        const errors: Array<{ item: CleanableItem; error: string }> = [];
        let itemsCleaned = 0;

        // Group items by file
        const itemsByFile = new Map<string, CleanableItem[]>();
        for (const item of items) {
            if (!itemsByFile.has(item.file)) {
                itemsByFile.set(item.file, []);
            }
            itemsByFile.get(item.file)!.push(item);
        }

        for (const [filePath, fileItems] of itemsByFile) {
            try {
                const document = await vscode.workspace.openTextDocument(
                    vscode.Uri.file(filePath)
                );
                const edit = new vscode.WorkspaceEdit();

                // Sort items by line number (descending) to edit from bottom to top
                const sortedItems = fileItems.sort(
                    (a, b) => (b.line || 0) - (a.line || 0)
                );

                for (const item of sortedItems) {
                    if (item.line) {
                        if (item.type === "unused-import") {
                            // Remove the entire import line
                            const range = document.lineAt(
                                item.line - 1
                            ).rangeIncludingLineBreak;
                            edit.delete(vscode.Uri.file(filePath), range);
                        } else if (item.type === "unused-variable") {
                            // Prefix variable with underscore
                            const lineContent = document.lineAt(
                                item.line - 1
                            ).text;
                            // Match Python variable assignments: var = value or var: type = value
                            const newContent = lineContent.replace(
                                /\b([a-zA-Z_]\w*)\s*(:\s*\w+)?\s*=/,
                                "_$1$2 ="
                            );
                            if (newContent !== lineContent) {
                                const range = document.lineAt(
                                    item.line - 1
                                ).range;
                                edit.replace(
                                    vscode.Uri.file(filePath),
                                    range,
                                    newContent
                                );
                            }
                        }
                    }
                }

                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    itemsCleaned += sortedItems.length;
                } else {
                    errors.push({
                        item: fileItems[0],
                        error: "Failed to apply workspace edit",
                    });
                }
            } catch (error: any) {
                errors.push({
                    item: fileItems[0],
                    error: error.message || "Unknown error",
                });
            }
        }

        return {
            success: errors.length === 0,
            itemsCleaned,
            errors,
        };
    }

    private async runCommand(command: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(
                command,
                { cwd, maxBuffer: 1024 * 1024 * 10 },
                (error, stdout, stderr) => {
                    if (stdout) {
                        resolve(stdout);
                    } else if (error) {
                        reject({ ...error, stdout, stderr });
                    } else {
                        resolve("");
                    }
                }
            );
        });
    }

    private parsePyflakesOutput(
        output: string,
        workspacePath: string
    ): CleanableItem[] {
        const items: CleanableItem[] = [];
        const lines = output.split("\n");

        // Pyflakes format: filepath:line:column: message
        // Example: ./test.py:1:1: 'os' imported but unused
        // Example: ./test.py:5:5: local variable 'x' is assigned to but never used
        const regex = /^(.+?):(\d+):(\d+):\s*(.+)$/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const [_, filePath, lineStr, colStr, message] = match;
                const lineNum = parseInt(lineStr, 10);
                const colNum = parseInt(colStr, 10);

                let type = "other";
                if (message.includes("imported but unused")) {
                    type = "unused-import";
                } else if (
                    message.includes("local variable") &&
                    message.includes("never used")
                ) {
                    type = "unused-variable";
                } else if (message.includes("assigned to but never used")) {
                    type = "unused-variable";
                }

                if (type !== "other") {
                    items.push({
                        type,
                        file: filePath,
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
}
