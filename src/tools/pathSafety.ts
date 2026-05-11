import path from "node:path";

// 把模型给的路径解析成项目内的安全绝对路径。
export function resolveSafePath(filePath: string): string {
  const projectRoot = process.cwd();
  const resolvedPath = path.resolve(projectRoot, filePath);

  if (!resolvedPath.startsWith(projectRoot + path.sep) && resolvedPath !== projectRoot) {
    throw new Error("工具只能访问当前项目目录内的路径");
  }

  if (isSensitivePath(resolvedPath)) {
    throw new Error("工具不允许访问敏感路径");
  }

  return resolvedPath;
}

export function isSensitivePath(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  const fileName = path.basename(normalizedPath);

  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    normalizedPath.includes(`${path.sep}.git${path.sep}`) ||
    normalizedPath.includes(`${path.sep}.ssh${path.sep}`) ||
    normalizedPath.includes("id_rsa") ||
    normalizedPath.includes("token") ||
    normalizedPath.includes("secret")
  );
}
