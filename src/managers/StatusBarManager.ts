import * as vscode from "vscode";

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = "autoCleaner.showMenu";
        this.statusBarItem.tooltip = "auto cleaner pro - Click for actions";
        this.statusBarItem.text = "$(trash) auto cleaner pro";
        this.statusBarItem.show();
    }

    updateStatus(text: string, icon: string = "$(trash)") {
        this.statusBarItem.text = `${icon} ${text}`;
        this.statusBarItem.show();
    }

    showUnusedCount(count: number) {
        if (count === 0) {
            this.updateStatus("Clean", "$(check)");
        } else {
            this.updateStatus(`${count} unused items`, "$(warning)");
        }
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
