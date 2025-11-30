import * as vscode from "vscode";
export declare class ConfigurationManager {
    private readonly configSection;
    getConfiguration(section?: string): vscode.WorkspaceConfiguration;
    shouldAutoScanOnSave(): boolean;
    getScanInterval(): number;
    shouldAutoClean(): boolean;
    shouldAutoCleanImports(): boolean;
    shouldAutoCleanFunctions(): boolean;
    shouldAutoCleanVariables(): boolean;
    shouldAutoCleanEmptyFiles(): boolean;
    getEnabledAnalyzers(): string[];
    isAnalyzerEnabled(analyzerName: string): boolean;
    getAnalyzerSetting<T>(analyzerName: string, setting: string, defaultValue: T): T;
    getGrayAreaHandling(): "ignore" | "warn" | "remove";
    isGitCommitEnabled(): boolean;
    isGitPushEnabled(): boolean;
    isDryRun(): boolean;
    getTargetDirectories(): string[];
    getExcludePatterns(): string[];
    getWhitelistPatterns(): string[];
    getWhitelistFiles(): string[];
    getWhitelistFolders(): string[];
    /**
     * Check if a file should be whitelisted (never analyzed/cleaned)
     * @param filePath Absolute path to the file
     * @param workspaceRoot Workspace root path for relative comparison
     */
    isWhitelisted(filePath: string, workspaceRoot?: string): boolean;
    /**
     * Check if a file should be excluded from analysis
     */
    isExcluded(filePath: string, workspaceRoot?: string): boolean;
    /**
     * Simple glob pattern matching
     * Supports: asterisk, double-asterisk-slash, exact matches
     */
    private matchesPattern;
    getCSSFileTypes(): string[];
    getSearchFileTypes(): string[];
    shouldCheckUnusedFiles(): boolean;
    shouldCheckVariables(): boolean;
    getDuplicateStrategy(): "keepLast" | "keepFirst";
    shouldKeepLastDuplicate(): boolean;
    getMinSelectors(): number;
    getIgnorePatterns(): string[];
}
//# sourceMappingURL=ConfigurationManager.d.ts.map