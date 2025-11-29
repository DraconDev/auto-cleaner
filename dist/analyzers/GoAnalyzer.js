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
exports.GoAnalyzer = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const util_1 = require("util");
const vscode = __importStar(require("vscode"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Analyzer for Go projects
 * Detects unused functions (non-exported) via go build errors
 * Go compiler strictly enforces no unused variables and imports at compile-time
 */
class GoAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "go";
        this.description = "Detects unused functions and variables in Go projects";
        this.languages = ["go"];
        this.fileExtensions = [".go"];
    }
    isEnabled() {
        return this.configManager.isAnalyzerEnabled("go");
    }
    async scan(workspace) {
        const items = [];
        let totalFiles = 0;
        try {
            // Check if this is a Go project (has go.mod or .go files)
            const goModPath = path.join(workspace.uri.fsPath, "go.mod");
            let isGoProject = false;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(goModPath));
                isGoProject = true;
            }
            catch {
                // Check for .go files
                const goFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspace, "**/*.go"), "**/vendor/**", 1);
                isGoProject = goFiles.length > 0;
            }
            if (!isGoProject) {
                return {
                    analyzerName: this.name,
                    language: "go",
                    summary: {
                        totalFiles: 0,
                        totalIssues: 0,
                        breakdown: {},
                    },
                    items: [],
                };
            }
            // Run go build to get compile errors and warnings
            try {
                await execAsync("go build ./...", {
                    cwd: workspace.uri.fsPath,
                });
            }
            catch (error) {
                // go build exits with error on unused imports/variables
                // We parse the error output for unused items
                const output = error.stderr || error.stdout || "";
                this.parseGoErrors(output, items);
            }
            // Also run go vet for additional analysis
            try {
                const { stdout, stderr } = await execAsync("go vet ./...", {
                    cwd: workspace.uri.fsPath,
                });
                this.parseGoVetWarnings(stdout + stderr, items);
            }
            catch (error) {
                const output = error.stderr || error.stdout || "";
                this.parseGoVetWarnings(output, items);
            }
            const filesSet = new Set(items.map((i) => i.file));
            totalFiles = filesSet.size;
        }
        catch (error) {
            console.error("Error running Go analyzer:", error);
            if (error.message?.includes("go:")) {
                vscode.window.showWarningMessage("Go analyzer requires go to be installed and in PATH");
            }
        }
        const breakdown = {};
        items.forEach((item) => {
            breakdown[item.type] = (breakdown[item.type] || 0) + 1;
        });
        return {
            analyzerName: this.name,
            language: "go",
            summary: {
                totalFiles,
                totalIssues: items.length,
                breakdown,
            },
            items,
        };
    }
    parseGoErrors(output, items) {
        const lines = output.split("\n");
        for (const line of lines) {
            // Pattern: ./main.go:3:2: imported and not used: "fmt"
            const importMatch = line.match(/^(.+\.go):(\d+):(\d+):\s+imported and not used:\s+"(.+)"/);
            if (importMatch) {
                items.push({
                    type: "unused-import",
                    description: `Imported and not used: "${importMatch[4]}"`,
                    file: importMatch[1],
                    line: parseInt(importMatch[2]),
                    column: parseInt(importMatch[3]),
                    severity: "error",
                    confidence: "high",
                    category: "dead-code",
                    suggestion: "Remove unused import",
                    isGrayArea: false,
                });
                continue;
            }
            // Pattern: ./main.go:7:2: unusedVar declared and not used
            const varMatch = line.match(/^(.+\.go):(\d+):(\d+):\s+(\w+)\s+declared and not used/);
            if (varMatch) {
                items.push({
                    type: "unused-variable",
                    description: `${varMatch[4]} declared and not used`,
                    file: varMatch[1],
                    line: parseInt(varMatch[2]),
                    column: parseInt(varMatch[3]),
                    severity: "error",
                    confidence: "high",
                    category: "dead-code",
                    suggestion: "Remove or use variable, or prefix with _",
                    isGrayArea: false,
                });
            }
        }
    }
    parseGoVetWarnings(output, items) {
        const lines = output.split("\n");
        for (const line of lines) {
            // go vet can find additional issues
            // We're primarily interested in unused functions here
            // Note: go doesn't typically report unused functions unless they're genuinely unreachable
            // This is more about dead code that vet can detect
            // For now, we focus on what go build gives us
            // Advanced function usage analysis would require AST parsing
        }
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
                            const newContent = lineContent.replace(/\b(\w+)\s+:?=/, "_$1 :=");
                            const range = document.lineAt(item.line - 1).range;
                            edit.replace(vscode.Uri.file(filePath), range, newContent);
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
}
exports.GoAnalyzer = GoAnalyzer;
//# sourceMappingURL=GoAnalyzer.js.map