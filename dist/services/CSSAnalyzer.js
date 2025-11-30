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
exports.CSSAnalyzer = void 0;
const csstree = __importStar(require("css-tree"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class CSSAnalyzer {
    constructor(configManager) {
        this.configManager = configManager;
        this.name = "css";
        this.description = "CSS Analyzer";
        this.languages = ["css"];
        this.fileExtensions = [".css"];
        this.usedSelectors = new Set();
        this.usedVariables = new Set();
        this.importedCSSFiles = new Set();
        this.allCSSFiles = new Set();
        this.results = {
            unusedRules: [],
            duplicates: [],
            cleanedFiles: [],
            unusedFiles: [],
            unusedVariables: [],
        };
    }
    isEnabled() {
        return this.configManager.getEnabledAnalyzers().includes("css");
    }
    async scan(workspace) {
        await this.scanWorkspace();
        const items = [];
        // Convert unused rules to CleanableItems
        for (const rule of this.results.unusedRules) {
            items.push({
                type: "unused-rule",
                file: rule.fullPath,
                line: rule.loc.start.line,
                column: rule.loc.start.column,
                description: `Unused CSS rule: ${rule.selector}`,
                severity: "warning",
                confidence: "high",
                category: "dead-code",
                isGrayArea: false,
                data: { selector: rule.selector, loc: rule.loc },
            });
        }
        // Convert unused variables to CleanableItems
        for (const variable of this.results.unusedVariables) {
            items.push({
                type: "unused-variable",
                file: variable.fullPath,
                line: variable.loc.start.line,
                column: variable.loc.start.column,
                description: `Unused CSS variable: ${variable.name}`,
                severity: "warning",
                confidence: "high",
                category: "dead-code",
                isGrayArea: false,
                data: { name: variable.name, loc: variable.loc },
            });
        }
        // Convert unused files to CleanableItems
        for (const file of this.results.unusedFiles) {
            items.push({
                type: "unused-file",
                file: file.fullPath,
                description: `Unused CSS file: ${file.file}`,
                severity: "warning",
                confidence: "high",
                category: "dead-code",
                isGrayArea: false,
            });
        }
        return {
            analyzerName: this.name,
            language: "css",
            summary: {
                totalFiles: this.allCSSFiles.size,
                totalIssues: items.length,
                breakdown: {
                    "unused-rule": this.results.unusedRules.length,
                    "unused-variable": this.results.unusedVariables.length,
                    "unused-file": this.results.unusedFiles.length,
                },
            },
            items,
        };
    }
    async clean(items) {
        const errors = [];
        let itemsCleaned = 0;
        // Group items by file
        const itemsByFile = new Map();
        for (const item of items) {
            if (!itemsByFile.has(item.file)) {
                itemsByFile.set(item.file, []);
            }
            itemsByFile.get(item.file).push(item);
        }
        for (const [filePath, fileItems] of itemsByFile) {
            try {
                // For file deletions, handle separately
                const fileDeletions = fileItems.filter((i) => i.type === "unused-file");
                if (fileDeletions.length > 0) {
                    const edit = new vscode.WorkspaceEdit();
                    for (const item of fileDeletions) {
                        edit.deleteFile(vscode.Uri.file(item.file), {
                            ignoreIfNotExists: true,
                        });
                    }
                    const success = await vscode.workspace.applyEdit(edit);
                    if (success) {
                        itemsCleaned += fileDeletions.length;
                    }
                    else {
                        fileDeletions.forEach((item) => errors.push({
                            item,
                            error: "Failed to delete file",
                        }));
                    }
                }
                // For content modifications
                const contentItems = fileItems.filter((i) => i.type !== "unused-file");
                if (contentItems.length > 0) {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                    const edit = new vscode.WorkspaceEdit();
                    for (const item of contentItems) {
                        if (item.data && item.data.loc) {
                            const loc = item.data.loc;
                            // css-tree loc is 1-based, vscode is 0-based
                            const range = new vscode.Range(new vscode.Position(loc.start.line - 1, loc.start.column - 1), new vscode.Position(loc.end.line - 1, loc.end.column - 1));
                            edit.delete(vscode.Uri.file(filePath), range);
                        }
                    }
                    const success = await vscode.workspace.applyEdit(edit);
                    if (success) {
                        itemsCleaned += contentItems.length;
                    }
                    else {
                        contentItems.forEach((item) => errors.push({
                            item,
                            error: "Failed to apply edits",
                        }));
                    }
                }
            }
            catch (error) {
                fileItems.forEach((item) => errors.push({
                    item,
                    error: error.message || "Unknown error",
                }));
            }
        }
        return {
            success: errors.length === 0,
            itemsCleaned,
            errors,
        };
    }
    async scanWorkspace() {
        this.resetResults();
        this.usedSelectors.clear();
        this.usedVariables.clear();
        this.importedCSSFiles.clear();
        this.allCSSFiles.clear();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }
        // First, scan for used selectors and file imports in HTML/JS files
        await this.scanForUsedSelectorsAndImports([...workspaceFolders]);
        // Then, scan CSS files for unused rules, duplicates, and variables
        await this.scanCSSFiles([...workspaceFolders]);
        // Find duplicates
        this.findDuplicates();
        // Find unused files
        if (this.configManager.shouldCheckUnusedFiles()) {
            this.findUnusedFiles();
        }
    }
    async scanForUsedSelectorsAndImports(workspaceFolders) {
        const searchFileTypes = this.configManager.getSearchFileTypes();
        for (const folder of workspaceFolders) {
            const files = await this.findFilesByExtensions(folder.uri, searchFileTypes);
            for (const file of files) {
                try {
                    const content = await fs.readFile(file.fsPath, "utf-8");
                    this.extractSelectorsFromContent(content);
                    this.extractImportsFromContent(content, file.fsPath);
                }
                catch (error) {
                    console.warn(`Error reading file ${file.fsPath}:`, error);
                }
            }
        }
    }
    async scanCSSFiles(workspaceFolders) {
        const cssFileTypes = this.configManager.getCSSFileTypes();
        for (const folder of workspaceFolders) {
            const files = await this.findFilesByExtensions(folder.uri, cssFileTypes);
            for (const file of files) {
                this.allCSSFiles.add(file.fsPath);
                await this.analyzeCSSFile(file);
            }
        }
    }
    async analyzeCSSFile(file) {
        try {
            const content = await fs.readFile(file.fsPath, "utf-8");
            const ast = csstree.parse(content, {
                filename: file.fsPath,
                positions: true,
            });
            const unusedRules = [];
            const definedVariables = [];
            csstree.walk(ast, {
                visit: "Rule",
                enter: (node) => {
                    if (node.prelude) {
                        const selector = csstree.generate(node.prelude);
                        const selectors = selector
                            .split(",")
                            .map((s) => s.trim());
                        selectors.forEach((s) => {
                            if (this.isSelectorUnused(s)) {
                                unusedRules.push({
                                    selector: s,
                                    file: path.basename(file.fsPath),
                                    fullPath: file.fsPath,
                                    line: node.loc ? node.loc.start.line : 0,
                                    loc: node.loc, // Capture full location
                                });
                            }
                        });
                    }
                },
            });
            csstree.walk(ast, {
                enter: (node) => {
                    if (node.type === "Declaration") {
                        if (node.property.startsWith("--")) {
                            definedVariables.push({
                                name: node.property,
                                file: path.basename(file.fsPath),
                                fullPath: file.fsPath,
                                line: node.loc ? node.loc.start.line : 0,
                                loc: node.loc, // Capture full location
                            });
                        }
                    }
                    if (node.type === "Function" && node.name === "var") {
                        const children = node.children;
                        if (children &&
                            children.head &&
                            children.head.data.type === "Identifier") {
                            this.usedVariables.add(children.head.data.name);
                        }
                    }
                },
            });
            this.results.unusedRules.push(...unusedRules);
            if (this.configManager.shouldCheckVariables()) {
                const unusedVars = definedVariables.filter((v) => !this.usedVariables.has(v.name));
                this.results.unusedVariables.push(...unusedVars);
            }
        }
        catch (error) {
            console.warn(`Error parsing CSS file ${file.fsPath}:`, error);
        }
    }
    isSelectorUnused(selector) {
        const cleanSelector = selector
            .replace(/:[:]?[\w-]+(\(.*\))?/g, "")
            .trim();
        if (!cleanSelector)
            return false;
        const parts = cleanSelector.split(/[\s>+~]+/);
        for (const part of parts) {
            if (part.startsWith(".")) {
                if (!this.usedSelectors.has(part))
                    return true;
            }
            else if (part.startsWith("#")) {
                if (!this.usedSelectors.has(part))
                    return true;
            }
            else {
                if (/^[a-zA-Z0-9]+$/.test(part)) {
                    if (!this.usedSelectors.has(part.toLowerCase()))
                        return true;
                }
            }
        }
        return false;
    }
    async findFilesByExtensions(uri, extensions) {
        const files = [];
        const pattern = `**/*.{${extensions.join(",")}}`;
        // Use configured exclusion patterns
        const excludePatterns = this.configManager.getExcludePatterns();
        const excludePattern = `{${excludePatterns.join(",")}}`;
        const foundFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(uri, pattern), excludePattern, 10000);
        files.push(...foundFiles);
        return files;
    }
    extractSelectorsFromContent(content) {
        const patterns = [
            /class=["']([^"']+)["']/g,
            /id=["']([^"']+)["']/g,
            /<([a-zA-Z][a-zA-Z0-9]*)/g,
            /querySelector\(['"]([^'"]+)['"]\)/g,
            /querySelectorAll\(['"]([^'"]+)['"]\)/g,
            /\$x\(['"]([^'"]+)['"]\)/g,
            /getElementsBy([A-Za-z]+)\(['"]([^'"]+)['"]\)/g,
            /className\s*=\s*['"]([^'"]+)['"]/g,
            /classList\.add\(['"]([^'"]+)['"]\)/g,
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const selectors = match[1].split(/\s+/);
                for (const selector of selectors) {
                    if (selector.trim()) {
                        if (pattern.source.includes("class") ||
                            pattern.source.includes("className") ||
                            pattern.source.includes("classList")) {
                            this.usedSelectors.add("." + selector.trim());
                        }
                        else if (pattern.source.includes("id")) {
                            this.usedSelectors.add("#" + selector.trim());
                        }
                        else if (pattern.source.includes("<")) {
                            this.usedSelectors.add(selector.trim().toLowerCase());
                        }
                        else {
                            const parts = selector.trim().split(/[\s>+~.]+/);
                            parts.forEach((p) => {
                                if (p) {
                                    if (selector.includes("." + p))
                                        this.usedSelectors.add("." + p);
                                    else if (selector.includes("#" + p))
                                        this.usedSelectors.add("#" + p);
                                    else
                                        this.usedSelectors.add(p.toLowerCase());
                                }
                            });
                            this.usedSelectors.add(selector.trim());
                        }
                    }
                }
            }
        }
    }
    extractImportsFromContent(content, filePath) {
        const patterns = [
            /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/g,
            /@import\s+["']([^"']+)["']/g,
            /import\s+["']([^"']+\.css)["']/g,
            /require\(['"]([^"']+\.css)['"]\)/g,
        ];
        const dir = path.dirname(filePath);
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const importPath = match[1];
                const absolutePath = path.resolve(dir, importPath);
                this.importedCSSFiles.add(absolutePath);
            }
        }
    }
    findDuplicates() {
        const ruleMap = new Map();
        for (const rule of this.results.unusedRules) {
            if (!ruleMap.has(rule.selector)) {
                ruleMap.set(rule.selector, {
                    selector: rule.selector,
                    files: [
                        {
                            file: rule.file,
                            fullPath: rule.fullPath,
                            line: rule.line,
                        },
                    ],
                });
            }
            else {
                const duplicate = ruleMap.get(rule.selector);
                duplicate.files.push({
                    file: rule.file,
                    fullPath: rule.fullPath,
                    line: rule.line,
                });
            }
        }
        this.results.duplicates = Array.from(ruleMap.values()).filter((d) => d.files.length > 1);
    }
    findUnusedFiles() {
        this.allCSSFiles.forEach((file) => {
            if (!this.importedCSSFiles.has(file)) {
                let isImported = false;
                for (const imported of this.importedCSSFiles) {
                    if (imported === file) {
                        isImported = true;
                        break;
                    }
                }
                if (!isImported) {
                    this.results.unusedFiles.push({
                        file: path.basename(file),
                        fullPath: file,
                    });
                }
            }
        });
    }
    resetResults() {
        this.results = {
            unusedRules: [],
            duplicates: [],
            cleanedFiles: [],
            unusedFiles: [],
            unusedVariables: [],
        };
    }
    getResults() {
        return this.results;
    }
}
exports.CSSAnalyzer = CSSAnalyzer;
//# sourceMappingURL=CSSAnalyzer.js.map