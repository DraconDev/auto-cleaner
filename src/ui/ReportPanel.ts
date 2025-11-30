import * as vscode from "vscode";
import { AnalysisResult, CleanableItem } from "../core/IAnalyzer";

interface AnalyzerInstances {
    cssAnalyzer: any;
    rustAnalyzer: any;
    goAnalyzer: any;
    tsAnalyzer: any;
    jsAnalyzer: any;
    pyAnalyzer: any;
    fsAnalyzer: any;
}

export class ReportPanel {
    public static currentPanel: ReportPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _results: AnalysisResult[];
    private _analyzers: AnalyzerInstances;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        results: AnalysisResult[],
        analyzers: AnalyzerInstances
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._results = results;
        this._analyzers = analyzers;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                await this._handleMessage(message);
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        results: AnalysisResult[],
        analyzers: AnalyzerInstances
    ) {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it and update content
        if (ReportPanel.currentPanel) {
            ReportPanel.currentPanel._results = results;
            ReportPanel.currentPanel._analyzers = analyzers;
            ReportPanel.currentPanel._panel.reveal(column);
            ReportPanel.currentPanel._update();
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            "autoCleanerReport",
            "auto cleaner pro Report",
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            }
        );

        ReportPanel.currentPanel = new ReportPanel(
            panel,
            extensionUri,
            results,
            analyzers
        );
    }

    public dispose() {
        ReportPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private async _handleMessage(message: any) {
        switch (message.type) {
            case "cleanSelected":
                await this._cleanSelectedItems(message.items);
                break;
            case "openFile":
                await this._openFile(message.filePath, message.line);
                break;
        }
    }

    private async _cleanSelectedItems(items: any[]) {
        try {
            // Group items by analyzer
            const itemsByAnalyzer = new Map<string, CleanableItem[]>();

            for (const item of items) {
                if (!itemsByAnalyzer.has(item.analyzer)) {
                    itemsByAnalyzer.set(item.analyzer, []);
                }
                itemsByAnalyzer.get(item.analyzer)!.push(item.cleanableItem);
            }

            // Clean items for each analyzer
            for (const [analyzerName, analyzerItems] of itemsByAnalyzer) {
                const analyzer = this._getAnalyzer(analyzerName);
                if (analyzer && analyzerItems.length > 0) {
                    await analyzer.clean(analyzerItems);
                }
            }

            vscode.window.showInformationMessage(
                `auto cleaner pro: Successfully cleaned ${items.length} items`
            );

            // Refresh the panel
            // Note: In a real app we might want to re-scan here to verify
            // For now, we just remove them from the UI or keep them until next scan
            // Ideally we should trigger a re-scan.
            vscode.commands.executeCommand("autoCleaner.generateReport");
        } catch (error) {
            vscode.window.showErrorMessage(
                `auto cleaner pro: Error cleaning items - ${error}`
            );
        }
    }

    private async _openFile(filePath: string, line?: number) {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            if (line && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
        }
    }

    private _getAnalyzer(name: string): any {
        switch (name) {
            case "css":
                return this._analyzers.cssAnalyzer;
            case "rust":
                return this._analyzers.rustAnalyzer;
            case "go":
                return this._analyzers.goAnalyzer;
            case "typescript":
                return this._analyzers.tsAnalyzer;
            case "javascript":
                return this._analyzers.jsAnalyzer;
            case "python":
                return this._analyzers.pyAnalyzer;
            case "filesystem":
                return this._analyzers.fsAnalyzer;
            default:
                return null;
        }
    }

    private _getHtmlForWebview(): string {
        const nonce = getNonce();

        // Aggregate all items
        const allItems = this._aggregateItems();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>auto cleaner pro Report</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            font-size: 14px;
        }
        
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .stat-value {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .filters {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .filters label {
            font-weight: bold;
        }
        
        .filters select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 5px 10px;
            border-radius: 4px;
        }
        
        .analyzer-section {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .analyzer-header {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px 15px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        
        .analyzer-header:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .analyzer-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 12px;
        }
        
        .analyzer-body {
            padding: 15px;
        }
        
        .analyzer-body.collapsed {
            display: none;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            text-align: left;
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        td {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        
        .file-link:hover {
            text-decoration: underline;
        }
        
        .type-badge {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
        }
        
        .footer {
            position: sticky;
            bottom: 0;
            background: var(--vscode-editor-background);
            padding: 20px 0;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 14px;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        button.primary {
            background: var(--vscode-button-background);
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state h2 {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>auto cleaner pro Report</h1>
        <div class="stats">
            <div class="stat">
                <span>Total Issues:</span>
                <span class="stat-value" id="total-count">0</span>
            </div>
            <div class="stat">
                <span>Selected:</span>
                <span class="stat-value" id="selected-count">0</span>
            </div>
        </div>
    </div>
    
    <div class="filters">
        <label for="analyzer-filter">Filter:</label>
        <select id="analyzer-filter">
            <option value="all">All Analyzers</option>
            <option value="css">CSS</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="filesystem">FileSystem</option>
        </select>
    </div>
    
    <div id="content"></div>
    
    <div class="footer">
        <button class="secondary" id="btn-select-all">Select All</button>
        <button class="secondary" id="btn-deselect-all">Deselect All</button>
        <button class="primary" id="btn-clean-selected">Clean Selected</button>
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const allItems = ${JSON.stringify(allItems)};
        
        let selectedItems = new Set();
        
        function renderReport() {
            const filter = document.getElementById('analyzer-filter').value;
            const content = document.getElementById('content');
            
            // Group items by analyzer
            const grouped = {};
            for (const item of allItems) {
                if (filter !== 'all' && item.analyzer !== filter) continue;
                
                if (!grouped[item.analyzer]) {
                    grouped[item.analyzer] = [];
                }
                grouped[item.analyzer].push(item);
            }
            
            if (Object.keys(grouped).length === 0) {
                content.innerHTML = '<div class="empty-state"><h2>No Issues Found</h2><p>All code looks clean!</p></div>';
                return;
            }
            
            let html = '';
            for (const [analyzer, items] of Object.entries(grouped)) {
                html += renderAnalyzerSection(analyzer, items);
            }
            
            content.innerHTML = html;
            updateStats();
            attachDynamicListeners();
        }
        
        function renderAnalyzerSection(analyzer, items) {
            const analyzerName = analyzer.charAt(0).toUpperCase() + analyzer.slice(1);
            const allSelected = items.every(item => selectedItems.has(item.id));
            
            return \`
                <div class="analyzer-section" data-analyzer="\${analyzer}">
                    <div class="analyzer-header" data-action="toggle-section" data-target="\${analyzer}">
                        <span>\${analyzerName} Analyzer</span>
                        <span class="analyzer-badge">\${items.length} issues</span>
                    </div>
                    <div class="analyzer-body" id="body-\${analyzer}">
                        <table>
                            <thead>
                                <tr>
                                    <th width="40"><input type="checkbox" class="analyzer-checkbox" data-analyzer="\${analyzer}" \${allSelected ? 'checked' : ''}></th>
                                    <th width="150">Type</th>
                                    <th>File</th>
                                    <th width="60">Line</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${items.map(item => renderItem(item)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            \`;
        }
        
        function renderItem(item) {
            const fileName = item.file.split('/').pop();
            const isSelected = selectedItems.has(item.id);
            return \`
                <tr>
                    <td><input type="checkbox" class="item-checkbox" data-id="\${item.id}" \${isSelected ? 'checked' : ''}></td>
                    <td><span class="type-badge">\${item.type}</span></td>
                    <td><a class="file-link" data-action="open-file" data-file="\${item.file}" data-line="\${item.line || 0}">\${fileName}</a></td>
                    <td>\${item.line || '-'}</td>
                    <td>\${item.description}</td>
                </tr>
            \`;
        }
        
        function attachDynamicListeners() {
            // Toggle Section
            document.querySelectorAll('[data-action="toggle-section"]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const analyzer = e.currentTarget.getAttribute('data-target');
                    const body = document.getElementById('body-' + analyzer);
                    body.classList.toggle('collapsed');
                });
            });

            // Open File
            document.querySelectorAll('[data-action="open-file"]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const filePath = e.currentTarget.getAttribute('data-file');
                    const line = parseInt(e.currentTarget.getAttribute('data-line'));
                    vscode.postMessage({
                        type: 'openFile',
                        filePath: filePath,
                        line: line
                    });
                });
            });

            // Analyzer Checkbox (Select All for Analyzer)
            document.querySelectorAll('.analyzer-checkbox').forEach(el => {
                el.addEventListener('change', (e) => {
                    const analyzer = e.target.getAttribute('data-analyzer');
                    toggleAnalyzer(analyzer, e.target.checked);
                });
            });

            // Item Checkbox
            document.querySelectorAll('.item-checkbox').forEach(el => {
                el.addEventListener('change', (e) => {
                    const id = e.target.getAttribute('data-id');
                    toggleItem(id, e.target.checked);
                });
            });
        }
        
        function toggleItem(id, checked) {
            if (checked) {
                selectedItems.add(id);
            } else {
                selectedItems.delete(id);
            }
            updateStats();
        }
        
        function toggleAnalyzer(analyzer, checked) {
            const items = allItems.filter(i => i.analyzer === analyzer);
            for (const item of items) {
                if (checked) {
                    selectedItems.add(item.id);
                } else {
                    selectedItems.delete(item.id);
                }
            }
            renderReport();
        }
        
        function selectAll() {
            const filter = document.getElementById('analyzer-filter').value;
            for (const item of allItems) {
                if (filter === 'all' || item.analyzer === filter) {
                    selectedItems.add(item.id);
                }
            }
            renderReport();
        }
        
        function deselectAll() {
            selectedItems.clear();
            renderReport();
        }
        
        function updateStats() {
            document.getElementById('total-count').textContent = allItems.length;
            document.getElementById('selected-count').textContent = selectedItems.size;
        }
        
        function cleanSelected() {
            const items = allItems.filter(i => selectedItems.has(i.id));
            if (items.length === 0) {
                return;
            }
            
            vscode.postMessage({
                type: 'cleanSelected',
                items: items
            });
            
            selectedItems.clear();
        }
        
        // Static Listeners
        document.getElementById('analyzer-filter').addEventListener('change', renderReport);
        document.getElementById('btn-select-all').addEventListener('click', selectAll);
        document.getElementById('btn-deselect-all').addEventListener('click', deselectAll);
        document.getElementById('btn-clean-selected').addEventListener('click', cleanSelected);
        
        renderReport();
    </script>
</body>
</html>`;
    }

    private _aggregateItems(): any[] {
        const items: any[] = [];
        let idCounter = 0;

        for (const result of this._results) {
            for (const item of result.items) {
                items.push({
                    id: `${result.analyzerName}-${idCounter++}`,
                    analyzer: result.analyzerName,
                    type: item.type,
                    file: item.file,
                    line: item.line,
                    description: item.description,
                    cleanableItem: item,
                });
            }
        }

        return items;
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
