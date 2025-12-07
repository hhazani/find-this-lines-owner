import { exec } from "child_process";
import * as path from "path";
import { LineHistoryEntry } from "./types";

export async function getLineHistory(
    filePath: string,
    lineNumber: number,
    workspaceRoot: string
): Promise<LineHistoryEntry[]> {
    return new Promise((resolve, reject) => {
        const relativePath = path.relative(workspaceRoot, filePath);
        const command = `git log -L ${lineNumber},${lineNumber}:"${relativePath}" --pretty=format:"%H|%an|%ae|%ad|%s" --date=relative`;

        exec(
            command,
            { cwd: workspaceRoot },
            (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    if (stderr.includes("not a git repository")) {
                        reject("This file is not in a git repository");
                    } else {
                        reject(`Git error: ${stderr || error.message}`);
                    }
                    return;
                }

                const lines = stdout.trim().split("\n");
                const history: LineHistoryEntry[] = [];

                for (const line of lines) {
                    if (line && line.includes("|")) {
                        const [hash, author, email, date, ...messageParts] =
                            line.split("|");
                        history.push({
                            hash: hash.substring(0, 8),
                            fullHash: hash,
                            author,
                            email,
                            date,
                            message: messageParts.join("|").trim(),
                        });
                    }
                }

                resolve(history);
            }
        );
    });
}

export function getFileContentAtCommit(
    commitRef: string,
    relativePath: string,
    workspaceRoot: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const gitPath = relativePath.replace(/\\/g, "/");
        const command = `git show ${commitRef}:"${gitPath}"`;

        exec(
            command,
            { cwd: workspaceRoot, maxBuffer: 1024 * 1024 * 10 },
            (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    console.error(
                        `Git error for ${commitRef}:${gitPath}:`,
                        stderr
                    );
                    resolve("");
                    return;
                }
                resolve(stdout);
            }
        );
    });
}
