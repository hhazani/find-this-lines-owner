import * as vscode from "vscode";
import { LineHistoryEntry, PullRequestInfo } from "./types";
import { getLineHistory, getPullRequestsForLine } from "./gitService";

export class LineOwnerCodeLensProvider implements vscode.CodeLensProvider {
    private trackedLines = new Map<string, Set<number>>();
    private historyCache = new Map<string, LineHistoryEntry[]>();
    private prCache = new Map<string, PullRequestInfo[]>();
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    addLine(filePath: string, lineNumber: number) {
        if (!this.trackedLines.has(filePath)) {
            this.trackedLines.set(filePath, new Set());
        }
        this.trackedLines.get(filePath)!.add(lineNumber);
        this.historyCache.delete(`${filePath}:${lineNumber}`);
        this.prCache.delete(`${filePath}:${lineNumber}`);
        this._onDidChangeCodeLenses.fire();
    }

    clearCache() {
        this.historyCache.clear();
        this.prCache.clear();
        this._onDidChangeCodeLenses.fire();
    }

    async provideCodeLenses(
        document: vscode.TextDocument
    ): Promise<vscode.CodeLens[]> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            document.uri
        );
        if (!workspaceFolder) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const filePath = document.uri.fsPath;
        const trackedLinesForFile = this.trackedLines.get(filePath);

        if (!trackedLinesForFile || trackedLinesForFile.size === 0) {
            return [];
        }

        for (const lineNumber of trackedLinesForFile) {
            try {
                const cacheKey = `${filePath}:${lineNumber}`;
                let history = this.historyCache.get(cacheKey);
                let prs = this.prCache.get(cacheKey);

                if (!history) {
                    history = await getLineHistory(
                        filePath,
                        lineNumber + 1,
                        workspaceFolder.uri.fsPath
                    );
                    this.historyCache.set(cacheKey, history);
                }

                if (!prs) {
                    prs = await getPullRequestsForLine(
                        filePath,
                        lineNumber + 1,
                        workspaceFolder.uri.fsPath
                    );
                    this.prCache.set(cacheKey, prs);
                }

                const range = new vscode.Range(lineNumber, 0, lineNumber, 0);

                // Create combined CodeLens with ordered sections
                if (history.length > 0) {
                    const uniqueAuthors = new Set(history.map((h) => h.author));
                    const lastEdit = history[0];
                    const firstEdit = history[history.length - 1];

                    // Section 1 & 2: oldest owner -> latest owner (unclickable)
                    const ownerCodeLens = new vscode.CodeLens(range, {
                        title: `👑 ${firstEdit.author} → ${lastEdit.author}`,
                        tooltip: `First: ${firstEdit.author} (${firstEdit.date})\nLast: ${lastEdit.author} (${lastEdit.date}): ${lastEdit.message}`,
                        command: "",
                    });

                    // Section 3: x authors (unclickable)
                    const authorsCodeLens = new vscode.CodeLens(range, {
                        title: `${uniqueAuthors.size} author${
                            uniqueAuthors.size !== 1 ? "s" : ""
                        }`,
                        tooltip: `${uniqueAuthors.size} unique author(s) modified this line`,
                        command: "",
                    });

                    // Section 4: x commits (clickable - opens all commits)
                    const commitsCodeLens = new vscode.CodeLens(range, {
                        title: `${history.length} commit${
                            history.length !== 1 ? "s" : ""
                        }`,
                        tooltip: `${history.length} commit(s) affected this line\nClick to see full history`,
                        command: "find-this-lines-owner.show-history",
                        arguments: [
                            lineNumber,
                            filePath,
                            workspaceFolder.uri.fsPath,
                        ],
                    });

                    codeLenses.push(
                        ownerCodeLens,
                        authorsCodeLens,
                        commitsCodeLens
                    );
                }

                // Section 5: x PRs (clickable - opens all PRs)
                if (prs.length > 0) {
                    const prsCodeLens = new vscode.CodeLens(range, {
                        title: `${prs.length} PR${prs.length !== 1 ? "s" : ""}`,
                        tooltip: `${prs.length} pull request(s) affected this line\nClick to see PRs`,
                        command: "find-this-lines-owner.show-prs",
                        arguments: [
                            lineNumber,
                            filePath,
                            workspaceFolder.uri.fsPath,
                        ],
                    });

                    codeLenses.push(prsCodeLens);
                }
            } catch (error) {
                // Silently fail - file might not be in git
            }
        }

        return codeLenses;
    }
}
