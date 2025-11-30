import * as cp from "child_process";
import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";

export class JavaScriptAnalyzer implements IAnalyzer {
    name = "javascript";
    description = "JavaScript Analyzer (via ESLint)";
    languages = ["javascript"];
    fileExtensions = [".js", ".jsx", ".mjs"];

    constructor(private configManager: ConfigurationManager) {}

    isEnabled(): boolean {
        const enabledAnalyzers = this.configManager.getEnabledAnalyzers();
        return enabledAnalyzers.includes("javascript");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        const result: AnalysisResult = {
            analyzerName: this.name,
            language: "javascript",
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
            // Use ESLint with no-unused-vars rule
            // --rule 'no-unused-vars: 2' enforces the rule
            // --format compact for easier parsing
            const command = `npx eslint --rule 'no-unused-vars: 2' --format compact ${workspace.uri.fsPath}/**/*.{js,jsx,mjs}`;
            const output = await this.runCommand(command, workspace.uri.fsPath);
            items.push(...this.parseESLintOutput(output, workspace.uri.fsPath));
        } catch (error) {
            console.error("JavaScriptAnalyzer scan failed:", error);
            if (error instanceof Error && (error as any).stdout) {
                items.push(
                    ...this.parseESLintOutput(
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
                            // Match various JS variable patterns: const/let/var x = ...
                            const newContent = lineContent.replace(
                                /\b(const|let|var)\s+([a-zA-Z_$]\w*)/,
                                "$1 _$2"
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

    private async analyzeExportStatus(
        filePath: string,
        line: number,
        itemName: string
    ): Promise<{ isExported: boolean; isUsedInternally: boolean }> {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            const itemLine = lines[line - 1] || "";

            // Check for 'export' keyword or module.exports
            // Matches: export const, export function, export default, module.exports, exports.foo
            const isExported =
                /\bexport\s+(const|function|class|default|var|let)\s+/.test(
                    itemLine
                ) ||
                /\b(module\.)?exports\s*(\.|\[|=)/.test(itemLine) ||
                /\bexport\s*{\s*\w+/.test(content);

            // Check internal usage (simple grep for the item name)
            // We count occurrences. Definition is 1. Usage > 1.
            const occurrences = content.split(itemName).length - 1;
            const isUsedInternally = occurrences > 1;

            return { isExported, isUsedInternally };
        } catch (error) {
            console.error(
                `Error analyzing export status for ${itemName} in ${filePath}:`,
                error
            );
            return { isExported: true, isUsedInternally: true };
        }
    }

    private async parseESLintOutput(
        output: string,
        workspacePath: string
    ): Promise<CleanableItem[]> {
        const items: CleanableItem[] = [];
        const lines = output.split("\n");

        // ESLint compact format: filepath: line:column, message - rule
        // Example: /path/to/file.js: line 1, col 7, Error - 'module' is defined but never used. (no-unused-vars)
        const regex =
            /^(.+?):\s*line\s+(\d+),\s*col\s+(\d+),\s*(.+?)\s*-\s*(.+?)\s*\((.+?)\)$/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const [_, filePath, lineStr, colStr, severity, message, rule] =
                    match;
                const lineNum = parseInt(lineStr, 10);
                const colNum = parseInt(colStr, 10);

                if (rule === "no-unused-vars") {
                    let type = "unused-variable";
                    if (message.includes("import")) {
                        type = "unused-import";
                    }

                    // Extract item name from message
                    // Message format: "'foo' is defined but never used."
                    const nameMatch = message.match(/'([^']+)'/);
                    const itemName = nameMatch ? nameMatch[1] : "";

                    let isExported = false;
                    let isUsedInternally = false;

                    if (itemName) {
                        const status = await this.analyzeExportStatus(
                            filePath,
                            lineNum,
                            itemName
                        );
                        isExported = status.isExported;
                        isUsedInternally = status.isUsedInternally;
                    }

                    // Filter based on granular settings
                    if (type === "unused-variable") {
                        const settings =
                            this.configManager.getVariableCleaningSettings();

                        if (
                            isExported &&
                            isUsedInternally &&
                            settings.alwaysKeepExportedAndUsed
                        ) {
                            continue;
                        }

                        if (
                            isExported &&
                            !isUsedInternally &&
                            !settings.cleanExportedButUnused
                        ) {
                            continue;
                        }

                        if (!isExported && !settings.cleanUnexported) {
                            continue;
                        }
                    }

                    items.push({
                        type,
                        file: filePath,
                        line: lineNum,
                        column: colNum,
                        description: message,
                        severity: severity.toLowerCase() as any,
                        confidence: "high",
                        category: "dead-code",
                        isGrayArea: isExported,
                        isExported,
                        isUsedInternally,
                    });
                }
            }
        }

        return items;
    }
}
