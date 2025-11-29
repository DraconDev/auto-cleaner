import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";
export declare class JavaScriptAnalyzer implements IAnalyzer {
    private configManager;
    name: string;
    description: string;
    languages: string[];
    fileExtensions: string[];
    constructor(configManager: ConfigurationManager);
    isEnabled(): boolean;
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    clean(items: CleanableItem[]): Promise<CleanResult>;
    private runCommand;
    private parseESLintOutput;
}
//# sourceMappingURL=JavaScriptAnalyzer.d.ts.map