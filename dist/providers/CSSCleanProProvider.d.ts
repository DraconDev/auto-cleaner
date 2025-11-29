import * as vscode from "vscode";
import { CSSAnalyzer } from "../services/CSSAnalyzer";
export declare class CSSCleanProProvider implements vscode.TreeDataProvider<TreeItem> {
    private cssAnalyzer;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;
    constructor(cssAnalyzer: CSSAnalyzer);
    refresh(results: any): void;
    getTreeItem(element: TreeItem): vscode.TreeItem;
    getChildren(element?: TreeItem): Thenable<TreeItem[]>;
    private getRootItems;
    private getChildrenForItem;
}
declare class TreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly contextValue: string;
    readonly data?: any;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, contextValue: string, data?: any);
    iconPath: vscode.ThemeIcon;
    command: {
        title: string;
        command: string;
        arguments: any[];
    };
}
export {};
//# sourceMappingURL=CSSCleanProProvider.d.ts.map