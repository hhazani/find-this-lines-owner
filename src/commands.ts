import * as vscode from "vscode";
import * as path from "path";
import { LineHistoryEntry, PullRequestInfo } from "./types";
import {
    getLineHistory,
    getFileContentAtCommit,
    getPullRequestsForLine,
} from "./gitService";
import { GitCommitContentProvider } from "./gitCommitContentProvider";
import { LineOwnerCodeLensProvider } from "./lineOwnerCodeLensProvider";

export function registerShowHistoryCommand(
    context: vscode.ExtensionContext,
    gitContentProvider: GitCommitContentProvider
) {
    const command = vscode.commands.registerCommand(
        "find-this-lines-owner.show-history",
        async (line: number, filePath: string, workspaceRoot: string) => {
            try {
                const history = await getLineHistory(
                    filePath,
                    line + 1,
                    workspaceRoot
                );
                if (history.length === 0) {
                    vscode.window.showInformationMessage(
                        "No git history found for this line"
                    );
                    return;
                }

                const items = history.map((entry, index) => ({
                    label: `${index === history.length - 1 ? "👑" : "📝"} ${
                        entry.author
                    }`,
                    description: `${entry.hash} • ${entry.date}`,
                    detail: entry.message,
                    commit: entry,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `${history.length} commit(s) affected line ${
                        line + 1
                    }`,
                    title: "🔍 Line History",
                    matchOnDescription: true,
                    matchOnDetail: true,
                });

                if (selected) {
                    await showCommitChanges(
                        selected.commit,
                        filePath,
                        workspaceRoot,
                        gitContentProvider
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        }
    );

    context.subscriptions.push(command);
}

export function registerShowPRsCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand(
        "find-this-lines-owner.show-prs",
        async (line: number, filePath: string, workspaceRoot: string) => {
            try {
                const prs = await getPullRequestsForLine(
                    filePath,
                    line + 1,
                    workspaceRoot
                );
                if (prs.length === 0) {
                    vscode.window.showInformationMessage(
                        "No pull requests found for this line"
                    );
                    return;
                }

                const items = prs.map((pr) => ({
                    label: `🔀 PR #${pr.number}`,
                    description: `${pr.author} • ${pr.mergedDate}`,
                    detail: pr.title,
                    pr: pr,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `${prs.length} pull request(s) affected line ${
                        line + 1
                    }`,
                    title: "🔍 Pull Requests",
                    matchOnDescription: true,
                    matchOnDetail: true,
                });

                if (selected && selected.pr.url) {
                    await vscode.env.openExternal(
                        vscode.Uri.parse(selected.pr.url)
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        }
    );

    context.subscriptions.push(command);
}

export function registerInvestigateLineCommand(
    context: vscode.ExtensionContext,
    codeLensProvider: LineOwnerCodeLensProvider
) {
    const command = vscode.commands.registerCommand(
        "find-this-lines-owner.investigate-line",
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active editor found");
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const lineNumber = selection.active.line + 1;
            const filePath = document.uri.fsPath;

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                document.uri
            );
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("File is not in a workspace");
                return;
            }

            try {
                const history = await getLineHistory(
                    filePath,
                    lineNumber,
                    workspaceFolder.uri.fsPath
                );
                if (history.length === 0) {
                    vscode.window.showInformationMessage(
                        "No git history found for this line"
                    );
                    return;
                }

                codeLensProvider.addLine(filePath, lineNumber - 1);

                vscode.window.showInformationMessage(
                    `CodeLens added for line ${lineNumber}. Click the CodeLens to see history.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        }
    );

    context.subscriptions.push(command);
}

async function showCommitChanges(
    commit: LineHistoryEntry,
    filePath: string,
    workspaceRoot: string,
    contentProvider: GitCommitContentProvider
): Promise<void> {
    try {
        const relativePath = path.relative(workspaceRoot, filePath);
        const fileName = path.basename(relativePath);

        const afterContent = await getFileContentAtCommit(
            commit.fullHash,
            relativePath,
            workspaceRoot
        );

        const beforeContent = await getFileContentAtCommit(
            `${commit.fullHash}~1`,
            relativePath,
            workspaceRoot
        );

        const beforeUri = vscode.Uri.parse(
            `git-commit:${fileName}?ref=${commit.fullHash}~1`
        );
        const afterUri = vscode.Uri.parse(
            `git-commit:${fileName}?ref=${commit.fullHash}`
        );

        contentProvider.setContent(beforeUri, beforeContent);
        contentProvider.setContent(afterUri, afterContent);

        const title = `${fileName} (${commit.hash}) - ${commit.message}`;
        await vscode.commands.executeCommand(
            "vscode.diff",
            beforeUri,
            afterUri,
            title,
            { viewColumn: vscode.ViewColumn.Active }
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to show commit diff: ${error}`);
    }
}
