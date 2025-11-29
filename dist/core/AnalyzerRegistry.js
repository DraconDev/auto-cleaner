"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzerRegistry = void 0;
/**
 * Central registry for managing all language analyzers
 */
class AnalyzerRegistry {
    constructor() {
        this.analyzers = new Map();
    }
    /**
     * Register a new analyzer
     */
    register(analyzer) {
        this.analyzers.set(analyzer.name, analyzer);
        console.log(`Registered analyzer: ${analyzer.name}`);
    }
    /**
     * Unregister an analyzer
     */
    unregister(name) {
        this.analyzers.delete(name);
    }
    /**
     * Get a specific analyzer by name
     */
    get(name) {
        return this.analyzers.get(name);
    }
    /**
     * Get all registered analyzers
     */
    getAll() {
        return Array.from(this.analyzers.values());
    }
    /**
     * Get only enabled analyzers
     */
    getEnabledAnalyzers() {
        return this.getAll().filter((a) => a.isEnabled());
    }
    /**
     * Run all enabled analyzers
     */
    async runAll(workspaces) {
        const results = [];
        const enabledAnalyzers = this.getEnabledAnalyzers();
        for (const workspace of workspaces) {
            for (const analyzer of enabledAnalyzers) {
                try {
                    console.log(`Running ${analyzer.name} analyzer on ${workspace.name}`);
                    const result = await analyzer.scan(workspace);
                    results.push(result);
                }
                catch (error) {
                    console.error(`Error running ${analyzer.name} analyzer:`, error);
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
    async runForLanguage(language, workspaces) {
        const results = [];
        const analyzers = this.getAll().filter((a) => a.languages.includes(language) && a.isEnabled());
        for (const workspace of workspaces) {
            for (const analyzer of analyzers) {
                try {
                    const result = await analyzer.scan(workspace);
                    results.push(result);
                }
                catch (error) {
                    console.error(`Error running ${analyzer.name} analyzer:`, error);
                }
            }
        }
        return results;
    }
    /**
     * Clean items using the appropriate analyzer
     */
    async cleanWithAnalyzer(analyzerName, items) {
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
exports.AnalyzerRegistry = AnalyzerRegistry;
//# sourceMappingURL=AnalyzerRegistry.js.map