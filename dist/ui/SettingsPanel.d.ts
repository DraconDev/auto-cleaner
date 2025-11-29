import * as vscode from "vscode";
import { ConfigurationManager } from "../managers/ConfigurationManager";
export declare class SettingsPanel {
    static currentPanel: SettingsPanel | undefined;
    static readonly viewType = "removeUnusedProSettings";
    private readonly _panel;
    private readonly _extensionUri;
    private readonly _configManager;
    private _disposables;
    private constructor();
    static createOrShow(extensionUri: vscode.Uri, configManager: ConfigurationManager): void;
    dispose(): void;
    private _update;
    private _saveSettings;
    private _sendSettingsToWebview;
    private _getHtmlForWebview;
}
//# sourceMappingURL=SettingsPanel.d.ts.map