export interface LineHistoryEntry {
    hash: string;
    fullHash: string;
    author: string;
    email: string;
    date: string;
    message: string;
}

export interface PullRequestInfo {
    number: string;
    title: string;
    url: string;
    author: string;
    mergedDate: string;
}
