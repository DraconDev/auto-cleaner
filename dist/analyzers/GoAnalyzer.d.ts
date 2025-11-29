import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "../core/IAnalyzer";
/**
 * Analyzer for Go projects
 * Detects unused functions (non-exported) via go build errors
 * Go compiler strictly enforces no unused variables and imports at compile-time
 */
export declare class GoAnalyzer implements IAnalyzer {
    private configManager;
    readonly name = "go";
    readonly description = "Detects unused functions and variables in Go projects";
    readonly languages: string[];
    readonly fileExtensions: string[];
    constructor(configManager: any);
    isEnabled(): boolean;
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    private parseGoErrors;
    private parseGoVetWarnings;
    clean(items: CleanableItem[]): Promise<CleanResult>;
}
//# sourceMappingURL=GoAnalyzer.d.ts.map