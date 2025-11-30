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
exports.RustAnalyzer = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const util_1 = require("util");
const vscode = __importStar(require("vscode"));
const Logger_1 = require("../utils/Logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Analyzer for Rust projects
 * Detects unused imports by parsing cargo build warnings
 */
class RustAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "rust";
        this.description = "Detects unused imports in Rust projects";
        this.languages = ["rust"];
        this.fileExtensions = [".rs"];
    }
    isEnabled() {
        return this.configManager.isAnalyzerEnabled("rust");
    }
    async analyzeExportStatus(filePath, line, itemName) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            const itemLine = lines[line - 1] || "";
            // Check for 'pub' keyword
            // Matches: pub fn, pub struct, pub enum, pub const, pub static, pub type, pub trait, pub mod
            // Also handles pub(crate), pub(super) which are technically exported from the module but restricted
            const isExported = /\bpub(\([^)]+\))?\s+(fn|struct|enum|trait|const|static|type|mod)\s+/.test(itemLine);
            // Check internal usage (simple grep for the item name)
            // We count occurrences. Definition is 1. Usage > 1.
            // This is a heuristic and might have false positives (comments, strings)
            // but is safer than deleting potentially used code.
            const occurrences = content.split(itemName).length - 1;
            const isUsedInternally = occurrences > 1;
            return { isExported, isUsedInternally };
        }
        catch (error) {
            Logger_1.Logger.error(`[RustAnalyzer] Error analyzing export status for ${itemName} in ${filePath}`, error);
            // Fail safe: assume it might be exported and used
            return { isExported: true, isUsedInternally: true };
        }
    }
    async scan(workspace) {
        const items = [];
        let totalFiles = 0;
        try {
            Logger_1.Logger.log(`[RustAnalyzer] Scanning workspace: ${workspace.uri.fsPath}`);
            // Find all Cargo.toml files to detect Rust projects/workspaces
            const cargoFiles = await vscode.workspace.findFiles("**/Cargo.toml", "**/target/**");
            Logger_1.Logger.log(`[RustAnalyzer] Found ${cargoFiles.length} Cargo.toml files`);
            if (cargoFiles.length === 0) {
                Logger_1.Logger.log("[RustAnalyzer] No Cargo.toml found. Skipping.");
                // Not a Rust project
                return {
                    analyzerName: this.name,
                    language: "rust",
                    summary: {
                        totalFiles: 0,
                        totalIssues: 0,
                        breakdown: {},
                    },
                    items: [],
                };
            }
            // Determine unique project roots
            // If we have a root Cargo.toml, it likely covers children (workspace)
            // If not, we might have multiple independent projects
            const projectRoots = new Set();
            const rootCargo = cargoFiles.find((f) => path.dirname(f.fsPath) === workspace.uri.fsPath);
            if (rootCargo) {
                projectRoots.add(workspace.uri.fsPath);
                Logger_1.Logger.log(`[RustAnalyzer] Found root Cargo.toml at ${workspace.uri.fsPath}`);
            }
            else {
                // No root Cargo.toml, add all found directories
                for (const file of cargoFiles) {
                    const dir = path.dirname(file.fsPath);
                    projectRoots.add(dir);
                    Logger_1.Logger.log(`[RustAnalyzer] Found nested project at ${dir}`);
                }
            }
            const filesSet = new Set();
            for (const cwd of projectRoots) {
                try {
                    Logger_1.Logger.log(`[RustAnalyzer] Running 'cargo check' in ${cwd}`);
                    // Run cargo check with JSON output
                    // Force warnings for unused code using RUSTFLAGS
                    const { stdout, stderr } = await execAsync("cargo check --message-format=json", {
                        cwd,
                        maxBuffer: 10 * 1024 * 1024,
                        env: {
                            ...process.env,
                            RUSTFLAGS: (process.env.RUSTFLAGS || "") +
                                " -W unused_imports -W dead_code -W unused_variables",
                        },
                    });
                    // Parse JSON lines from cargo output
                    const lines = (stdout + stderr)
                        .split("\n")
                        .filter((l) => l.trim());
                    Logger_1.Logger.log(`[RustAnalyzer] 'cargo check' returned ${lines.length} lines of output`);
                    let warningCount = 0;
                    let unusedImportCount = 0;
                    const warningCodes = new Set();
                    for (const line of lines) {
                        if (!line.trim())
                            continue;
                        try {
                            const msg = JSON.parse(line);
                            // Filter for compiler warnings
                            if (msg.message &&
                                msg.message.level === "warning") {
                                warningCount++;
                                const code = msg.message.code?.code;
                                if (code) {
                                    warningCodes.add(code);
                                }
                                // Focus on unused imports
                                if (code === "unused_imports") {
                                    unusedImportCount++;
                                    const span = msg.message.spans.find((s) => s.is_primary);
                                    if (span) {
                                        const absPath = path.isAbsolute(span.file_name)
                                            ? span.file_name
                                            : path.join(cwd, span.file_name);
                                        filesSet.add(absPath);
                                        // Analyze export status
                                        const itemName = span.text[0]?.text;
                                        let isExported = false;
                                        let isUsedInternally = false;
                                        if (itemName) {
                                            const status = await this.analyzeExportStatus(absPath, span.line_start, itemName);
                                            isExported = status.isExported;
                                            isUsedInternally =
                                                status.isUsedInternally;
                                        }
                                        // Filter based on granular settings
                                        // For imports, we generally treat them as "variables" or "functions" depending on context
                                        // But unused imports are usually safe to remove regardless of export status
                                        // However, if it's a `pub use`, it's an export.
                                        // If it's exported and used internally, and we want to keep those:
                                        const funcSettings = this.configManager.getFunctionCleaningSettings();
                                        if (isExported &&
                                            isUsedInternally &&
                                            funcSettings.alwaysKeepExportedAndUsed) {
                                            continue; // Skip this item
                                        }
                                        if (isExported &&
                                            !isUsedInternally &&
                                            !funcSettings.cleanExportedButUnused) {
                                            continue; // Skip this item
                                        }
                                        if (!isExported &&
                                            !funcSettings.cleanUnexported) {
                                            continue; // Skip this item
                                        }
                                        items.push({
                                            type: "unused-import",
                                            description: msg.message.message,
                                            file: absPath,
                                            line: span.line_start,
                                            column: span.column_start,
                                            endLine: span.line_end,
                                            endColumn: span.column_end,
                                            severity: "warning",
                                            confidence: "high",
                                            category: "dead-code",
                                            codeSnippet: itemName,
                                            suggestion: "Remove unused import",
                                            isGrayArea: isExported,
                                            isExported,
                                            isUsedInternally,
                                        });
                                    }
                                }
                            }
                        }
                        catch (parseError) {
                            // Skip non-JSON lines
                            continue;
                        }
                    }
                    Logger_1.Logger.log(`[RustAnalyzer] Found ${warningCount} total warnings`);
                    Logger_1.Logger.log(`[RustAnalyzer] Found ${unusedImportCount} unused import warnings`);
                    if (warningCodes.size > 0) {
                        Logger_1.Logger.log(`[RustAnalyzer] Warning codes: ${Array.from(warningCodes).join(", ")}`);
                    }
                    else {
                        Logger_1.Logger.log(`[RustAnalyzer] No warning codes found. Your project may need rustc flags for unused checks.`);
                        Logger_1.Logger.log(`[RustAnalyzer] Suggestion: Add to Cargo.toml: [lints.rust] unused_imports = "warn"`);
                    }
                }
                catch (err) {
                    Logger_1.Logger.error(`[RustAnalyzer] Cargo check failed in ${cwd}`, err);
                    if (err.stderr) {
                        Logger_1.Logger.error(`[RustAnalyzer] Stderr: ${err.stderr}`);
                    }
                    if (err.stdout) {
                        Logger_1.Logger.log(`[RustAnalyzer] Stdout (partial): ${err.stdout.substring(0, 200)}...`);
                    }
                    vscode.window.showErrorMessage(`Auto Cleaner: Cargo check failed. Check 'Auto Cleaner' output channel for details.`);
                    // Continue to next project root if any
                }
            }
            totalFiles = filesSet.size;
            Logger_1.Logger.log(`[RustAnalyzer] Scan complete. Found ${items.length} issues in ${totalFiles} files.`);
        }
        catch (error) {
            Logger_1.Logger.error("[RustAnalyzer] Fatal error during scan", error);
            // If cargo is not available or command failed, return empty result
            if (error.message?.includes("cargo")) {
                vscode.window.showWarningMessage("Rust analyzer requires cargo to be installed and in PATH");
            }
        }
        const breakdown = {};
        items.forEach((item) => {
            breakdown[item.type] = (breakdown[item.type] || 0) + 1;
        });
        return {
            analyzerName: this.name,
            language: "rust",
            summary: {
                totalFiles,
                totalIssues: items.length,
                breakdown,
            },
            items,
        };
    }
    async clean(items) {
        const errors = [];
        let itemsCleaned = 0;
        // Group items by file to minimize document operations
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
                // Sort items by line number (descending) to delete from bottom to top
                const sortedItems = fileItems.sort((a, b) => (b.line || 0) - (a.line || 0));
                for (const item of sortedItems) {
                    if (item.type === "unused-import" &&
                        item.line &&
                        item.endLine &&
                        item.column &&
                        item.endColumn) {
                        const startLine = item.line - 1;
                        const endLine = item.endLine - 1;
                        const startCol = item.column - 1;
                        const endCol = item.endColumn - 1;
                        // Get the text of the line(s)
                        const lineRange = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine + 1, 0));
                        const fullText = document.getText(lineRange);
                        // Get the full line text to check for use statement
                        const lineText = document.lineAt(startLine).text;
                        // Check if this is a simple "use X;" statement (not multi-import)
                        // Pattern: optional whitespace, "use", whitespace, import path, optional whitespace, ";"
                        const simpleUsePattern = /^\s*use\s+[^{]+;\s*$/;
                        const isSimpleUseStatement = simpleUsePattern.test(lineText) &&
                            !lineText.includes("{");
                        // If it's a simple use statement, delete the whole line
                        if (isSimpleUseStatement) {
                            const range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine + 1, 0));
                            edit.delete(vscode.Uri.file(filePath), range);
                            continue; // Skip to next item
                        }
                        // Check if there is other code on the same line
                        // This handles cases like: use foo::{Bar, Baz}; where Baz is unused
                        // or multi-line:
                        // use foo::{
                        //    Bar, Baz
                        // };
                        const textBefore = lineText
                            .substring(0, startCol)
                            .trim();
                        const textAfter = lineText.substring(endCol).trim();
                        // If there is meaningful code before or after, we must NOT delete the whole line
                        // We treat '{' as meaningful code if it's on the same line
                        const hasCodeBefore = textBefore.length > 0 && textBefore !== "{";
                        const hasCodeAfter = textAfter.length > 0 &&
                            textAfter !== "," &&
                            textAfter !== "}" &&
                            textAfter !== ";";
                        // Special case: if the line is just "    UserId," or "    UserId;" or "    UserId" -> Delete whole line
                        // But if it is "    AuthenticatedUser, UserId," -> Only delete UserId
                        const isAloneOnLine = !hasCodeBefore &&
                            (!textAfter ||
                                textAfter === "," ||
                                textAfter === ";");
                        if (!isAloneOnLine || fullText.includes("{")) {
                            // Smart deletion for partial items
                            let deleteRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol));
                            // Check for trailing comma
                            const afterRange = new vscode.Range(new vscode.Position(endLine, endCol), new vscode.Position(endLine, endCol + 1));
                            const charAfter = document.getText(afterRange);
                            if (charAfter === ",") {
                                // Include trailing comma and potential whitespace
                                deleteRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1));
                                // Also try to consume following whitespace
                                const wsRange = new vscode.Range(new vscode.Position(endLine, endCol + 1), new vscode.Position(endLine, endCol + 2));
                                if (document.getText(wsRange) === " ") {
                                    deleteRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 2));
                                }
                            }
                            else {
                                // Check for leading comma if no trailing comma
                                if (startCol > 0) {
                                    const beforeRange = new vscode.Range(new vscode.Position(startLine, startCol - 1), new vscode.Position(startLine, startCol));
                                    const charBefore = document.getText(beforeRange);
                                    if (charBefore === ",") {
                                        // Include leading comma
                                        deleteRange = new vscode.Range(new vscode.Position(startLine, startCol - 1), new vscode.Position(endLine, endCol));
                                        // Also try to consume leading whitespace before comma
                                        if (startCol > 1) {
                                            const wsBefore = new vscode.Range(new vscode.Position(startLine, startCol - 2), new vscode.Position(startLine, startCol - 1));
                                            if (document.getText(wsBefore) ===
                                                " ") {
                                                deleteRange = new vscode.Range(new vscode.Position(startLine, startCol - 2), new vscode.Position(endLine, endCol));
                                            }
                                        }
                                    }
                                }
                            }
                            edit.delete(vscode.Uri.file(filePath), deleteRange);
                        }
                        else {
                            // than leaving 'use ;' artifacts, and usually correct for single imports.
                            const range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine + 1, 0));
                            edit.delete(vscode.Uri.file(filePath), range);
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
exports.RustAnalyzer = RustAnalyzer;
//# sourceMappingURL=RustAnalyzer.js.map