export declare class GitManager {
    constructor();
    isGitRepository(cwd: string): Promise<boolean>;
    hasUnstagedChanges(cwd: string): Promise<boolean>;
    commitChanges(cwd: string, message: string): Promise<boolean>;
    pushChanges(cwd: string): Promise<boolean>;
    private runCommand;
}
//# sourceMappingURL=GitManager.d.ts.map