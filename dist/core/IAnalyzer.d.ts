import * as vscode from "vscode";
/**
 * Base interface that all language analyzers must implement
 */
export interface IAnalyzer {
    readonly name: string;
    readonly description: string;
    readonly languages: string[];
    readonly fileExtensions: string[];
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    clean(items: CleanableItem[]): Promise<CleanResult>;
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
        breakdown: Record<string, number>;
    };
    items: CleanableItem[];
}
/**
 * An item that can potentially be cleaned/removed
 */
export interface CleanableItem {
    type: string;
    description: string;
    file: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    severity: "error" | "warning" | "info";
    confidence: "high" | "medium" | "low";
    category: "dead-code" | "redundant" | "empty" | "duplicate";
    codeSnippet?: string;
    suggestion?: string;
    isGrayArea: boolean;
    data?: any;
}
/**
 * Result from cleaning items
 */
export interface CleanResult {
    success: boolean;
    itemsCleaned: number;
    errors: Array<{
        item: CleanableItem;
        error: string;
    }>;
}
/**
 * Analyzer-specific settings
 */
export interface AnalyzerSettings {
    enabled: boolean;
    [key: string]: any;
}
//# sourceMappingURL=IAnalyzer.d.ts.map