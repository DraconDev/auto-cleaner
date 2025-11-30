# Auto Cleaner

The **ultimate automatic code cleaner** for multiple languages with intelligent granular control. Automatically detects and removes unused imports, functions, variables, and more across **Rust**, **Go**, **TypeScript**, **JavaScript**, **Python**, **CSS**, and filesystem.

## ✨ Features

### 🌍 Comprehensive Multi-Language Support

-   **Rust**: Detects unused imports via `cargo check` with smart deletion
-   **Go**: Detects unused imports and variables via `go build` / `go vet`
-   **TypeScript/JavaScript**: Detects unused imports, functions, and variables via TSC/ESLint
-   **Python**: Detects unused code via Pylint/Pyflakes
-   **CSS**: Scans for unused rules, variables, and duplicates
-   **FileSystem**: Finds and removes empty files and directories

### 🎯 Granular Cleaning Controls

Fine-tune what gets cleaned based on export status and usage:

**Function Cleaning:**

-   Clean unexported & unused functions (safe)
-   Clean exported but unused functions (aggressive mode)
-   Always keep exported & used functions (recommended)

**Variable Cleaning:**

-   Clean unexported & unused variables (safe)
-   Clean exported but unused variables (aggressive mode)
-   Always keep exported & used variables (recommended)

### ⚙️ Powerful Configuration

-   **Interactive Settings Tab**: Manage all settings via a dedicated UI (`Auto Cleaner: Open Settings`)
-   **Whitelists**: Protect specific files, folders, or patterns from ever being cleaned
-   **Exclusions**: Skip analysis for heavy directories like `node_modules` or `target`
-   **Analyzer Toggles**: Enable/disable specific language analyzers
-   **Export Detection**: Automatically identifies exported items (`pub` in Rust, `export` in TS/JS, capitalization in Go)

### 🛡️ Safety First

-   **Git Integration**: Automatically commits changes before cleaning (enabled by default)
-   **Dry Run Mode**: Preview changes before they happen
-   **Undo Support**: All changes use VS Code's WorkspaceEdit for native undo
-   **Gray Area Handling**: Configure how to handle exported/public items (Ignore, Warn, or Remove)
-   **Interactive Report**: Review and selectively clean items via webview

## 🚀 Installation

1. Install the extension from VS Code Marketplace
2. Ensure you have the necessary tools installed for your languages:
    - **Rust**: `cargo` must be in your PATH
    - **Go**: `go` must be in your PATH
    - **TypeScript**: `tsc` or project's `tsconfig.json`
    - **JavaScript**: `eslint` (optional but recommended)
    - **Python**: `pylint` or `pyflakes` (optional)

## 📖 Usage

### Commands

-   **Auto Cleaner: Open Settings**: Open the interactive configuration tab
-   **Auto Cleaner: Scan Project**: Scan all enabled analyzers
-   **Auto Cleaner: Clean All Unused Code**: Remove all detected unused code
-   **Auto Cleaner: Generate Report**: View interactive report with selective cleaning

### Status Bar

Click the status bar item (`🧹 Auto Cleaner`) to:

-   See real-time count of unused items
-   Access quick action menu (Scan, Clean, Settings, Report)

### Granular Settings

Access via Settings Tab or configure manually:

```json
{
    "autoCleaner.cleaning.functions": {
        "cleanUnexported": true,
        "cleanExportedButUnused": false,
        "alwaysKeepExportedAndUsed": true
    },
    "autoCleaner.cleaning.variables": {
        "cleanUnexported": true,
        "cleanExportedButUnused": false,
        "alwaysKeepExportedAndUsed": true
    }
}
```

### Git Integration

Automatic commits before cleaning (recommended):

```json
{
    "autoCleaner.createGitCommit": true,
    "autoCleaner.gitPushAfterCommit": false
}
```

## ⚙️ Configuration

We recommend using the **Settings Tab** (`Auto Cleaner: Open Settings`) for the best experience.

### Key Settings

```json
{
    "autoCleaner.dryRun": true,
    "autoCleaner.createGitCommit": true,
    "autoCleaner.autoClean": false,
    "autoCleaner.autoCleanImports": true,
    "autoCleaner.autoCleanFunctions": false,
    "autoCleaner.autoCleanVariables": false,
    "autoCleaner.grayAreaHandling": "warn",
    "autoCleaner.enabledAnalyzers": [
        "rust",
        "go",
        "typescript",
        "javascript",
        "python",
        "css",
        "filesystem"
    ],
    "autoCleaner.whitelistFiles": [],
    "autoCleaner.whitelistFolders": [],
    "autoCleaner.excludePatterns": [
        "**/node_modules/**",
        "**/target/**",
        "**/dist/**"
    ]
}
```

## 🎨 Export Detection

Auto Cleaner intelligently detects exported items across languages:

-   **Rust**: Identifies `pub` keyword
-   **TypeScript/JavaScript**: Identifies `export` keyword and `module.exports`
-   **Go**: Identifies capitalized names (Go convention)
-   **Python**: All module-level items considered exported

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see included test files)
5. Submit a pull request

## 📄 License

MIT License

## 📝 Changelog

### 2.7.x - Granular Settings & Polish

-   **Granular Cleaning Controls**: Fine-tune cleaning based on export status and usage
-   **Git Integration**: Auto-commit before cleaning with optional push
-   **FileSystem Analyzer**: Fixed file path linking issues
-   **Smart Deletion**: Improved Rust import deletion (no more `use ;` artifacts)
-   **Multi-language Support**: Added TypeScript, JavaScript, Python analyzers
-   **Interactive Report**: Collapsible sections, select all/deselect all
-   **Settings UI**: Enhanced with granular cleaning options

### 2.0.0 - Major Rebranding

-   **Rebranding**: Renamed to "Auto Cleaner"
-   **New Architecture**: Plugin-based system for easy multi-language support
-   **New Analyzers**: Added support for Rust and Go
-   **Settings UI**: Dedicated webview for managing configuration
-   **Whitelists**: Robust file/folder/pattern whitelisting
-   **Enhanced Safety**: WorkspaceEdit for all changes (undo support)

## 💡 Tips

-   **Start with Dry Run**: Keep `dryRun: true` until you're comfortable with the extension
-   **Use Git Integration**: Always enable `createGitCommit` for safety
-   **Review Reports**: Use the interactive report to review changes before applying
-   **Customize Exclusions**: Add build directories and dependencies to `excludePatterns`
-   **Granular Control**: Use the granular settings to balance aggressiveness with safety

## 🐛 Known Limitations

-   Export detection uses regex/heuristics, not full AST parsing
-   External usage detection is limited to same-file usage
-   Python analyzer considers all module-level items as "exported"
