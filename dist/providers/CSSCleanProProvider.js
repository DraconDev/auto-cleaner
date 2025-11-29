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
exports.CSSCleanProProvider = void 0;
const vscode = __importStar(require("vscode"));
class CSSCleanProProvider {
    constructor(cssAnalyzer) {
        this.cssAnalyzer = cssAnalyzer;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh(results) {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve(this.getChildrenForItem(element));
        }
        else {
            const results = this.cssAnalyzer.getResults();
            return Promise.resolve(this.getRootItems(results));
        }
    }
    getRootItems(results) {
        const items = [];
        if (results.unusedRules && results.unusedRules.length > 0) {
            items.push(new TreeItem(`Unused CSS Rules (${results.unusedRules.length})`, vscode.TreeItemCollapsibleState.Expanded, "unused-rules"));
        }
        if (results.duplicates && results.duplicates.length > 0) {
            items.push(new TreeItem(`Duplicate Rules (${results.duplicates.length})`, vscode.TreeItemCollapsibleState.Expanded, "duplicate-rules"));
        }
        if (results.cleanedFiles && results.cleanedFiles.length > 0) {
            items.push(new TreeItem(`Cleaned Files (${results.cleanedFiles.length})`, vscode.TreeItemCollapsibleState.Collapsed, "cleaned-files"));
        }
        return items;
    }
    getChildrenForItem(element) {
        const results = this.cssAnalyzer.getResults();
        switch (element.contextValue) {
            case "unused-rules":
                if (!results.unusedRules)
                    return [];
                return results.unusedRules.map((rule) => new TreeItem(`${rule.selector} (${rule.file})`, vscode.TreeItemCollapsibleState.None, "unused-rule", rule));
            case "duplicate-rules":
                if (!results.duplicates)
                    return [];
                return results.duplicates.map((duplicate) => new TreeItem(`${duplicate.selector} (${duplicate.files.length} files)`, vscode.TreeItemCollapsibleState.Collapsed, "duplicate-rule", duplicate));
            case "duplicate-rule":
                if (!element.data || !element.data.files)
                    return [];
                return element.data.files.map((file) => new TreeItem(file.file, vscode.TreeItemCollapsibleState.None, "duplicate-file", file));
            case "cleaned-files":
                if (!results.cleanedFiles)
                    return [];
                return results.cleanedFiles.map((file) => new TreeItem(`${file.file} (${file.removedRules} rules)`, vscode.TreeItemCollapsibleState.None, "cleaned-file", file));
            default:
                return [];
        }
    }
}
exports.CSSCleanProProvider = CSSCleanProProvider;
class TreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, data) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.iconPath = new vscode.ThemeIcon("paintcan");
        this.command = {
            title: "Select",
            command: "cssCleanPro.showStatus",
            arguments: [this.data],
        };
        this.data = data;
    }
}
//# sourceMappingURL=CSSCleanProProvider.js.map