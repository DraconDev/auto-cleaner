import * as vscode from "vscode";
import {
    AnalysisResult,
    CleanableItem,
    CleanResult,
    IAnalyzer,
} from "./IAnalyzer";

/**
 * Central registry for managing all language analyzers
 */
export class AnalyzerRegistry {
    private analyzers: Map<string, IAnalyzer> = new Map();

    /**
     * Register a new analyzer
     */
    register(analyzer: IAnalyzer): void {
        this.analyzers.set(analyzer.name, analyzer);
        console.log(`Registered analyzer: ${analyzer.name}`);
    }

    /**
     * Unregister an analyzer
     */
    unregister(name: string): void {
        this.analyzers.delete(name);
    }

    /**
     * Get a specific analyzer by name
     */
    get(name: string): IAnalyzer | undefined {
        return this.analyzers.get(name);
    }

    /**
     * Get all registered analyzers
     */
    getAll(): IAnalyzer[] {
        return Array.from(this.analyzers.values());
    }

    /**
     * Get only enabled analyzers
     */
    getEnabledAnalyzers(): IAnalyzer[] {
        return this.getAll().filter((a) => a.isEnabled());
    }

    /**
     * Run all enabled analyzers
     */
    async runAll(
        workspaces: vscode.WorkspaceFolder[]
    ): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        const enabledAnalyzers = this.getEnabledAnalyzers();

        for (const workspace of workspaces) {
            for (const analyzer of enabledAnalyzers) {
                try {
                    console.log(
                        `Running ${analyzer.name} analyzer on ${workspace.name}`
                    );
                    const result = await analyzer.scan(workspace);
                    results.push(result);
                } catch (error) {
                    console.error(
                        `Error running ${analyzer.name} analyzer:`,
                        error
                    );
                    // Add empty result with error information
                    results.push({
                        analyzerName: analyzer.name,
                        language: analyzer.languages[0] || "unknown",
                        summary: {
                            totalFiles: 0,
                            totalIssues: 0,
                            breakdown: {},
                        },
                        items: [],
                    });
                }
            }
        }

        return results;
    }

    /**
     * Run analyzers for a specific language
     */
    async runForLanguage(
        language: string,
        workspaces: vscode.WorkspaceFolder[]
    ): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        const analyzers = this.getAll().filter(
            (a) => a.languages.includes(language) && a.isEnabled()
        );

        for (const workspace of workspaces) {
            for (const analyzer of analyzers) {
                try {
                    const result = await analyzer.scan(workspace);
                    results.push(result);
                } catch (error) {
                    console.error(
                        `Error running ${analyzer.name} analyzer:`,
                        error
                    );
                }
            }
        }

        return results;
    }

    /**
     * Clean items using the appropriate analyzer
     */
    async cleanWithAnalyzer(
        analyzerName: string,
        items: CleanableItem[]
    ): Promise<CleanResult> {
        const analyzer = this.get(analyzerName);
        if (!analyzer) {
            return {
                success: false,
                itemsCleaned: 0,
                errors: [
                    {
                        item: items[0],
                        error: `Analyzer ${analyzerName} not found`,
                    },
                ],
            };
        }

        return analyzer.clean(items);
    }
}
