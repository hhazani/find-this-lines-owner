import { exec } from "child_process";
import * as path from "path";
import { LineHistoryEntry, PullRequestInfo } from "./types";

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

export async function getPullRequestsForLine(
    filePath: string,
    lineNumber: number,
    workspaceRoot: string
): Promise<PullRequestInfo[]> {
    return new Promise((resolve, reject) => {
        const relativePath = path.relative(workspaceRoot, filePath);
        // First get commits that touched this line
        const command = `git log -L ${lineNumber},${lineNumber}:"${relativePath}" --pretty=format:"%H" --no-patch`;

        exec(
            command,
            { cwd: workspaceRoot },
            async (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    resolve([]);
                    return;
                }

                const commitHashes = stdout
                    .trim()
                    .split("\n")
                    .filter((h) => h);
                if (commitHashes.length === 0) {
                    resolve([]);
                    return;
                }

                // Get PR information for each commit
                const prSet = new Map<string, PullRequestInfo>();

                for (const hash of commitHashes) {
                    try {
                        const pr = await getPRForCommit(hash, workspaceRoot);
                        if (pr) {
                            prSet.set(pr.number, pr);
                        }
                    } catch (e) {
                        // Ignore errors for individual commits
                    }
                }

                resolve(Array.from(prSet.values()));
            }
        );
    });
}

async function getPRForCommit(
    commitHash: string,
    workspaceRoot: string
): Promise<PullRequestInfo | null> {
    return new Promise((resolve) => {
        // Try to extract PR number from commit message
        const command = `git log -1 --pretty=format:"%s|%an|%ad" --date=relative ${commitHash}`;

        exec(
            command,
            { cwd: workspaceRoot },
            (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    resolve(null);
                    return;
                }

                const [message, author, date] = stdout.split("|");

                // Look for PR patterns like #123, (#123), PR #123, or "Merge pull request #123"
                const prPatterns = [
                    /Merge pull request #(\d+)/i,
                    /\(#(\d+)\)/,
                    /#(\d+)/,
                ];

                for (const pattern of prPatterns) {
                    const match = message.match(pattern);
                    if (match) {
                        const prNumber = match[1];

                        // Try to get remote URL for constructing PR URL
                        exec(
                            "git config --get remote.origin.url",
                            { cwd: workspaceRoot },
                            (err, remoteUrl) => {
                                let url = "";
                                if (!err && remoteUrl) {
                                    const trimmedUrl = remoteUrl.trim();
                                    // Convert git URL to https GitHub URL
                                    let repoUrl = trimmedUrl
                                        .replace(
                                            /^git@github\.com:/,
                                            "https://github.com/"
                                        )
                                        .replace(/\.git$/, "");
                                    url = `${repoUrl}/pull/${prNumber}`;
                                }

                                resolve({
                                    number: prNumber,
                                    title: message,
                                    url: url,
                                    author: author || "",
                                    mergedDate: date || "",
                                });
                            }
                        );
                        return;
                    }
                }

                resolve(null);
            }
        );
    });
}
