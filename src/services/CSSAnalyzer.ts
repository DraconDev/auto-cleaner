import * as csstree from "css-tree";
import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "../core/IAnalyzer";
import { ConfigurationManager } from "../managers/ConfigurationManager";

export class CSSAnalyzer implements IAnalyzer {
    name = "css";
    description = "CSS Analyzer";
    languages = ["css"];
    fileExtensions = [".css"];

    private results: CSSAnalysisResults;
    private usedSelectors: Set<string> = new Set();
    private usedVariables: Set<string> = new Set();
    private importedCSSFiles: Set<string> = new Set();
    private allCSSFiles: Set<string> = new Set();

    constructor(private configManager: ConfigurationManager) {
        this.results = {
            unusedRules: [],
            duplicates: [],
            cleanedFiles: [],
            unusedFiles: [],
            unusedVariables: [],
        };
    }

    isEnabled(): boolean {
        return this.configManager.getEnabledAnalyzers().includes("css");
    }

    async scan(workspace: vscode.WorkspaceFolder): Promise<AnalysisResult> {
        await this.scanWorkspace();

        const items: CleanableItem[] = [];

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

    async clean(items: CleanableItem[]): Promise<CleanResult> {
        const errors: Array<{ item: CleanableItem; error: string }> = [];
        let itemsCleaned = 0;

        // Group items by file
        const itemsByFile = new Map<string, CleanableItem[]>();
        for (const item of items) {
            if (!itemsByFile.has(item.file)) {
                itemsByFile.set(item.file, []);
            }
            itemsByFile.get(item.file)!.push(item);
        }

        for (const [filePath, fileItems] of itemsByFile) {
            try {
                // For file deletions, handle separately
                const fileDeletions = fileItems.filter(
                    (i) => i.type === "unused-file"
                );
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
                    } else {
                        fileDeletions.forEach((item) =>
                            errors.push({
                                item,
                                error: "Failed to delete file",
                            })
                        );
                    }
                }

                // For content modifications
                const contentItems = fileItems.filter(
                    (i) => i.type !== "unused-file"
                );
                if (contentItems.length > 0) {
                    const document = await vscode.workspace.openTextDocument(
                        vscode.Uri.file(filePath)
                    );
                    const edit = new vscode.WorkspaceEdit();

                    for (const item of contentItems) {
                        if (item.data && item.data.loc) {
                            const loc = item.data.loc;
                            // css-tree loc is 1-based, vscode is 0-based
                            const range = new vscode.Range(
                                new vscode.Position(
                                    loc.start.line - 1,
                                    loc.start.column - 1
                                ),
                                new vscode.Position(
                                    loc.end.line - 1,
                                    loc.end.column - 1
                                )
                            );
                            edit.delete(vscode.Uri.file(filePath), range);
                        }
                    }

                    const success = await vscode.workspace.applyEdit(edit);
                    if (success) {
                        itemsCleaned += contentItems.length;
                    } else {
                        contentItems.forEach((item) =>
                            errors.push({
                                item,
                                error: "Failed to apply edits",
                            })
                        );
                    }
                }
            } catch (error: any) {
                fileItems.forEach((item) =>
                    errors.push({
                        item,
                        error: error.message || "Unknown error",
                    })
                );
            }
        }

        return {
            success: errors.length === 0,
            itemsCleaned,
            errors,
        };
    }

    async scanWorkspace(): Promise<void> {
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

    private async scanForUsedSelectorsAndImports(
        workspaceFolders: vscode.WorkspaceFolder[]
    ): Promise<void> {
        const searchFileTypes = this.configManager.getSearchFileTypes();

        for (const folder of workspaceFolders) {
            const files = await this.findFilesByExtensions(
                folder.uri,
                searchFileTypes
            );

            for (const file of files) {
                try {
                    const content = await fs.readFile(file.fsPath, "utf-8");
                    this.extractSelectorsFromContent(content);
                    this.extractImportsFromContent(content, file.fsPath);
                } catch (error) {
                    console.warn(`Error reading file ${file.fsPath}:`, error);
                }
            }
        }
    }

    private async scanCSSFiles(
        workspaceFolders: vscode.WorkspaceFolder[]
    ): Promise<void> {
        const cssFileTypes = this.configManager.getCSSFileTypes();

        for (const folder of workspaceFolders) {
            const files = await this.findFilesByExtensions(
                folder.uri,
                cssFileTypes
            );

            for (const file of files) {
                this.allCSSFiles.add(file.fsPath);
                await this.analyzeCSSFile(file);
            }
        }
    }

    private async analyzeCSSFile(file: vscode.Uri): Promise<void> {
        try {
            const content = await fs.readFile(file.fsPath, "utf-8");
            const ast = csstree.parse(content, {
                filename: file.fsPath,
                positions: true,
            });

            const unusedRules: CSSRule[] = [];
            const definedVariables: CSSVariable[] = [];

            csstree.walk(ast, {
                visit: "Rule",
                enter: (node: any) => {
                    if (node.prelude) {
                        const selector = csstree.generate(node.prelude);
                        const selectors = selector
                            .split(",")
                            .map((s: string) => s.trim());

                        selectors.forEach((s: string) => {
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
                enter: (node: any) => {
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
                        if (
                            children &&
                            children.head &&
                            children.head.data.type === "Identifier"
                        ) {
                            this.usedVariables.add(children.head.data.name);
                        }
                    }
                },
            });

            this.results.unusedRules.push(...unusedRules);

            if (this.configManager.shouldCheckVariables()) {
                const unusedVars = definedVariables.filter(
                    (v) => !this.usedVariables.has(v.name)
                );
                this.results.unusedVariables.push(...unusedVars);
            }
        } catch (error) {
            console.warn(`Error parsing CSS file ${file.fsPath}:`, error);
        }
    }

    private isSelectorUnused(selector: string): boolean {
        const cleanSelector = selector
            .replace(/:[:]?[\w-]+(\(.*\))?/g, "")
            .trim();
        if (!cleanSelector) return false;

        const parts = cleanSelector.split(/[\s>+~]+/);

        for (const part of parts) {
            if (part.startsWith(".")) {
                if (!this.usedSelectors.has(part)) return true;
            } else if (part.startsWith("#")) {
                if (!this.usedSelectors.has(part)) return true;
            } else {
                if (/^[a-zA-Z0-9]+$/.test(part)) {
                    if (!this.usedSelectors.has(part.toLowerCase()))
                        return true;
                }
            }
        }

        return false;
    }

    private async findFilesByExtensions(
        uri: vscode.Uri,
        extensions: string[]
    ): Promise<vscode.Uri[]> {
        const files: vscode.Uri[] = [];
        const pattern = `**/*.{${extensions.join(",")}}`;

        // Use configured exclusion patterns
        const excludePatterns = this.configManager.getExcludePatterns();
        const excludePattern = `{${excludePatterns.join(",")}}`;

        const foundFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(uri, pattern),
            excludePattern,
            10000
        );

        files.push(...foundFiles);
        return files;
    }

    private extractSelectorsFromContent(content: string): void {
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
                        if (
                            pattern.source.includes("class") ||
                            pattern.source.includes("className") ||
                            pattern.source.includes("classList")
                        ) {
                            this.usedSelectors.add("." + selector.trim());
                        } else if (pattern.source.includes("id")) {
                            this.usedSelectors.add("#" + selector.trim());
                        } else if (pattern.source.includes("<")) {
                            this.usedSelectors.add(
                                selector.trim().toLowerCase()
                            );
                        } else {
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

    private extractImportsFromContent(content: string, filePath: string): void {
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

    private findDuplicates(): void {
        const ruleMap = new Map<string, CSSDuplicate>();

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
            } else {
                const duplicate = ruleMap.get(rule.selector)!;
                duplicate.files.push({
                    file: rule.file,
                    fullPath: rule.fullPath,
                    line: rule.line,
                });
            }
        }

        this.results.duplicates = Array.from(ruleMap.values()).filter(
            (d) => d.files.length > 1
        );
    }

    private findUnusedFiles(): void {
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

    private resetResults(): void {
        this.results = {
            unusedRules: [],
            duplicates: [],
            cleanedFiles: [],
            unusedFiles: [],
            unusedVariables: [],
        };
    }

    getResults(): CSSAnalysisResults {
        return this.results;
    }
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
    loc: any; // css-tree location
}

export interface CSSVariable {
    name: string;
    file: string;
    fullPath: string;
    line: number;
    loc: any; // css-tree location
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
