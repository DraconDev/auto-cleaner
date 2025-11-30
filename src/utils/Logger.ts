import * as vscode from "vscode";

export class Logger {
    private static _outputChannel: vscode.OutputChannel;

    public static initialize() {
        if (!this._outputChannel) {
            this._outputChannel =
                vscode.window.createOutputChannel("auto cleaner pro");
        }
    }

    public static log(message: string) {
        if (!this._outputChannel) {
            this.initialize();
        }
        const timestamp = new Date().toLocaleTimeString();
        this._outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    public static error(message: string, error?: any) {
        if (!this._outputChannel) {
            this.initialize();
        }
        const timestamp = new Date().toLocaleTimeString();
        this._outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
        if (error) {
            this._outputChannel.appendLine(String(error));
            if (error.stack) {
                this._outputChannel.appendLine(error.stack);
            }
        }
    }

    public static show() {
        this._outputChannel?.show();
    }
}
