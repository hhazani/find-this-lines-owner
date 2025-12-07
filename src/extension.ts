import * as vscode from "vscode";
import { GitCommitContentProvider } from "./gitCommitContentProvider";
import { LineOwnerCodeLensProvider } from "./lineOwnerCodeLensProvider";
import {
    registerShowHistoryCommand,
    registerInvestigateLineCommand,
} from "./commands";

export function activate(context: vscode.ExtensionContext) {
    const gitContentProvider = new GitCommitContentProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            "git-commit",
            gitContentProvider
        )
    );

    const codeLensProvider = new LineOwnerCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider("*", codeLensProvider)
    );

    const cacheTimer = setInterval(() => {
        codeLensProvider.clearCache();
    }, 5 * 60 * 1000);

    context.subscriptions.push({
        dispose: () => clearInterval(cacheTimer),
    });

    registerShowHistoryCommand(context, gitContentProvider);
    registerInvestigateLineCommand(context, codeLensProvider);
}

export function deactivate() {}
