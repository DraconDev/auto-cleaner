# Auto Cleaner

The **ultimate automatic code cleaner** for multiple languages. Automatically detects and removes unused imports, functions, variables, and more in **Rust**, **Go**, **CSS**, and other languages.

## ✨ Features

### 🛡️ Multi-Language Support

-   **Rust**: Detects unused imports via `cargo check`.
-   **Go**: Detects unused imports and variables via `go build` / `go vet`.
-   **CSS**: Scans for unused rules, variables, and duplicates.
-   **More coming soon**: TypeScript, JavaScript, Python support planned.

### ⚙️ Powerful Configuration

-   **Interactive Settings Tab**: Manage all settings via a dedicated UI (`Auto Cleaner: Open Settings`).
-   **Whitelists**: Protect specific files, folders, or patterns from ever being cleaned.
-   **Exclusions**: Skip analysis for heavy directories like `node_modules` or `target`.
-   **Analyzer Toggles**: Enable/disable specific language analyzers.

### 🛡️ Granular Auto-Clean

-   **Auto Clean Imports** (Default: ON) - Safely removes unused imports automatically.
-   **Auto Clean Functions** (Default: OFF) - Removes unused functions (use with caution).
-   **Auto Clean Variables** (Default: OFF) - Removes unused variables (use with caution).

### 🛡️ Safety First

-   **Dry Run Mode**: Preview changes before they happen (enabled by default).
-   **Gray Area Handling**: Configure how to handle exported/public items (Ignore, Warn, or Remove).
-   **Status Bar Integration**: Click to see menu with quick actions.

## 🚀 Installation

1. Install the extension from VS Code Marketplace.
2. Ensure you have the necessary tools installed for your languages:
    - **Rust**: `cargo` must be in your PATH.
    - **Go**: `go` must be in your PATH.

## 📖 Usage

### Commands

-   **Auto Cleaner: Open Settings**: Open the interactive configuration tab.
-   **Auto Cleaner: Scan for Unused Code**: Manually trigger a scan.
-   **Auto Cleaner: Clean Unused Code**: Remove unused code.
-   **Auto Cleaner: Generate Report**: Create a detailed Markdown report.

### Status Bar

Click the status bar item to:

-   See the number of unused items found
-   Access the quick action menu

## ⚙️ Configuration

We recommend using the **Settings Tab** (`Auto Cleaner: Open Settings`) for the best experience.

Alternatively, you can configure via `settings.json`:

```json
{
    "autoCleaner.dryRun": true,
    "autoCleaner.autoCleanImports": true,
    "autoCleaner.autoCleanFunctions": false,
    "autoCleaner.grayAreaHandling": "warn",
    "autoCleaner.enabledAnalyzers": ["rust", "go", "css"],
    "autoCleaner.whitelistFiles": ["global.css", "main.rs"],
    "autoCleaner.excludePatterns": ["**/node_modules/**"]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License

## 📝 Changelog

### 2.0.0

-   **Rebranding**: Renamed to "Remove Unused Pro".
-   **New Architecture**: Plugin-based system for easy multi-language support.
-   **New Analyzers**: Added support for **Rust** and **Go**.
-   **Settings UI**: Added a dedicated Webview for managing configuration.
-   **Whitelists**: Added robust file/folder/pattern whitelisting.
