import path from "node:path";

export function formatDiffReviewCommand(relativePath: string): string {
  return `Review command: git diff -- ${toCommandPath(relativePath)}`;
}

export function formatWrittenFileReviewHint(relativePath: string): string {
  return [
    `Review command: readFile ${toCommandPath(relativePath)}`,
    `Git status command: git status --short`,
  ].join("\n");
}

function toCommandPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}
