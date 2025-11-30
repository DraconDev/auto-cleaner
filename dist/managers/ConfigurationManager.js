"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class ConfigurationManager {
    constructor() {
        this.configSection = "autoCleaner";
    }
    getConfiguration(section) {
        return vscode.workspace.getConfiguration(section || this.configSection);
    }
    // Core settings
    shouldAutoScanOnSave() {
        return this.getConfiguration().get("scanOnSave", true);
    }
    getScanInterval() {
        return this.getConfiguration().get("scanInterval", 30000);
    }
    shouldAutoClean() {
        return this.getConfiguration().get("autoClean", false);
    }
    shouldAutoCleanImports() {
        return this.getConfiguration().get("autoCleanImports", true);
    }
    shouldAutoCleanFunctions() {
        return this.getConfiguration().get("autoCleanFunctions", false);
    }
    shouldAutoCleanVariables() {
        return this.getConfiguration().get("autoCleanVariables", false);
    }
    shouldAutoCleanEmptyFiles() {
        return this.getConfiguration().get("autoCleanEmptyFiles", false);
    }
    // Analyzer settings
    getEnabledAnalyzers() {
        return this.getConfiguration().get("enabledAnalyzers", [
            "css",
            "rust",
            "go",
            "typescript",
            "javascript",
            "python",
            "filesystem",
        ]);
    }
    isAnalyzerEnabled(analyzerName) {
        return this.getConfiguration().get(`analyzers.${analyzerName}.enabled`, true);
    }
    getAnalyzerSetting(analyzerName, setting, defaultValue) {
        return this.getConfiguration().get(`analyzers.${analyzerName}.${setting}`, defaultValue);
    }
    // Gray area handling
    getGrayAreaHandling() {
        return this.getConfiguration().get("grayAreaHandling", "warn");
    }
    // Dry run
    isGitCommitEnabled() {
        return this.getConfiguration().get("createGitCommit", true);
    }
    isGitPushEnabled() {
        return this.getConfiguration().get("pushGitCommit", false);
    }
    isDryRun() {
        return this.getConfiguration().get("dryRun", true);
    }
    // Granular cleaning settings
    getFunctionCleaningSettings() {
        return this.getConfiguration().get("cleaning.functions", {
            cleanUnexported: true,
            cleanExportedButUnused: false,
            alwaysKeepExportedAndUsed: true,
        });
    }
    getVariableCleaningSettings() {
        return this.getConfiguration().get("cleaning.variables", {
            cleanUnexported: true,
            cleanExportedButUnused: false,
            alwaysKeepExportedAndUsed: true,
        });
    }
    // Target directories
    getTargetDirectories() {
        return this.getConfiguration().get("targetDirectories", []);
    }
    // Exclude patterns (files/folders to skip analysis)
    getExcludePatterns() {
        return this.getConfiguration().get("excludePatterns", [
            "**/node_modules/**",
            "**/target/**",
            "**/vendor/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
        ]);
    }
    // Whitelist - files/folders/patterns to NEVER analyze or clean
    getWhitelistPatterns() {
        return this.getConfiguration().get("whitelistPatterns", []);
    }
    getWhitelistFiles() {
        return this.getConfiguration().get("whitelistFiles", []);
    }
    getWhitelistFolders() {
        return this.getConfiguration().get("whitelistFolders", []);
    }
    /**
     * Check if a file should be whitelisted (never analyzed/cleaned)
     * @param filePath Absolute path to the file
     * @param workspaceRoot Workspace root path for relative comparison
     */
    isWhitelisted(filePath, workspaceRoot) {
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
            if (filePath.includes(folder) ||
                filePath.includes(path.sep + folder + path.sep)) {
                return true;
            }
        }
        // Check pattern whitelists using simple glob matching
        const whitelistPatterns = this.getWhitelistPatterns();
        const relativePath = workspaceRoot
            ? path.relative(workspaceRoot, filePath)
            : filePath;
        for (const pattern of whitelistPatterns) {
            if (this.matchesPattern(relativePath, pattern) ||
                this.matchesPattern(filePath, pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if a file should be excluded from analysis
     */
    isExcluded(filePath, workspaceRoot) {
        const excludePatterns = this.getExcludePatterns();
        const relativePath = workspaceRoot
            ? path.relative(workspaceRoot, filePath)
            : filePath;
        for (const pattern of excludePatterns) {
            if (this.matchesPattern(relativePath, pattern) ||
                this.matchesPattern(filePath, pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Simple glob pattern matching
     * Supports: asterisk, double-asterisk-slash, exact matches
     */
    matchesPattern(filePath, pattern) {
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
    getCSSFileTypes() {
        return this.getAnalyzerSetting("css", "fileTypes", [
            "css",
            "scss",
            "less",
        ]);
    }
    getSearchFileTypes() {
        return this.getAnalyzerSetting("css", "searchFileTypes", [
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
    shouldCheckUnusedFiles() {
        return this.getAnalyzerSetting("css", "checkUnusedFiles", true);
    }
    shouldCheckVariables() {
        return this.getAnalyzerSetting("css", "checkVariables", true);
    }
    getDuplicateStrategy() {
        return this.getAnalyzerSetting("css", "duplicateStrategy", "keepLast");
    }
    shouldKeepLastDuplicate() {
        return this.getDuplicateStrategy() === "keepLast";
    }
    getMinSelectors() {
        return this.getAnalyzerSetting("css", "minSelectors", 1);
    }
    // Legacy compatibility (deprecated - for old code)
    getIgnorePatterns() {
        return this.getExcludePatterns();
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=ConfigurationManager.js.map