# Find This Line's Owner

Track the original author and complete history of any line of code in your Git repository. This extension helps you discover who created a line, how it evolved over time, and see all commits that affected it.

## Features

-   **Track Line Ownership**: Right-click any line and select "Find the Real Owner" to add a CodeLens that shows the original author and all contributors
-   **Complete Line History**: View the full Git history of a specific line, including all commits that modified it
-   **Author Timeline**: See who first wrote the line and who last edited it, along with commit counts and number of different authors
-   **Commit Diff Viewer**: Click on any commit in the history to see the exact changes made in that commit
-   **Automatic Caching**: History is cached for 5 minutes to improve performance

## Usage

1. **Investigate a Line**:

    - Place your cursor on any line of code
    - Right-click and select "Find the Real Owner" from the context menu
    - A CodeLens will appear above the line showing ownership information

2. **View History**:

    - Click the CodeLens to see a dropdown with all commits that affected the line
    - The original author is marked with 👑
    - Select any commit to view the full diff

3. **CodeLens Format**:
    - Single author: `👑 AuthorName • X commit(s)`
    - Multiple authors: `👑 OriginalAuthor → LastAuthor • X commit(s) • Y author(s)`

## Requirements

-   Git must be installed and the file must be in a Git repository
-   The file must have commit history in Git

## Known Issues

-   Lines in files not tracked by Git will show no history
-   Very large files may take longer to process

## Release Notes

### 0.0.1

Initial release with core functionality:

-   Line ownership tracking via CodeLens
-   Full line history viewing
-   Commit diff visualization
-   Automatic history caching
