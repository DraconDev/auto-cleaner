import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "../core/IAnalyzer";
/**
 * Analyzer for Rust projects
 * Detects unused imports by parsing cargo build warnings
 */
export declare class RustAnalyzer implements IAnalyzer {
    private configManager;
    readonly name = "rust";
    readonly description = "Detects unused imports in Rust projects";
    readonly languages: string[];
    readonly fileExtensions: string[];
    constructor(configManager: any);
    isEnabled(): boolean;
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    clean(items: CleanableItem[]): Promise<CleanResult>;
}
//# sourceMappingURL=RustAnalyzer.d.ts.map