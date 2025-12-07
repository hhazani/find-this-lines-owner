import * as vscode from "vscode";

export class GitCommitContentProvider
    implements vscode.TextDocumentContentProvider
{
    private cache = new Map<string, string>();

    setContent(uri: vscode.Uri, content: string) {
        this.cache.set(uri.toString(), content);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.cache.get(uri.toString()) || "";
    }
}
