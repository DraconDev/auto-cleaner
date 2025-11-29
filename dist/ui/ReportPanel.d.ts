import * as vscode from "vscode";
import { AnalysisResult } from "../core/IAnalyzer";
interface AnalyzerInstances {
    cssAnalyzer: any;
    rustAnalyzer: any;
    goAnalyzer: any;
    tsAnalyzer: any;
    jsAnalyzer: any;
    pyAnalyzer: any;
    fsAnalyzer: any;
}
export declare class ReportPanel {
    static currentPanel: ReportPanel | undefined;
    private readonly _panel;
    private readonly _extensionUri;
    private _results;
    private _analyzers;
    private _disposables;
    private constructor();
    static createOrShow(extensionUri: vscode.Uri, results: AnalysisResult[], analyzers: AnalyzerInstances): void;
    dispose(): void;
    private _update;
    private _handleMessage;
    private _cleanSelectedItems;
    private _openFile;
    private _getAnalyzer;
    private _getHtmlForWebview;
    private _aggregateItems;
}
export {};
//# sourceMappingURL=ReportPanel.d.ts.map