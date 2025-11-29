import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";
export declare class FileSystemAnalyzer implements IAnalyzer {
    private configManager;
    readonly name = "FileSystem Analyzer";
    readonly description = "Detects empty files and directories";
    readonly languages: string[];
    readonly fileExtensions: string[];
    constructor(configManager: ConfigurationManager);
    isEnabled(): boolean;
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    private traverseDirectory;
    clean(items: CleanableItem[]): Promise<CleanResult>;
}
//# sourceMappingURL=FileSystemAnalyzer.d.ts.map