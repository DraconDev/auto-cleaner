import * as vscode from "vscode";
import { AnalysisResult, CleanableItem, CleanResult, IAnalyzer } from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";
export declare class CSSAnalyzer implements IAnalyzer {
    private configManager;
    name: string;
    description: string;
    languages: string[];
    fileExtensions: string[];
    private results;
    private usedSelectors;
    private usedVariables;
    private importedCSSFiles;
    private allCSSFiles;
    constructor(configManager: ConfigurationManager);
    isEnabled(): boolean;
    scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult>;
    clean(items: CleanableItem[]): Promise<CleanResult>;
    scanWorkspace(): Promise<void>;
    private scanForUsedSelectorsAndImports;
    private scanCSSFiles;
    private analyzeCSSFile;
    private isSelectorUnused;
    private findFilesByExtensions;
    private extractSelectorsFromContent;
    private extractImportsFromContent;
    private findDuplicates;
    private findUnusedFiles;
    private resetResults;
    getResults(): CSSAnalysisResults;
}
export interface CSSAnalysisResults {
    unusedRules: CSSRule[];
    duplicates: CSSDuplicate[];
    cleanedFiles: CleanedFile[];
    unusedFiles: UnusedFile[];
    unusedVariables: CSSVariable[];
}
export interface CSSRule {
    selector: string;
    file: string;
    fullPath: string;
    line: number;
    loc: any;
}
export interface CSSVariable {
    name: string;
    file: string;
    fullPath: string;
    line: number;
    loc: any;
}
export interface UnusedFile {
    file: string;
    fullPath: string;
}
export interface CSSDuplicate {
    selector: string;
    files: {
        file: string;
        fullPath: string;
        line: number;
    }[];
}
export interface CleanedFile {
    file: string;
    removedRules: number;
}
export interface CleanResults {
    removedRules: number;
    cleanedFiles: CleanedFile[];
}
//# sourceMappingURL=CSSAnalyzer.d.ts.map