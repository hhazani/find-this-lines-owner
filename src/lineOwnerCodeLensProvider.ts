import * as vscode from "vscode";
import { LineHistoryEntry } from "./types";
import { getLineHistory } from "./gitService";

export class LineOwnerCodeLensProvider implements vscode.CodeLensProvider {
    private trackedLines = new Map<string, Set<number>>();
    private historyCache = new Map<string, LineHistoryEntry[]>();
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    addLine(filePath: string, lineNumber: number) {
        if (!this.trackedLines.has(filePath)) {
            this.trackedLines.set(filePath, new Set());
        }
        this.trackedLines.get(filePath)!.add(lineNumber);
        this.historyCache.delete(`${filePath}:${lineNumber}`);
        this._onDidChangeCodeLenses.fire();
    }

    clearCache() {
        this.historyCache.clear();
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

                if (!history) {
                    history = await getLineHistory(
                        filePath,
                        lineNumber + 1,
                        workspaceFolder.uri.fsPath
                    );
                    this.historyCache.set(cacheKey, history);
                }

                if (history.length > 0) {
                    const uniqueAuthors = new Set(history.map((h) => h.author));
                    const lastEdit = history[0];
                    const firstEdit = history[history.length - 1];

                    const range = new vscode.Range(
                        lineNumber,
                        0,
                        lineNumber,
                        0
                    );

                    let title: string;
                    let tooltip: string;

                    if (uniqueAuthors.size === 1) {
                        title = `👑 ${firstEdit.author} • ${history.length} commit(s)`;
                        tooltip = `Last edit: ${lastEdit.date}\n${lastEdit.message}\nClick to see full history`;
                    } else {
                        title = `👑 ${firstEdit.author} → ${lastEdit.author} • ${history.length} commit(s) • ${uniqueAuthors.size} author(s)`;
                        tooltip = `First: ${firstEdit.author} (${firstEdit.date})\nLast: ${lastEdit.author} (${lastEdit.date}): ${lastEdit.message}\nClick to see full history`;
                    }

                    const codeLens = new vscode.CodeLens(range, {
                        title,
                        tooltip,
                        command: "find-this-lines-owner.show-history",
                        arguments: [
                            lineNumber,
                            filePath,
                            workspaceFolder.uri.fsPath,
                        ],
                    });

                    codeLenses.push(codeLens);
                }
            } catch (error) {
                // Silently fail - file might not be in git
            }
        }

        return codeLenses;
    }
}
