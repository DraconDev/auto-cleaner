import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "./IAnalyzer";
/**
 * Central registry for managing all language analyzers
 */
export declare class AnalyzerRegistry {
    private analyzers;
    /**
     * Register a new analyzer
     */
    register(analyzer: IAnalyzer): void;
    /**
     * Unregister an analyzer
     */
    unregister(name: string): void;
    /**
     * Get a specific analyzer by name
     */
    get(name: string): IAnalyzer | undefined;
    /**
     * Get all registered analyzers
     */
    getAll(): IAnalyzer[];
    /**
     * Get only enabled analyzers
     */
    getEnabledAnalyzers(): IAnalyzer[];
    /**
     * Run all enabled analyzers
     */
    runAll(workspaces: vscode.WorkspaceFolder[]): Promise<AnalysisResult[]>;
    /**
     * Run analyzers for a specific language
     */
    runForLanguage(language: string, workspaces: vscode.WorkspaceFolder[]): Promise<AnalysisResult[]>;
    /**
     * Clean items using the appropriate analyzer
     */
    cleanWithAnalyzer(analyzerName: string, items: CleanableItem[]): Promise<CleanResult>;
}
//# sourceMappingURL=AnalyzerRegistry.d.ts.map