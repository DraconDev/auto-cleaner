import * as path from "path";
import * as vscode from "vscode";

export class ConfigurationManager {
    private readonly configSection = "autoCleaner";

    getConfiguration(section?: string): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(section || this.configSection);
    }

    // Core settings
    shouldAutoScanOnSave(): boolean {
        return this.getConfiguration().get<boolean>("scanOnSave", true);
    }

    getScanInterval(): number {
        return this.getConfiguration().get<number>("scanInterval", 30000);
    }

    shouldAutoClean(): boolean {
        return this.getConfiguration().get<boolean>("autoClean", false);
    }

    shouldAutoCleanImports(): boolean {
        return this.getConfiguration().get<boolean>("autoCleanImports", true);
    }

    shouldAutoCleanFunctions(): boolean {
        return this.getConfiguration().get<boolean>(
            "autoCleanFunctions",
            false
        );
    }

    shouldAutoCleanVariables(): boolean {
        return this.getConfiguration().get<boolean>(
            "autoCleanVariables",
            false
        );
    }

    shouldAutoCleanEmptyFiles(): boolean {
        return this.getConfiguration().get<boolean>(
            "autoCleanEmptyFiles",
            false
        );
    }

    // Analyzer settings
    getEnabledAnalyzers(): string[] {
        return this.getConfiguration().get<string[]>("enabledAnalyzers", [
            "css",
            "rust",
            "go",
            "typescript",
            "javascript",
            "python",
            "filesystem",
        ]);
    }

    isAnalyzerEnabled(analyzerName: string): boolean {
        return this.getConfiguration().get<boolean>(
            `analyzers.${analyzerName}.enabled`,
            true
        );
    }

    getAnalyzerSetting<T>(
        analyzerName: string,
        setting: string,
        defaultValue: T
    ): T {
        return this.getConfiguration().get<T>(
            `analyzers.${analyzerName}.${setting}`,
            defaultValue
        );
    }

    // Gray area handling
    getGrayAreaHandling(): "ignore" | "warn" | "remove" {
        return this.getConfiguration().get<"ignore" | "warn" | "remove">(
            "grayAreaHandling",
            "warn"
        );
    }

    // Dry run
    isGitCommitEnabled(): boolean {
        return this.getConfiguration().get<boolean>("createGitCommit", true);
    }

    isGitPushEnabled(): boolean {
        return this.getConfiguration().get<boolean>("pushGitCommit", false);
    }

    isDryRun(): boolean {
        return this.getConfiguration().get<boolean>("dryRun", true);
    }

    // Granular cleaning settings
    getFunctionCleaningSettings(): {
        cleanUnexported: boolean;
        cleanExportedButUnused: boolean;
        alwaysKeepExportedAndUsed: boolean;
    } {
        return this.getConfiguration().get("cleaning.functions", {
            cleanUnexported: true,
            cleanExportedButUnused: false,
            alwaysKeepExportedAndUsed: true,
        });
    }

    getVariableCleaningSettings(): {
        cleanUnexported: boolean;
        cleanExportedButUnused: boolean;
        alwaysKeepExportedAndUsed: boolean;
    } {
        return this.getConfiguration().get("cleaning.variables", {
            cleanUnexported: true,
            cleanExportedButUnused: false,
            alwaysKeepExportedAndUsed: true,
        });
    }

    // Target directories
    getTargetDirectories(): string[] {
        return this.getConfiguration().get<string[]>("targetDirectories", []);
    }

    // Exclude patterns (files/folders to skip analysis)
    getExcludePatterns(): string[] {
        return this.getConfiguration().get<string[]>("excludePatterns", [
            "**/node_modules/**",
            "**/target/**",
            "**/vendor/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
        ]);
    }

    // Whitelist - files/folders/patterns to NEVER analyze or clean
    getWhitelistPatterns(): string[] {
        return this.getConfiguration().get<string[]>("whitelistPatterns", []);
    }

    getWhitelistFiles(): string[] {
        return this.getConfiguration().get<string[]>("whitelistFiles", []);
    }

    getWhitelistFolders(): string[] {
        return this.getConfiguration().get<string[]>("whitelistFolders", []);
    }

    /**
     * Check if a file should be whitelisted (never analyzed/cleaned)
     * @param filePath Absolute path to the file
     * @param workspaceRoot Workspace root path for relative comparison
     */
    isWhitelisted(filePath: string, workspaceRoot?: string): boolean {
        // Check exact file matches
        const whitelistFiles = this.getWhitelistFiles();
        const fileName = path.basename(filePath);

        // Check if filename matches (e.g., "global.css")
        if (whitelistFiles.includes(fileName)) {
            return true;
        }

        // Check if full path matches
        if (whitelistFiles.includes(filePath)) {
            return true;
        }

        // Check folder whitelists
        const whitelistFolders = this.getWhitelistFolders();
        for (const folder of whitelistFolders) {
            if (
                filePath.includes(folder) ||
                filePath.includes(path.sep + folder + path.sep)
            ) {
                return true;
            }
        }

        // Check pattern whitelists using simple glob matching
        const whitelistPatterns = this.getWhitelistPatterns();
        const relativePath = workspaceRoot
            ? path.relative(workspaceRoot, filePath)
            : filePath;

        for (const pattern of whitelistPatterns) {
            if (
                this.matchesPattern(relativePath, pattern) ||
                this.matchesPattern(filePath, pattern)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a file should be excluded from analysis
     */
    isExcluded(filePath: string, workspaceRoot?: string): boolean {
        const excludePatterns = this.getExcludePatterns();
        const relativePath = workspaceRoot
            ? path.relative(workspaceRoot, filePath)
            : filePath;

        for (const pattern of excludePatterns) {
            if (
                this.matchesPattern(relativePath, pattern) ||
                this.matchesPattern(filePath, pattern)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching
     * Supports: asterisk, double-asterisk-slash, exact matches
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Normalize paths to forward slashes for consistent matching
        const normalizedPath = filePath.replace(/\\/g, "/");
        const normalizedPattern = pattern.replace(/\\/g, "/");

        // Exact match
        if (normalizedPath === normalizedPattern) {
            return true;
        }

        // Convert glob pattern to regex
        // Must handle ** before * to avoid incorrect replacements
        const regexPattern = normalizedPattern
            .replace(/\./g, "\\.") // Escape dots
            .replace(/\*\*/g, "<<<DOUBLESTAR>>>") // Temporarily replace **
            .replace(/\*/g, "[^/]*") // * matches anything except path separators
            .replace(/<<<DOUBLESTAR>>>/g, ".*"); // ** matches any characters including /

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(normalizedPath);
    }

    // CSS-specific settings (now under analyzers.css)
    getCSSFileTypes(): string[] {
        return this.getAnalyzerSetting<string[]>("css", "fileTypes", [
            "css",
            "scss",
            "less",
        ]);
    }

    getSearchFileTypes(): string[] {
        return this.getAnalyzerSetting<string[]>("css", "searchFileTypes", [
            "html",
            "htm",
            "php",
            "js",
            "ts",
            "jsx",
            "tsx",
            "vue",
        ]);
    }

    shouldCheckUnusedFiles(): boolean {
        return this.getAnalyzerSetting<boolean>(
            "css",
            "checkUnusedFiles",
            true
        );
    }

    shouldCheckVariables(): boolean {
        return this.getAnalyzerSetting<boolean>("css", "checkVariables", true);
    }

    getDuplicateStrategy(): "keepLast" | "keepFirst" {
        return this.getAnalyzerSetting<"keepLast" | "keepFirst">(
            "css",
            "duplicateStrategy",
            "keepLast"
        );
    }

    shouldKeepLastDuplicate(): boolean {
        return this.getDuplicateStrategy() === "keepLast";
    }

    getMinSelectors(): number {
        return this.getAnalyzerSetting<number>("css", "minSelectors", 1);
    }

    // Legacy compatibility (deprecated - for old code)
    getIgnorePatterns(): string[] {
        return this.getExcludePatterns();
    }
}
