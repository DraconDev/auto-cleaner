import * as vscode from "vscode";
import { ConfigurationManager } from "../managers/ConfigurationManager";

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    public static readonly viewType = "removeUnusedProSettings";

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _configManager: ConfigurationManager;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        configManager: ConfigurationManager
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._configManager = configManager;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case "saveSettings":
                        await this._saveSettings(message.settings);
                        vscode.window.showInformationMessage(
                            "Settings saved successfully!"
                        );
                        break;
                    case "getSettings":
                        this._sendSettingsToWebview();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        configManager: ConfigurationManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            SettingsPanel.viewType,
            "Auto Cleaner Settings",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(
            panel,
            extensionUri,
            configManager
        );
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private async _saveSettings(settings: any) {
        const config = this._configManager.getConfiguration();

        // Save Analyzers
        await config.update(
            "enabledAnalyzers",
            settings.enabledAnalyzers,
            vscode.ConfigurationTarget.Global
        );

        // Save Whitelists
        await config.update(
            "whitelistFiles",
            settings.whitelistFiles,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "whitelistFolders",
            settings.whitelistFolders,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "whitelistPatterns",
            settings.whitelistPatterns,
            vscode.ConfigurationTarget.Global
        );

        // Save Excludes
        await config.update(
            "excludePatterns",
            settings.excludePatterns,
            vscode.ConfigurationTarget.Global
        );

        // Save General
        await config.update(
            "dryRun",
            settings.dryRun,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "autoClean",
            settings.autoClean,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "grayAreaHandling",
            settings.grayAreaHandling,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "autoCleanImports",
            settings.autoCleanImports,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "autoCleanFunctions",
            settings.autoCleanFunctions,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "autoCleanVariables",
            settings.autoCleanVariables,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "autoCleanEmptyFiles",
            settings.autoCleanEmptyFiles,
            vscode.ConfigurationTarget.Global
        );

        // Save Granular Settings
        await config.update(
            "cleaning.functions",
            settings.cleaningFunctions,
            vscode.ConfigurationTarget.Global
        );
        await config.update(
            "cleaning.variables",
            settings.cleaningVariables,
            vscode.ConfigurationTarget.Global
        );
    }

    private _sendSettingsToWebview() {
        this._panel.webview.postMessage({
            type: "updateSettings",
            settings: {
                enabledAnalyzers: this._configManager.getEnabledAnalyzers(),
                whitelistFiles: this._configManager.getWhitelistFiles(),
                whitelistFolders: this._configManager.getWhitelistFolders(),
                whitelistPatterns: this._configManager.getWhitelistPatterns(),
                excludePatterns: this._configManager.getExcludePatterns(),
                dryRun: this._configManager.isDryRun(),
                autoClean: this._configManager.shouldAutoClean(),
                autoCleanImports: this._configManager.shouldAutoCleanImports(),
                autoCleanFunctions:
                    this._configManager.shouldAutoCleanFunctions(),
                autoCleanVariables:
                    this._configManager.shouldAutoCleanVariables(),
                autoCleanEmptyFiles:
                    this._configManager.shouldAutoCleanEmptyFiles(),
                grayAreaHandling: this._configManager.getGrayAreaHandling(),
                cleaningFunctions:
                    this._configManager.getFunctionCleaningSettings(),
                cleaningVariables:
                    this._configManager.getVariableCleaningSettings(),
            },
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Auto Cleaner Settings</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); max-width: 800px; margin: 0 auto; }
          h1 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
          h2 { margin-top: 30px; margin-bottom: 15px; color: var(--vscode-textLink-foreground); }
          h3 { margin-top: 20px; margin-bottom: 10px; font-size: 1em; opacity: 0.9; }
          .section { background: var(--vscode-editor-inactiveSelectionBackground); padding: 20px; border-radius: 6px; margin-bottom: 20px; }
          .row { display: flex; align-items: center; margin-bottom: 10px; }
          .label { width: 200px; font-weight: bold; }
          .input-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
          .input-item { display: flex; gap: 10px; align-items: center; }
          input[type="text"] { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; flex-grow: 1; border-radius: 4px; }
          button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px; }
          button:hover { background: var(--vscode-button-hoverBackground); }
          button.remove { background: var(--vscode-errorForeground); padding: 8px 12px; }
          .checkbox-group { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
          .checkbox-item { display: flex; align-items: center; gap: 8px; background: var(--vscode-editor-background); padding: 10px; border-radius: 4px; }
          .help-text { font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-left: 10px; }
          select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); padding: 5px; border-radius: 4px; }
          .granular-section { margin-top: 15px; padding: 10px; background: var(--vscode-editor-background); border-radius: 4px; }
          .granular-title { font-weight: bold; margin-bottom: 10px; display: block; }
        </style>
      </head>
      <body>
        <h1>Auto Cleaner Settings</h1>

        <div class="section">
          <h2>Analyzers</h2>
          <div class="checkbox-group" id="analyzers-container">
            <!-- Checkboxes generated by JS -->
          </div>
        </div>

        <div class="section">
          <h2>Granular Cleaning Rules</h2>
          <p class="help-text" style="margin-bottom: 15px;">Fine-tune what gets cleaned based on export status and usage.</p>
          
          <div class="granular-section">
            <span class="granular-title">Function Cleaning</span>
            <div class="row">
              <input type="checkbox" id="func-cleanUnexported">
              <label for="func-cleanUnexported" style="margin-left: 8px;">Clean unexported & unused</label>
            </div>
            <div class="row">
              <input type="checkbox" id="func-cleanExportedButUnused">
              <label for="func-cleanExportedButUnused" style="margin-left: 8px;">Clean exported but unused (Aggressive)</label>
            </div>
            <div class="row">
              <input type="checkbox" id="func-alwaysKeepExportedAndUsed">
              <label for="func-alwaysKeepExportedAndUsed" style="margin-left: 8px;">Always keep exported & used (Recommended)</label>
            </div>
          </div>

          <div class="granular-section">
            <span class="granular-title">Variable Cleaning</span>
            <div class="row">
              <input type="checkbox" id="var-cleanUnexported">
              <label for="var-cleanUnexported" style="margin-left: 8px;">Clean unexported & unused</label>
            </div>
            <div class="row">
              <input type="checkbox" id="var-cleanExportedButUnused">
              <label for="var-cleanExportedButUnused" style="margin-left: 8px;">Clean exported but unused (Aggressive)</label>
            </div>
            <div class="row">
              <input type="checkbox" id="var-alwaysKeepExportedAndUsed">
              <label for="var-alwaysKeepExportedAndUsed" style="margin-left: 8px;">Always keep exported & used (Recommended)</label>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>General Settings</h2>
          <div class="row">
            <label class="label">Dry Run Mode</label>
            <input type="checkbox" id="dryRun">
            <span class="help-text">Preview changes without deleting</span>
          </div>
          <div class="row">
            <label class="label">Auto Clean</label>
            <input type="checkbox" id="autoClean">
            <span class="help-text">Delete without confirmation (Use with caution!)</span>
          </div>
          <div class="row" style="margin-left: 20px;">
            <label class="label">Auto Clean Imports</label>
            <input type="checkbox" id="autoCleanImports">
            <span class="help-text">Safe to auto-clean</span>
          </div>
          <div class="row" style="margin-left: 20px;">
            <label class="label">Auto Clean Functions</label>
            <input type="checkbox" id="autoCleanFunctions">
            <span class="help-text">Use with caution</span>
          </div>
          <div class="row" style="margin-left: 20px;">
            <label class="label">Auto Clean Variables</label>
            <input type="checkbox" id="autoCleanVariables">
            <span class="help-text">Use with caution</span>
          </div>
          <div class="row" style="margin-left: 20px;">
            <label class="label">Auto Clean Empty Files</label>
            <input type="checkbox" id="autoCleanEmptyFiles">
            <span class="help-text">Use with caution</span>
          </div>
          <div class="row">
            <label class="label">Gray Area Handling</label>
            <select id="grayAreaHandling">
              <option value="ignore">Ignore</option>
              <option value="warn">Warn</option>
              <option value="remove">Remove</option>
            </select>
            <span class="help-text">How to handle exported/public items</span>
          </div>
        </div>

        <div class="section">
          <h2>Whitelist (Never Clean)</h2>
          <p class="help-text" style="margin-bottom: 15px;">Files and folders added here will be completely ignored by all analyzers.</p>
          
          <h3>Files (Exact Name)</h3>
          <div id="whitelistFiles" class="input-list"></div>
          <button onclick="addItem('whitelistFiles')">+ Add File</button>

          <h3>Folders (Exact Name)</h3>
          <div id="whitelistFolders" class="input-list"></div>
          <button onclick="addItem('whitelistFolders')">+ Add Folder</button>

          <h3>Patterns (Glob)</h3>
          <div id="whitelistPatterns" class="input-list"></div>
          <button onclick="addItem('whitelistPatterns')">+ Add Pattern</button>
        </div>

        <div class="section">
          <h2>Exclusions (Skip Analysis)</h2>
          <p class="help-text" style="margin-bottom: 15px;">Glob patterns for files/folders to skip during analysis (e.g., node_modules).</p>
          <div id="excludePatterns" class="input-list"></div>
          <button onclick="addItem('excludePatterns')">+ Add Pattern</button>
        </div>

        <div style="position: sticky; bottom: 0; background: var(--vscode-editor-background); padding: 20px 0; border-top: 1px solid var(--vscode-panel-border);">
          <button onclick="saveSettings()" style="padding: 12px 24px; font-size: 1.1em; width: 100%;">Save Settings</button>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          let currentSettings = {};

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateSettings') {
              currentSettings = message.settings;
              renderSettings();
            }
          });

          function renderSettings() {
            // Analyzers
            const analyzers = ['css', 'rust', 'go', 'typescript', 'javascript', 'filesystem'];
            const container = document.getElementById('analyzers-container');
            container.innerHTML = '';
            analyzers.forEach(a => {
              const div = document.createElement('div');
              div.className = 'checkbox-item';
              div.innerHTML = \`
                <input type="checkbox" id="analyzer-\${a}" \${currentSettings.enabledAnalyzers.includes(a) ? 'checked' : ''}>
                <label for="analyzer-\${a}">\${a.charAt(0).toUpperCase() + a.slice(1)}</label>
              \`;
              container.appendChild(div);
            });

            // Granular Settings
            if (currentSettings.cleaningFunctions) {
                document.getElementById('func-cleanUnexported').checked = currentSettings.cleaningFunctions.cleanUnexported;
                document.getElementById('func-cleanExportedButUnused').checked = currentSettings.cleaningFunctions.cleanExportedButUnused;
                document.getElementById('func-alwaysKeepExportedAndUsed').checked = currentSettings.cleaningFunctions.alwaysKeepExportedAndUsed;
            }
            if (currentSettings.cleaningVariables) {
                document.getElementById('var-cleanUnexported').checked = currentSettings.cleaningVariables.cleanUnexported;
                document.getElementById('var-cleanExportedButUnused').checked = currentSettings.cleaningVariables.cleanExportedButUnused;
                document.getElementById('var-alwaysKeepExportedAndUsed').checked = currentSettings.cleaningVariables.alwaysKeepExportedAndUsed;
            }

            // General
            document.getElementById('dryRun').checked = currentSettings.dryRun;
            document.getElementById('autoClean').checked = currentSettings.autoClean;
            document.getElementById('autoCleanImports').checked = currentSettings.autoCleanImports;
            document.getElementById('autoCleanFunctions').checked = currentSettings.autoCleanFunctions;
            document.getElementById('autoCleanVariables').checked = currentSettings.autoCleanVariables;
            document.getElementById('autoCleanEmptyFiles').checked = currentSettings.autoCleanEmptyFiles;
            document.getElementById('grayAreaHandling').value = currentSettings.grayAreaHandling;

            // Lists
            renderList('whitelistFiles', currentSettings.whitelistFiles);
            renderList('whitelistFolders', currentSettings.whitelistFolders);
            renderList('whitelistPatterns', currentSettings.whitelistPatterns);
            renderList('excludePatterns', currentSettings.excludePatterns);
          }

          function renderList(id, items) {
            const container = document.getElementById(id);
            container.innerHTML = '';
            items.forEach((item, index) => {
              const div = document.createElement('div');
              div.className = 'input-item';
              div.innerHTML = \`
                <input type="text" value="\${item}" onchange="updateListItem('\${id}', \${index}, this.value)" placeholder="Enter value...">
                <button class="remove" onclick="removeListItem('\${id}', \${index})">Remove</button>
              \`;
              container.appendChild(div);
            });
          }

          function addItem(id) {
            if (!currentSettings[id]) currentSettings[id] = [];
            currentSettings[id].push('');
            renderList(id, currentSettings[id]);
          }

          function removeListItem(id, index) {
            currentSettings[id].splice(index, 1);
            renderList(id, currentSettings[id]);
          }

          function updateListItem(id, index, value) {
            currentSettings[id][index] = value;
          }

          function saveSettings() {
            // Gather analyzer checkboxes
            const enabledAnalyzers = [];
            ['css', 'rust', 'go', 'typescript', 'javascript', 'filesystem'].forEach(a => {
              if (document.getElementById(\`analyzer-\${a}\`).checked) {
                enabledAnalyzers.push(a);
              }
            });

            const settings = {
              enabledAnalyzers,
              dryRun: document.getElementById('dryRun').checked,
              autoClean: document.getElementById('autoClean').checked,
              autoCleanImports: document.getElementById('autoCleanImports').checked,
              autoCleanFunctions: document.getElementById('autoCleanFunctions').checked,
              autoCleanVariables: document.getElementById('autoCleanVariables').checked,
              autoCleanEmptyFiles: document.getElementById('autoCleanEmptyFiles').checked,
              grayAreaHandling: document.getElementById('grayAreaHandling').value,
              whitelistFiles: currentSettings.whitelistFiles.filter(i => i),
              whitelistFolders: currentSettings.whitelistFolders.filter(i => i),
              whitelistPatterns: currentSettings.whitelistPatterns.filter(i => i),
              excludePatterns: currentSettings.excludePatterns.filter(i => i),
              cleaningFunctions: {
                  cleanUnexported: document.getElementById('func-cleanUnexported').checked,
                  cleanExportedButUnused: document.getElementById('func-cleanExportedButUnused').checked,
                  alwaysKeepExportedAndUsed: document.getElementById('func-alwaysKeepExportedAndUsed').checked
              },
              cleaningVariables: {
                  cleanUnexported: document.getElementById('var-cleanUnexported').checked,
                  cleanExportedButUnused: document.getElementById('var-cleanExportedButUnused').checked,
                  alwaysKeepExportedAndUsed: document.getElementById('var-alwaysKeepExportedAndUsed').checked
              }
            };

            vscode.postMessage({
              type: 'saveSettings',
              settings: settings
            });
          }

          // Initial request
          vscode.postMessage({ type: 'getSettings' });
        </script>
      </body>
      </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
