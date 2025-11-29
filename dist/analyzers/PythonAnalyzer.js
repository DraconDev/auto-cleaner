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
exports.PythonAnalyzer = void 0;
const cp = __importStar(require("child_process"));
const vscode = __importStar(require("vscode"));
class PythonAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "python";
        this.description = "Python Analyzer (via pyflakes)";
        this.languages = ["python"];
        this.fileExtensions = [".py"];
    }
    isEnabled() {
        const enabledAnalyzers = this.configManager.getEnabledAnalyzers();
        return enabledAnalyzers.includes("python");
    }
    async scan(workspace) {
        const result = {
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
        const items = [];
        try {
            // Try pyflakes first (simpler, faster)
            const command = `pyflakes ${workspace.uri.fsPath}`;
            const output = await this.runCommand(command, workspace.uri.fsPath);
            items.push(...this.parsePyflakesOutput(output, workspace.uri.fsPath));
        }
        catch (error) {
            console.error("PythonAnalyzer scan failed:", error);
            if (error instanceof Error && error.stdout) {
                items.push(...this.parsePyflakesOutput(error.stdout, workspace.uri.fsPath));
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
                            // Match Python variable assignments: var = value or var: type = value
                            const newContent = lineContent.replace(/\b([a-zA-Z_]\w*)\s*(:\s*\w+)?\s*=/, "_$1$2 =");
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
    parsePyflakesOutput(output, workspacePath) {
        const items = [];
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
                }
                else if (message.includes("local variable") &&
                    message.includes("never used")) {
                    type = "unused-variable";
                }
                else if (message.includes("assigned to but never used")) {
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
exports.PythonAnalyzer = PythonAnalyzer;
//# sourceMappingURL=PythonAnalyzer.js.map