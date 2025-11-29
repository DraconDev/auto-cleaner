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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const FileSystemAnalyzer_1 = require("./analyzers/FileSystemAnalyzer");
const GoAnalyzer_1 = require("./analyzers/GoAnalyzer");
const JavaScriptAnalyzer_1 = require("./analyzers/JavaScriptAnalyzer");
const PythonAnalyzer_1 = require("./analyzers/PythonAnalyzer");
const RustAnalyzer_1 = require("./analyzers/RustAnalyzer");
const TSAnalyzer_1 = require("./analyzers/TSAnalyzer");
const ConfigurationManager_1 = require("./managers/ConfigurationManager");
const GitManager_1 = require("./managers/GitManager");
const StatusBarManager_1 = require("./managers/StatusBarManager");
const AutoCleanerProvider_1 = require("./providers/AutoCleanerProvider");
const CSSAnalyzer_1 = require("./services/CSSAnalyzer");
const ReportGenerator_1 = require("./services/ReportGenerator");
const ReportPanel_1 = require("./ui/ReportPanel");
const SettingsPanel_1 = require("./ui/SettingsPanel");
const Logger_1 = require("./utils/Logger");
let autoCleanerProvider;
let statusBarManager;
let cssAnalyzer;
let rustAnalyzer;
let goAnalyzer;
let tsAnalyzer;
let jsAnalyzer;
let pyAnalyzer;
let fsAnalyzer;
let configurationManager;
let gitManager;
let reportGenerator;
let scanInterval;
let lastAnalysisResults = [];
function activate(context) {
    console.log("Auto Cleaner extension is now active");
    // Initialize managers
    Logger_1.Logger.initialize();
    configurationManager = new ConfigurationManager_1.ConfigurationManager();
    gitManager = new GitManager_1.GitManager();
    statusBarManager = new StatusBarManager_1.StatusBarManager();
    cssAnalyzer = new CSSAnalyzer_1.CSSAnalyzer(configurationManager);
    rustAnalyzer = new RustAnalyzer_1.RustAnalyzer(configurationManager);
    goAnalyzer = new GoAnalyzer_1.GoAnalyzer(configurationManager);
    tsAnalyzer = new TSAnalyzer_1.TSAnalyzer(configurationManager);
    jsAnalyzer = new JavaScriptAnalyzer_1.JavaScriptAnalyzer(configurationManager);
    pyAnalyzer = new PythonAnalyzer_1.PythonAnalyzer(configurationManager);
    fsAnalyzer = new FileSystemAnalyzer_1.FileSystemAnalyzer(configurationManager);
    autoCleanerProvider = new AutoCleanerProvider_1.AutoCleanerProvider(cssAnalyzer);
    reportGenerator = new ReportGenerator_1.ReportGenerator();
    // Register tree data provider
    vscode.window.registerTreeDataProvider("autoCleaner", autoCleanerProvider);
    // Register commands
    const openSettingsCommand = vscode.commands.registerCommand("autoCleaner.openSettings", () => {
        SettingsPanel_1.SettingsPanel.createOrShow(context.extensionUri, configurationManager);
    });
    const scanCommand = vscode.commands.registerCommand("autoCleaner.scan", async () => {
        await performScan();
    });
    const showDebugLogsCommand = vscode.commands.registerCommand("autoCleaner.showDebugLogs", async () => {
        Logger_1.Logger.show();
        Logger_1.Logger.log("=== Debug Info ===");
        Logger_1.Logger.log(`Workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "None"}`);
        Logger_1.Logger.log(`Enabled analyzers: ${configurationManager
            .getEnabledAnalyzers()
            .join(", ")}`);
        Logger_1.Logger.log(`Rust enabled: ${configurationManager.isAnalyzerEnabled("rust")}`);
        Logger_1.Logger.log(`Git commit enabled: ${configurationManager.isGitCommitEnabled()}`);
        Logger_1.Logger.log("=== Running scan ===");
        await performScan();
        vscode.window.showInformationMessage("Auto Cleaner: Check Output panel for debug logs");
    });
    const cleanCommand = vscode.commands.registerCommand("autoCleaner.clean", async () => {
        await performClean();
    });
    const showMenuCommand = vscode.commands.registerCommand("autoCleaner.showMenu", async () => {
        const items = [
            {
                label: "$(gear) Settings",
                description: "Configure analyzers and whitelists",
                command: "autoCleaner.openSettings",
            },
            {
                label: "$(search) Scan",
                description: "Scan for unused code",
                command: "autoCleaner.scan",
            },
            {
                label: "$(trash) Clean Unused Rules",
                description: "Remove unused CSS rules",
                command: "autoCleaner.clean",
            },
            {
                label: "$(file-code) Clean Unused Variables",
                description: "Remove unused CSS variables",
                command: "autoCleaner.cleanVariables",
            },
            {
                label: "$(file-media) Clean Unused Files",
                description: "Delete unused CSS files",
                command: "autoCleaner.cleanUnusedFiles",
            },
            {
                label: "$(file-text) Report",
                description: "Generate interactive report",
                command: "autoCleaner.generateReport",
            },
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: "Auto Cleaner Actions",
        });
        if (selection) {
            vscode.commands.executeCommand(selection.command);
        }
    });
    const showStatusCommand = vscode.commands.registerCommand("autoCleaner.showStatus", () => {
        vscode.commands.executeCommand("autoCleaner.showMenu");
    });
    const generateReportCommand = vscode.commands.registerCommand("autoCleaner.generateReport", async () => {
        await performScan();
        ReportPanel_1.ReportPanel.createOrShow(context.extensionUri, lastAnalysisResults, {
            cssAnalyzer,
            rustAnalyzer,
            goAnalyzer,
            tsAnalyzer,
            jsAnalyzer,
            pyAnalyzer,
            fsAnalyzer,
        });
    });
    const cleanUnusedFilesCommand = vscode.commands.registerCommand("autoCleaner.cleanUnusedFiles", async () => {
        await performCleanUnusedFiles();
    });
    const cleanVariablesCommand = vscode.commands.registerCommand("autoCleaner.cleanVariables", async () => {
        await performCleanVariables();
    });
    context.subscriptions.push(statusBarManager, openSettingsCommand, showMenuCommand, showDebugLogsCommand, scanCommand, cleanCommand, showStatusCommand, generateReportCommand, cleanUnusedFilesCommand, cleanVariablesCommand);
    // Auto-scan on startup if enabled
    if (configurationManager.shouldAutoScanOnSave()) {
        setTimeout(() => performScan(), 2000);
    }
    // Set up periodic scanning
    setupPeriodicScanning();
    // Auto-scan on file save if enabled
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (configurationManager.shouldAutoScanOnSave() &&
            isCSSFile(document.fileName)) {
            await performScan();
            await performAutoClean();
        }
    }));
    console.log("Auto Cleaner extension setup complete");
}
exports.activate = activate;
async function createBackupCommit() {
    if (!configurationManager.isGitCommitEnabled()) {
        return true; // Skip if disabled
    }
    const workspaces = vscode.workspace.workspaceFolders;
    if (!workspaces || workspaces.length === 0) {
        return true;
    }
    const cwd = workspaces[0].uri.fsPath;
    const isGitRepo = await gitManager.isGitRepository(cwd);
    if (!isGitRepo) {
        Logger_1.Logger.log("[Extension] Not a git repository, skipping backup commit.");
        return true;
    }
    const hasChanges = await gitManager.hasUnstagedChanges(cwd);
    if (!hasChanges) {
        Logger_1.Logger.log("[Extension] No unstaged changes, skipping backup commit.");
        return true;
    }
    const timestamp = new Date().toISOString();
    const commitMessage = `[Auto Cleaner Backup] Before cleaning - ${timestamp}`;
    return await gitManager.commitChanges(cwd, commitMessage);
}
function deactivate() {
    if (scanInterval) {
        clearInterval(scanInterval);
    }
    console.log("Auto Cleaner extension is now deactivated");
}
exports.deactivate = deactivate;
async function performScan() {
    try {
        statusBarManager.updateStatus("Scanning...", "$(search)");
        const scanPromises = [];
        // CSS
        if (vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0) {
            scanPromises.push(cssAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
        }
        if (configurationManager.isAnalyzerEnabled("rust")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(rustAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        if (configurationManager.isAnalyzerEnabled("go")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(goAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        if (configurationManager.isAnalyzerEnabled("typescript")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(tsAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        if (configurationManager.isAnalyzerEnabled("javascript")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(jsAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        if (configurationManager.isAnalyzerEnabled("python")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(pyAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        if (configurationManager.isAnalyzerEnabled("filesystem")) {
            if (vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0) {
                scanPromises.push(fsAnalyzer.scan(vscode.workspace.workspaceFolders[0]));
            }
        }
        // Wait for all scans
        lastAnalysisResults = await Promise.all(scanPromises);
        // Update provider with CSS results (legacy support for tree view if needed)
        // Or better, update provider to support generic results if possible.
        // For now, we keep using getResults for the provider if it expects specific CSS structure.
        // But since we just ran scan(), getResults() should be up to date.
        const cssResults = cssAnalyzer.getResults();
        autoCleanerProvider.refresh(cssResults);
        // Calculate total unused items
        let totalUnused = 0;
        lastAnalysisResults.forEach((r) => {
            totalUnused += r.summary.totalIssues;
        });
        statusBarManager.showUnusedCount(totalUnused);
    }
    catch (error) {
        console.error("Error during scan:", error);
        statusBarManager.updateStatus("Scan Error", "$(error)");
        vscode.window.showErrorMessage("Auto Cleaner: Error during scan - check output panel for details");
    }
}
async function performClean() {
    try {
        const config = vscode.workspace.getConfiguration("autoCleaner");
        const autoClean = config.get("autoClean", false);
        if (!autoClean) {
            const action = await vscode.window.showWarningMessage("This will remove unused CSS rules. This action cannot be undone via this command (use Ctrl+Z after).", { modal: true }, "Remove", "Cancel");
            if (action !== "Remove") {
                return;
            }
        }
        statusBarManager.updateStatus("Cleaning...", "$(trash)");
        await performScan();
        const cssResult = lastAnalysisResults.find((r) => r.analyzerName === "css");
        if (!cssResult) {
            vscode.window.showInformationMessage("Auto Cleaner: No CSS issues found");
            statusBarManager.updateStatus("Ready", "$(check)");
            return;
        }
        const cleanableItems = cssResult.items.filter((i) => i.type === "unused-rule");
        if (cleanableItems.length === 0) {
            vscode.window.showInformationMessage("Auto Cleaner: No unused CSS rules found");
            statusBarManager.updateStatus("Ready", "$(check)");
            return;
        }
        const cleanResult = await cssAnalyzer.clean(cleanableItems);
        // Refresh
        await performScan();
        statusBarManager.updateStatus(`Cleaned ${cleanResult.itemsCleaned} rules`, "$(check)");
        vscode.window.showInformationMessage(`Auto Cleaner: Successfully removed ${cleanResult.itemsCleaned} unused rules`);
    }
    catch (error) {
        console.error("Error during CSS clean:", error);
        statusBarManager.updateStatus("Clean Error", "$(error)");
        vscode.window.showErrorMessage("Auto Cleaner: Error during cleaning - check output panel for details");
    }
}
function setupPeriodicScanning() {
    const config = vscode.workspace.getConfiguration("autoCleaner");
    const interval = config.get("scanInterval", 30000);
    if (scanInterval) {
        clearInterval(scanInterval);
    }
    if (interval > 0) {
        scanInterval = setInterval(async () => {
            if (vscode.window.state.focused) {
                await performScan();
            }
        }, interval);
    }
}
function isCSSFile(fileName) {
    const cssExtensions = [".css", ".scss", ".less"];
    return cssExtensions.some((ext) => fileName.endsWith(ext));
}
async function performCleanUnusedFiles() {
    try {
        // Create backup commit before cleaning
        const commitSuccess = await createBackupCommit();
        if (!commitSuccess) {
            vscode.window.showWarningMessage("Auto Cleaner: Failed to create backup commit. Proceeding anyway...");
        }
        await performScan();
        const cssResult = lastAnalysisResults.find((r) => r.analyzerName === "css");
        if (!cssResult) {
            vscode.window.showInformationMessage("Auto Cleaner: No CSS issues found");
            return;
        }
        const unusedFiles = cssResult.items.filter((i) => i.type === "unused-file");
        if (unusedFiles.length === 0) {
            vscode.window.showInformationMessage("Auto Cleaner: No unused CSS files found");
            return;
        }
        const action = await vscode.window.showWarningMessage(`Found ${unusedFiles.length} unused CSS files. Delete them?`, { modal: true }, "Delete", "Cancel");
        if (action !== "Delete") {
            return;
        }
        statusBarManager.updateStatus("Deleting unused files...", "$(trash)");
        const cleanResult = await cssAnalyzer.clean(unusedFiles);
        // Refresh
        await performScan();
        if (cleanResult.success) {
            statusBarManager.updateStatus(`Deleted ${cleanResult.itemsCleaned} files`, "$(check)");
            vscode.window.showInformationMessage(`Auto Cleaner: Successfully deleted ${cleanResult.itemsCleaned} unused files`);
        }
        else {
            throw new Error("Failed to delete some files");
        }
    }
    catch (error) {
        console.error("Error cleaning unused files:", error);
        statusBarManager.updateStatus("Clean Error", "$(error)");
        vscode.window.showErrorMessage("Auto Cleaner: Error deleting files - check output panel for details");
    }
}
async function performCleanVariables() {
    try {
        // Create backup commit before cleaning
        const commitSuccess = await createBackupCommit();
        if (!commitSuccess) {
            vscode.window.showWarningMessage("Auto Cleaner: Failed to create backup commit. Proceeding anyway...");
        }
        await performScan();
        const cssResult = lastAnalysisResults.find((r) => r.analyzerName === "css");
        if (!cssResult) {
            vscode.window.showInformationMessage("Auto Cleaner: No CSS issues found");
            return;
        }
        const unusedVars = cssResult.items.filter((i) => i.type === "unused-variable");
        if (unusedVars.length === 0) {
            vscode.window.showInformationMessage("Auto Cleaner: No unused CSS variables found");
            return;
        }
        const action = await vscode.window.showWarningMessage(`Found ${unusedVars.length} unused CSS variables. Remove them?`, { modal: true }, "Remove", "Cancel");
        if (action !== "Remove") {
            return;
        }
        statusBarManager.updateStatus("Removing unused variables...", "$(trash)");
        const cleanResult = await cssAnalyzer.clean(unusedVars);
        // Refresh
        await performScan();
        statusBarManager.updateStatus(`Removed ${cleanResult.itemsCleaned} variables`, "$(check)");
        vscode.window.showInformationMessage(`Auto Cleaner: Successfully removed ${cleanResult.itemsCleaned} unused variables`);
    }
    catch (error) {
        console.error("Error cleaning variables:", error);
        statusBarManager.updateStatus("Clean Error", "$(error)");
        vscode.window.showErrorMessage("Auto Cleaner: Error removing variables - check output panel for details");
    }
}
async function performAutoClean() {
    // 1. Master Auto-Clean (Legacy/CSS)
    if (configurationManager.shouldAutoClean()) {
        await performClean();
    }
    // 2. Granular Auto-Clean (Rust/Go/TS/JS/Py/FS)
    // We can iterate over lastAnalysisResults and clean based on config
    // But we need to be careful not to double clean if performClean already ran for CSS
    // For now, let's keep the explicit checks but use the unified results
    for (const result of lastAnalysisResults) {
        if (result.analyzerName === "css")
            continue; // Handled above
        const analyzerName = result.analyzerName;
        // Check if auto-clean is enabled for this analyzer (conceptually)
        // Currently config is granular per type (imports, variables) not per analyzer
        let itemsToClean = [];
        if (configurationManager.shouldAutoCleanImports()) {
            itemsToClean.push(...result.items.filter((i) => i.type === "unused-import"));
        }
        if (configurationManager.shouldAutoCleanVariables()) {
            itemsToClean.push(...result.items.filter((i) => i.type === "unused-variable"));
        }
        if (analyzerName === "filesystem" &&
            configurationManager.shouldAutoCleanEmptyFiles()) {
            itemsToClean.push(...result.items.filter((i) => i.type === "empty-file" || i.type === "empty-directory"));
        }
        if (itemsToClean.length > 0) {
            // We need to get the analyzer instance
            let analyzer;
            switch (analyzerName) {
                case "rust":
                    analyzer = rustAnalyzer;
                    break;
                case "go":
                    analyzer = goAnalyzer;
                    break;
                case "typescript":
                    analyzer = tsAnalyzer;
                    break;
                case "javascript":
                    analyzer = jsAnalyzer;
                    break;
                case "python":
                    analyzer = pyAnalyzer;
                    break;
                case "filesystem":
                    analyzer = fsAnalyzer;
                    break;
            }
            if (analyzer) {
                await analyzer.clean(itemsToClean);
                statusBarManager.updateStatus(`Auto-cleaned ${itemsToClean.length} ${analyzerName} items`, "$(check)");
            }
        }
    }
}
//# sourceMappingURL=extension.js.map