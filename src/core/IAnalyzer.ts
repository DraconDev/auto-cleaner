import * as vscode from "vscode";

/**
 * Base interface that all language analyzers must implement
 */
export interface IAnalyzer {
    // Metadata
    readonly name: string;
    readonly description: string;
    readonly languages: string[];
    readonly fileExtensions: string[];

    // Core methods
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    clean(items: CleanableItem[]): Promise<CleanResult>;

    // Configuration
    isEnabled(): boolean;
}

/**
 * Result from running an analyzer
 */
export interface AnalysisResult {
    analyzerName: string;
    language: string;
    summary: {
        totalFiles: number;
        totalIssues: number;
        breakdown: Record<string, number>; // e.g., {"unused-import": 5, "unused-function": 2}
    };
    items: CleanableItem[];
}

/**
 * An item that can potentially be cleaned/removed
 */
export interface CleanableItem {
    // What
    type: string; // "unused-import", "unused-function", "empty-file", etc.
    description: string;

    // Where
    file: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;

    // Metadata
    severity: "error" | "warning" | "info";
    confidence: "high" | "medium" | "low"; // How sure are we it's unused?
    category: "dead-code" | "redundant" | "empty" | "duplicate";

    // Context
    codeSnippet?: string;
    suggestion?: string; // What to do about it
    isGrayArea: boolean; // Exported functions, etc.

    // Granular filtering metadata
    isExported?: boolean; // Is this item exported (pub, export, etc.)?
    isUsedInternally?: boolean; // Is it used within the same module/file?
    isUsedExternally?: boolean; // Is it used by other modules/packages?

    // Analyzer specific data
    data?: any;
}

/**
 * Result from cleaning items
 */
export interface CleanResult {
    success: boolean;
    itemsCleaned: number;
    errors: Array<{ item: CleanableItem; error: string }>;
}

/**
 * Analyzer-specific settings
 */
export interface AnalyzerSettings {
    enabled: boolean;
    [key: string]: any;
}
