import * as vscode from "vscode";
import { CSSAnalyzer } from "../services/CSSAnalyzer";

export class AutoCleanerProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private cssAnalyzer: CSSAnalyzer) {}

  refresh(results: any): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve(this.getChildrenForItem(element));
    } else {
      const results = this.cssAnalyzer.getResults();
      return Promise.resolve(this.getRootItems(results));
    }
  }

  private getRootItems(results: any): TreeItem[] {
    const items: TreeItem[] = [];

    if (results.unusedRules && results.unusedRules.length > 0) {
      items.push(
        new TreeItem(
          `Unused CSS Rules (${results.unusedRules.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          "unused-rules"
        )
      );
    }

    if (results.duplicates && results.duplicates.length > 0) {
      items.push(
        new TreeItem(
          `Duplicate Rules (${results.duplicates.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          "duplicate-rules"
        )
      );
    }

    if (results.cleanedFiles && results.cleanedFiles.length > 0) {
      items.push(
        new TreeItem(
          `Cleaned Files (${results.cleanedFiles.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          "cleaned-files"
        )
      );
    }

    return items;
  }

  private getChildrenForItem(element: TreeItem): TreeItem[] {
    const results = this.cssAnalyzer.getResults();

    switch (element.contextValue) {
      case "unused-rules":
        if (!results.unusedRules) return [];
        return results.unusedRules.map(
          (rule: any) =>
            new TreeItem(
              `${rule.selector} (${rule.file})`,
              vscode.TreeItemCollapsibleState.None,
              "unused-rule",
              rule
            )
        );

      case "duplicate-rules":
        if (!results.duplicates) return [];
        return results.duplicates.map(
          (duplicate: any) =>
            new TreeItem(
              `${duplicate.selector} (${duplicate.files.length} files)`,
              vscode.TreeItemCollapsibleState.Collapsed,
              "duplicate-rule",
              duplicate
            )
        );

      case "duplicate-rule":
        if (!element.data || !element.data.files) return [];
        return element.data.files.map(
          (file: any) =>
            new TreeItem(
              file.file,
              vscode.TreeItemCollapsibleState.None,
              "duplicate-file",
              file
            )
        );

      case "cleaned-files":
        if (!results.cleanedFiles) return [];
        return results.cleanedFiles.map(
          (file: any) =>
            new TreeItem(
              `${file.file} (${file.removedRules} rules)`,
              vscode.TreeItemCollapsibleState.None,
              "cleaned-file",
              file
            )
        );

      default:
        return [];
    }
  }
}

class TreeItem extends vscode.TreeItem {
  public readonly data?: any;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    data?: any
  ) {
    super(label, collapsibleState);
    this.data = data;
  }

  iconPath = new vscode.ThemeIcon("paintcan");

  command = {
    title: "Select",
    command: "cssCleanPro.showStatus",
    arguments: [this.data],
  };
}
