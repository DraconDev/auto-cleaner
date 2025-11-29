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
exports.FileSystemAnalyzer = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class FileSystemAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "FileSystem Analyzer";
        this.description = "Detects empty files and directories";
        this.languages = ["*"];
        this.fileExtensions = ["*"];
    }
    isEnabled() {
        return this.configManager.isAnalyzerEnabled("filesystem");
    }
    async scan(workspace) {
        const result = {
            analyzerName: "filesystem",
            language: "*",
            items: [],
            summary: {
                totalFiles: 0,
                totalIssues: 0,
                breakdown: {},
            },
        };
        if (!this.isEnabled()) {
            return result;
        }
        try {
            await this.traverseDirectory(workspace.uri.fsPath, workspace.uri.fsPath, result);
        }
        catch (error) {
            console.error("Error scanning filesystem:", error);
        }
        return result;
    }
    async traverseDirectory(currentPath, rootPath, result) {
        // Returns true if the directory is empty (or contains only empty directories)
        let isEmpty = true;
        let hasChildren = false;
        try {
            const entries = await fs.readdir(currentPath, {
                withFileTypes: true,
            });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                // Check exclusions and whitelist
                if (this.configManager.isExcluded(fullPath, rootPath) ||
                    this.configManager.isWhitelisted(fullPath, rootPath)) {
                    hasChildren = true; // Treated as non-empty to preserve it
                    isEmpty = false;
                    continue;
                }
                if (entry.isDirectory()) {
                    const isSubDirEmpty = await this.traverseDirectory(fullPath, rootPath, result);
                    if (isSubDirEmpty) {
                        // It's an empty directory candidate
                        result.items.push({
                            type: "empty-directory",
                            description: "Empty directory",
                            file: fullPath,
                            severity: "info",
                            confidence: "high",
                            category: "empty",
                            isGrayArea: false,
                        });
                        result.summary.totalIssues++;
                        result.summary.breakdown["empty-directory"] =
                            (result.summary.breakdown["empty-directory"] || 0) +
                                1;
                    }
                    else {
                        isEmpty = false;
                        hasChildren = true;
                    }
                }
                else {
                    hasChildren = true;
                    isEmpty = false;
                    result.summary.totalFiles++;
                    // Check for empty file
                    const stats = await fs.stat(fullPath);
                    if (stats.size === 0) {
                        result.items.push({
                            type: "empty-file",
                            description: "Empty file (0 bytes)",
                            file: fullPath,
                            severity: "info",
                            confidence: "high",
                            category: "empty",
                            isGrayArea: false,
                        });
                        result.summary.totalIssues++;
                        result.summary.breakdown["empty-file"] =
                            (result.summary.breakdown["empty-file"] || 0) + 1;
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Error accessing ${currentPath}:`, error);
            return false; // Assume not empty on error
        }
        return !hasChildren;
    }
    async clean(items) {
        const result = {
            success: true,
            itemsCleaned: 0,
            errors: [],
        };
        if (this.configManager.isDryRun()) {
            // Dry run: just log what would be deleted
            for (const item of items) {
                if (item.type === "empty-file" ||
                    item.type === "empty-directory") {
                    console.log(`[Dry Run] Would delete: ${item.file}`);
                    result.itemsCleaned++;
                }
            }
            return result;
        }
        // Use WorkspaceEdit for safe, undo-able deletion
        const edit = new vscode.WorkspaceEdit();
        for (const item of items) {
            if (item.type === "empty-file" || item.type === "empty-directory") {
                const uri = vscode.Uri.file(item.file);
                edit.deleteFile(uri, {
                    ignoreIfNotExists: true,
                    recursive: true,
                });
            }
        }
        try {
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                result.itemsCleaned = items.filter((i) => i.type === "empty-file" || i.type === "empty-directory").length;
            }
            else {
                result.success = false;
                result.errors.push({
                    item: items[0],
                    error: "Failed to apply workspace edit",
                });
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push({
                item: items[0],
                error: error.message || "Unknown error during deletion",
            });
        }
        return result;
    }
}
exports.FileSystemAnalyzer = FileSystemAnalyzer;
//# sourceMappingURL=FileSystemAnalyzer.js.map