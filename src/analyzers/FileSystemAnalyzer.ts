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

export class FileSystemAnalyzer implements IAnalyzer {
    readonly name = "FileSystem Analyzer";
    readonly description = "Detects empty files and directories";
    readonly languages = ["*"];
    readonly fileExtensions = ["*"];

    constructor(private configManager: ConfigurationManager) {}

    isEnabled(): boolean {
        return this.configManager.isAnalyzerEnabled("filesystem");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        const result: AnalysisResult = {
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
            await this.traverseDirectory(
                workspace.uri.fsPath,
                workspace.uri.fsPath,
                result
            );
        } catch (error) {
            console.error("Error scanning filesystem:", error);
        }

        return result;
    }

    private async traverseDirectory(
        currentPath: string,
        rootPath: string,
        result: AnalysisResult
    ): Promise<boolean> {
        // Returns true if the directory is empty (or contains only empty directories)
        let isEmpty = true;
        let hasChildren = false;

        try {
            const entries = await fs.readdir(currentPath, {
                withFileTypes: true,
            });

            for (const entry of entries) {
                const fullPath = path
                    .join(currentPath, entry.name)
                    .replace(/\\/g, "/");

                // Check exclusions and whitelist
                if (
                    this.configManager.isExcluded(fullPath, rootPath) ||
                    this.configManager.isWhitelisted(fullPath, rootPath)
                ) {
                    hasChildren = true; // Treated as non-empty to preserve it
                    isEmpty = false;
                    continue;
                }

                if (entry.isDirectory()) {
                    const isSubDirEmpty = await this.traverseDirectory(
                        fullPath,
                        rootPath,
                        result
                    );
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
                    } else {
                        isEmpty = false;
                        hasChildren = true;
                    }
                } else {
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
        } catch (error) {
            console.warn(`Error accessing ${currentPath}:`, error);
            return false; // Assume not empty on error
        }

        return !hasChildren;
    }

    async clean(items: CleanableItem[]): Promise<CleanResult> {
        const result: CleanResult = {
            success: true,
            itemsCleaned: 0,
            errors: [],
        };

        if (this.configManager.isDryRun()) {
            // Dry run: just log what would be deleted
            for (const item of items) {
                if (
                    item.type === "empty-file" ||
                    item.type === "empty-directory"
                ) {
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
                result.itemsCleaned = items.filter(
                    (i) =>
                        i.type === "empty-file" || i.type === "empty-directory"
                ).length;
            } else {
                result.success = false;
                result.errors.push({
                    item: items[0],
                    error: "Failed to apply workspace edit",
                });
            }
        } catch (error: any) {
            result.success = false;
            result.errors.push({
                item: items[0],
                error: error.message || "Unknown error during deletion",
            });
        }

        return result;
    }
}
