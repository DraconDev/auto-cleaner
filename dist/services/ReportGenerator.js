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
exports.ReportGenerator = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class ReportGenerator {
    generateReport(cssResults, otherResults = []) {
        let report = "# Auto Cleaner Report\n\n";
        report += `Generated on: ${new Date().toLocaleString()}\n\n`;
        // 1. Summary
        report += "## Summary\n\n";
        // CSS Summary
        const cssIssues = cssResults.unusedRules.length +
            cssResults.unusedFiles.length +
            cssResults.unusedVariables.length +
            cssResults.duplicates.length;
        report += `### CSS Analyzer\n`;
        report += `- **Total Issues**: ${cssIssues}\n`;
        report += `- **Unused Rules**: ${cssResults.unusedRules.length}\n`;
        report += `- **Unused Files**: ${cssResults.unusedFiles.length}\n`;
        report += `- **Unused Variables**: ${cssResults.unusedVariables.length}\n`;
        report += `- **Duplicates**: ${cssResults.duplicates.length}\n\n`;
        // Other Analyzers Summary
        otherResults.forEach((result) => {
            report += `### ${result.analyzerName} Analyzer\n`;
            report += `- **Total Issues**: ${result.summary.totalIssues}\n`;
            Object.entries(result.summary.breakdown).forEach(([key, value]) => {
                report += `- **${key}**: ${value}\n`;
            });
            report += "\n";
        });
        report += "---\n\n";
        // 2. Detailed Results
        // CSS Details
        if (cssIssues > 0) {
            report += "## CSS Issues\n\n";
            this.appendCSSDetails(report, cssResults);
        }
        // Other Analyzers Details
        otherResults.forEach((result) => {
            if (result.items.length > 0) {
                report += `## ${result.analyzerName} Issues\n\n`;
                // Group by file
                const itemsByFile = new Map();
                result.items.forEach((item) => {
                    if (!itemsByFile.has(item.file)) {
                        itemsByFile.set(item.file, []);
                    }
                    itemsByFile.get(item.file).push(item);
                });
                itemsByFile.forEach((items, file) => {
                    report += `### [${path.basename(file)}](${file})\n`;
                    items.forEach((item) => {
                        report += `- **${item.type}**: ${item.description}`;
                        if (item.line) {
                            report += ` at line ${item.line}`;
                        }
                        report += `\n`;
                    });
                    report += "\n";
                });
            }
        });
        return report;
    }
    appendCSSDetails(report, results) {
        let content = "";
        // Unused Files
        if (results.unusedFiles.length > 0) {
            content += "### Unused Files\n\n";
            results.unusedFiles.forEach((file) => {
                content += `- [${file.file}](${file.fullPath})\n`;
            });
            content += "\n";
        }
        // Unused Variables
        if (results.unusedVariables.length > 0) {
            content += "### Unused Variables\n\n";
            results.unusedVariables.forEach((variable) => {
                content += `- \`${variable.name}\` in [${variable.file}:${variable.line}](${variable.fullPath}#L${variable.line})\n`;
            });
            content += "\n";
        }
        // Duplicates
        if (results.duplicates.length > 0) {
            content += "### Duplicate Rules\n\n";
            results.duplicates.forEach((dup) => {
                content += `#### \`${dup.selector}\`\n`;
                dup.files.forEach((f) => {
                    content += `- [${f.file}:${f.line}](${f.fullPath}#L${f.line})\n`;
                });
                content += "\n";
            });
        }
        // Unused Rules
        if (results.unusedRules.length > 0) {
            content += "### Unused Rules\n\n";
            const rulesByFile = new Map();
            results.unusedRules.forEach((rule) => {
                if (!rulesByFile.has(rule.fullPath)) {
                    rulesByFile.set(rule.fullPath, []);
                }
                rulesByFile.get(rule.fullPath).push(rule);
            });
            rulesByFile.forEach((rules, fullPath) => {
                const fileName = path.basename(fullPath);
                content += `#### [${fileName}](${fullPath})\n`;
                rules.forEach((rule) => {
                    content += `- \`${rule.selector}\` at line ${rule.line}\n`;
                });
                content += "\n";
            });
        }
        return report + content;
    }
    async showReport(cssResults, otherResults = []) {
        const reportContent = this.generateReport(cssResults, otherResults);
        const doc = await vscode.workspace.openTextDocument({
            content: reportContent,
            language: "markdown",
        });
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true,
        });
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=ReportGenerator.js.map