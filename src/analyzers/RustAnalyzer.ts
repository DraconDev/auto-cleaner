import { exec } from "child_process";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "../core/IAnalyzer";
import { Logger } from "../utils/Logger";

const execAsync = promisify(exec);

interface RustWarning {
    message: {
        code?: {
            code: string;
        };
        message: string;
        spans: Array<{
            file_name: string;
            line_start: number;
            line_end: number;
            column_start: number;
            column_end: number;
            is_primary: boolean;
            text: Array<{ text: string }>;
        }>;
    };
    level: string;
}

/**
 * Analyzer for Rust projects
 * Detects unused imports by parsing cargo build warnings
 */
export class RustAnalyzer implements IAnalyzer {
    readonly name = "rust";
    readonly description = "Detects unused imports in Rust projects";
    readonly languages = ["rust"];
    readonly fileExtensions = [".rs"];

    constructor(private configManager: any) {}

    isEnabled(): boolean {
        return this.configManager.isAnalyzerEnabled("rust");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        const items: CleanableItem[] = [];
        let totalFiles = 0;

        try {
            Logger.log(
                `[RustAnalyzer] Scanning workspace: ${workspace.uri.fsPath}`
            );

            // Find all Cargo.toml files to detect Rust projects/workspaces
            const cargoFiles = await vscode.workspace.findFiles(
                "**/Cargo.toml",
                "**/target/**"
            );

            Logger.log(
                `[RustAnalyzer] Found ${cargoFiles.length} Cargo.toml files`
            );

            if (cargoFiles.length === 0) {
                Logger.log("[RustAnalyzer] No Cargo.toml found. Skipping.");
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
            const projectRoots = new Set<string>();
            const rootCargo = cargoFiles.find(
                (f) => path.dirname(f.fsPath) === workspace.uri.fsPath
            );

            if (rootCargo) {
                projectRoots.add(workspace.uri.fsPath);
                Logger.log(
                    `[RustAnalyzer] Found root Cargo.toml at ${workspace.uri.fsPath}`
                );
            } else {
                // No root Cargo.toml, add all found directories
                for (const file of cargoFiles) {
                    const dir = path.dirname(file.fsPath);
                    projectRoots.add(dir);
                    Logger.log(`[RustAnalyzer] Found nested project at ${dir}`);
                }
            }

            const filesSet = new Set<string>();

            for (const cwd of projectRoots) {
                try {
                    Logger.log(
                        `[RustAnalyzer] Running 'cargo check' in ${cwd}`
                    );
                    // Run cargo check with JSON output
                    const { stdout, stderr } = await execAsync(
                        "cargo check --message-format=json",
                        {
                            cwd,
                            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                        }
                    );

                    // Parse JSON lines from cargo output
                    const lines = (stdout + stderr)
                        .split("\n")
                        .filter((l) => l.trim());

                    Logger.log(
                        `[RustAnalyzer] 'cargo check' returned ${lines.length} lines of output`
                    );

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        try {
                            const msg = JSON.parse(line) as RustWarning;

                            // Filter for compiler warnings
                            if (msg.message && msg.level === "warning") {
                                const code = msg.message.code?.code;

                                // Focus on unused imports
                                if (code === "unused_imports") {
                                    const span = msg.message.spans.find(
                                        (s) => s.is_primary
                                    );
                                    if (span) {
                                        const absPath = path.isAbsolute(
                                            span.file_name
                                        )
                                            ? span.file_name
                                            : path.join(cwd, span.file_name);

                                        filesSet.add(absPath);
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
                                            codeSnippet: span.text[0]?.text,
                                            suggestion: "Remove unused import",
                                            isGrayArea: false,
                                        });
                                    }
                                }
                            }
                        } catch (parseError) {
                            // Skip non-JSON lines
                            continue;
                        }
                    }
                } catch (err: any) {
                    Logger.error(
                        `[RustAnalyzer] Cargo check failed in ${cwd}`,
                        err
                    );
                    vscode.window.showErrorMessage(
                        `Auto Cleaner: Cargo check failed in ${cwd}. Is cargo installed? Check Output channel.`
                    );
                    // Continue to next project root if any
                }
            }

            totalFiles = filesSet.size;
            Logger.log(
                `[RustAnalyzer] Scan complete. Found ${items.length} issues in ${totalFiles} files.`
            );
        } catch (error: any) {
            Logger.error("[RustAnalyzer] Fatal error during scan", error);
            // If cargo is not available or command failed, return empty result
            if (error.message?.includes("cargo")) {
                vscode.window.showWarningMessage(
                    "Rust analyzer requires cargo to be installed and in PATH"
                );
            }
        }

        const breakdown: Record<string, number> = {};
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

    async clean(items: CleanableItem[]): Promise<CleanResult> {
        const errors: Array<{ item: CleanableItem; error: string }> = [];
        let itemsCleaned = 0;

        // Group items by file to minimize document operations
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

                // Sort items by line number (descending) to delete from bottom to top
                const sortedItems = fileItems.sort(
                    (a, b) => (b.line || 0) - (a.line || 0)
                );

                for (const item of sortedItems) {
                    if (
                        item.type === "unused-import" &&
                        item.line &&
                        item.endLine
                    ) {
                        // Delete the import lines
                        const startLine = item.line - 1;
                        const endLine = item.endLine - 1;
                        const range = new vscode.Range(
                            new vscode.Position(startLine, 0),
                            new vscode.Position(endLine + 1, 0) // Include line break
                        );
                        edit.delete(vscode.Uri.file(filePath), range);
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
}
