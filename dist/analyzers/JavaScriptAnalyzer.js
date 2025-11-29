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
exports.JavaScriptAnalyzer = void 0;
const cp = __importStar(require("child_process"));
const vscode = __importStar(require("vscode"));
class JavaScriptAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "javascript";
        this.description = "JavaScript Analyzer (via ESLint)";
        this.languages = ["javascript"];
        this.fileExtensions = [".js", ".jsx", ".mjs"];
    }
    isEnabled() {
        const enabledAnalyzers = this.configManager.getEnabledAnalyzers();
        return enabledAnalyzers.includes("javascript");
    }
    async scan(workspace) {
        const result = {
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
        const items = [];
        try {
            // Use ESLint with no-unused-vars rule
            // --rule 'no-unused-vars: 2' enforces the rule
            // --format compact for easier parsing
            const command = `npx eslint --rule 'no-unused-vars: 2' --format compact ${workspace.uri.fsPath}/**/*.{js,jsx,mjs}`;
            const output = await this.runCommand(command, workspace.uri.fsPath);
            items.push(...this.parseESLintOutput(output, workspace.uri.fsPath));
        }
        catch (error) {
            console.error("JavaScriptAnalyzer scan failed:", error);
            if (error instanceof Error && error.stdout) {
                items.push(...this.parseESLintOutput(error.stdout, workspace.uri.fsPath));
            }
        }
        // Calculate summary
        result.items = items;
        result.summary.totalIssues = items.length;
        const breakdown = {};
        for (const item of items) {
            breakdown[item.type] = (breakdown[item.type] || 0) + 1;
        }
        result.summary.breakdown = breakdown;
        // Count files
        const files = new Set(items.map((i) => i.file));
        result.summary.totalFiles = files.size;
        return result;
    }
    async clean(items) {
        const errors = [];
        let itemsCleaned = 0;
        // Group items by file
        const itemsByFile = new Map();
        for (const item of items) {
            if (!itemsByFile.has(item.file)) {
                itemsByFile.set(item.file, []);
            }
            itemsByFile.get(item.file).push(item);
        }
        for (const [filePath, fileItems] of itemsByFile) {
            try {
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                const edit = new vscode.WorkspaceEdit();
                // Sort items by line number (descending) to edit from bottom to top
                const sortedItems = fileItems.sort((a, b) => (b.line || 0) - (a.line || 0));
                for (const item of sortedItems) {
                    if (item.line) {
                        if (item.type === "unused-import") {
                            // Remove the entire import line
                            const range = document.lineAt(item.line - 1).rangeIncludingLineBreak;
                            edit.delete(vscode.Uri.file(filePath), range);
                        }
                        else if (item.type === "unused-variable") {
                            // Prefix variable with underscore
                            const lineContent = document.lineAt(item.line - 1).text;
                            // Match various JS variable patterns: const/let/var x = ...
                            const newContent = lineContent.replace(/\b(const|let|var)\s+([a-zA-Z_$]\w*)/, "$1 _$2");
                            if (newContent !== lineContent) {
                                const range = document.lineAt(item.line - 1).range;
                                edit.replace(vscode.Uri.file(filePath), range, newContent);
                            }
                        }
                    }
                }
                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    itemsCleaned += sortedItems.length;
                }
                else {
                    errors.push({
                        item: fileItems[0],
                        error: "Failed to apply workspace edit",
                    });
                }
            }
            catch (error) {
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
    async runCommand(command, cwd) {
        return new Promise((resolve, reject) => {
            cp.exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (stdout) {
                    resolve(stdout);
                }
                else if (error) {
                    reject({ ...error, stdout, stderr });
                }
                else {
                    resolve("");
                }
            });
        });
    }
    parseESLintOutput(output, workspacePath) {
        const items = [];
        const lines = output.split("\n");
        // ESLint compact format: filepath: line:column, message - rule
        // Example: /path/to/file.js: line 1, col 7, Error - 'module' is defined but never used. (no-unused-vars)
        const regex = /^(.+?):\s*line\s+(\d+),\s*col\s+(\d+),\s*(.+?)\s*-\s*(.+?)\s*\((.+?)\)$/;
        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const [_, filePath, lineStr, colStr, severity, message, rule] = match;
                const lineNum = parseInt(lineStr, 10);
                const colNum = parseInt(colStr, 10);
                if (rule === "no-unused-vars") {
                    let type = "unused-variable";
                    if (message.includes("import")) {
                        type = "unused-import";
                    }
                    items.push({
                        type,
                        file: filePath,
                        line: lineNum,
                        column: colNum,
                        description: message,
                        severity: severity.toLowerCase(),
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
exports.JavaScriptAnalyzer = JavaScriptAnalyzer;
//# sourceMappingURL=JavaScriptAnalyzer.js.map