import { constants, type Stats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import {
  basename,
  join,
  posix,
  resolve,
  sep,
} from "node:path";

import type { RenderWorkspace } from "../renderer/contract.js";

export type PrivateFilesystemWorkspaceErrorCode =
  | "UNSAFE_WORKSPACE_PATH"
  | "WORKSPACE_ROOT_NOT_DIRECTORY"
  | "WORKSPACE_ROOT_SYMLINK"
  | "WORKSPACE_PATH_SYMLINK"
  | "WORKSPACE_PATH_NOT_FILE"
  | "WORKSPACE_PARENT_NOT_DIRECTORY"
  | "WORKSPACE_PATH_ESCAPES_ROOT";

export class PrivateFilesystemWorkspaceError extends Error {
  override readonly name = "PrivateFilesystemWorkspaceError";

  constructor(
    readonly code: PrivateFilesystemWorkspaceErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

interface SafeWorkspacePath {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly segments: readonly string[];
}

interface TemporaryFile {
  readonly path: string;
  readonly handle: Awaited<ReturnType<typeof open>>;
}

let temporaryFileSequence = 0;

function isNodeErrorWithCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error &&
    "code" in error &&
    error.code === code;
}

function pathIsWithinRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function unsafePath(path: string): never {
  throw new PrivateFilesystemWorkspaceError(
    "UNSAFE_WORKSPACE_PATH",
    `Workspace path is unsafe: ${path}`,
    path,
  );
}

function symlinkPath(path: string): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_PATH_SYMLINK",
    `Workspace path traverses a symbolic link: ${path}`,
    path,
  );
}

function notRegularFile(path: string): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_PATH_NOT_FILE",
    `Workspace path is not a regular file: ${path}`,
    path,
  );
}

export class PrivateFilesystemWorkspace implements RenderWorkspace {
  private constructor(private readonly canonicalRoot: string) {}

  static async open(root: string): Promise<PrivateFilesystemWorkspace> {
    const requestedRoot = resolve(root);
    let rootStat: Stats;
    try {
      rootStat = await lstat(requestedRoot);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        throw new PrivateFilesystemWorkspaceError(
          "WORKSPACE_ROOT_NOT_DIRECTORY",
          "Workspace root must be an existing directory.",
        );
      }
      throw error;
    }
    if (rootStat.isSymbolicLink()) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_ROOT_SYMLINK",
        "Workspace root must not be a symbolic link.",
      );
    }
    if (!rootStat.isDirectory()) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_ROOT_NOT_DIRECTORY",
        "Workspace root must be an existing directory.",
      );
    }

    const canonicalRoot = await realpath(requestedRoot);
    return new PrivateFilesystemWorkspace(canonicalRoot);
  }

  private resolvePath(path: string): SafeWorkspacePath {
    if (
      path.length === 0 ||
      path.trim() !== path ||
      /[\u0000-\u001f\u007f]/u.test(path) ||
      path.includes("\\") ||
      path === "." ||
      path === ".." ||
      path.startsWith("../") ||
      posix.isAbsolute(path) ||
      posix.normalize(path) !== path
    ) {
      return unsafePath(path);
    }

    const segments = path.split("/");
    const absolutePath = resolve(this.canonicalRoot, ...segments);
    if (!pathIsWithinRoot(this.canonicalRoot, absolutePath)) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_PATH_ESCAPES_ROOT",
        `Workspace path escapes the repository root: ${path}`,
        path,
      );
    }
    return { relativePath: path, absolutePath, segments };
  }

  private async ensureParent(
    safePath: SafeWorkspacePath,
    create: boolean,
  ): Promise<string | null> {
    let current = this.canonicalRoot;
    const parentSegments = safePath.segments.slice(0, -1);
    for (const [index, segment] of parentSegments.entries()) {
      current = join(current, segment);
      const displayedPath = parentSegments.slice(0, index + 1).join("/");
      let entry: Stats;
      try {
        entry = await lstat(current);
      } catch (error) {
        if (!isNodeErrorWithCode(error, "ENOENT")) {
          throw error;
        }
        if (!create) {
          return null;
        }
        try {
          await mkdir(current, { mode: 0o755 });
        } catch (mkdirError) {
          if (!isNodeErrorWithCode(mkdirError, "EEXIST")) {
            throw mkdirError;
          }
        }
        entry = await lstat(current);
      }

      if (entry.isSymbolicLink()) {
        return symlinkPath(displayedPath);
      }
      if (!entry.isDirectory()) {
        throw new PrivateFilesystemWorkspaceError(
          "WORKSPACE_PARENT_NOT_DIRECTORY",
          `Workspace parent path is not a directory: ${displayedPath}`,
          displayedPath,
        );
      }
    }

    const canonicalParent = await realpath(current);
    if (!pathIsWithinRoot(this.canonicalRoot, canonicalParent)) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_PATH_ESCAPES_ROOT",
        `Workspace path escapes the repository root: ${safePath.relativePath}`,
        safePath.relativePath,
      );
    }
    return canonicalParent;
  }

  private async inspectLeaf(
    safePath: SafeWorkspacePath,
  ): Promise<Stats | null> {
    let entry: Stats;
    try {
      entry = await lstat(safePath.absolutePath);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }
      throw error;
    }
    if (entry.isSymbolicLink()) {
      return symlinkPath(safePath.relativePath);
    }
    if (!entry.isFile()) {
      return notRegularFile(safePath.relativePath);
    }
    return entry;
  }

  private async createTemporaryFile(
    parent: string,
    targetPath: string,
    mode: number,
  ): Promise<TemporaryFile> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      temporaryFileSequence += 1;
      const name = `.${basename(targetPath)}.agentdevflow-${process.pid}-${temporaryFileSequence}.tmp`;
      const path = join(parent, name);
      try {
        return {
          path,
          handle: await open(
            path,
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
            mode,
          ),
        };
      } catch (error) {
        if (!isNodeErrorWithCode(error, "EEXIST")) {
          throw error;
        }
      }
    }
    throw new Error("Unable to allocate a private workspace temporary file.");
  }

  async read(path: string): Promise<string | null> {
    const safePath = this.resolvePath(path);
    if ((await this.ensureParent(safePath, false)) === null) {
      return null;
    }
    if ((await this.inspectLeaf(safePath)) === null) {
      return null;
    }

    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(
        safePath.absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }
      if (isNodeErrorWithCode(error, "ELOOP")) {
        return symlinkPath(safePath.relativePath);
      }
      throw error;
    }
    try {
      if (!(await handle.stat()).isFile()) {
        return notRegularFile(safePath.relativePath);
      }
      return await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  }

  async writeAtomically(path: string, content: string): Promise<void> {
    const safePath = this.resolvePath(path);
    const parent = await this.ensureParent(safePath, true);
    if (parent === null) {
      throw new Error("Workspace parent creation did not complete.");
    }
    const existing = await this.inspectLeaf(safePath);
    const temporary = await this.createTemporaryFile(
      parent,
      safePath.absolutePath,
      existing?.mode === undefined ? 0o666 : existing.mode & 0o777,
    );
    let handleOpen = true;
    let temporaryExists = true;
    try {
      await temporary.handle.writeFile(content, "utf8");
      await temporary.handle.sync();
      await temporary.handle.close();
      handleOpen = false;

      await this.ensureParent(safePath, false);
      await this.inspectLeaf(safePath);
      await rename(temporary.path, safePath.absolutePath);
      temporaryExists = false;
    } finally {
      if (handleOpen) {
        await temporary.handle.close();
      }
      if (temporaryExists) {
        try {
          await unlink(temporary.path);
        } catch (error) {
          if (!isNodeErrorWithCode(error, "ENOENT")) {
            throw error;
          }
        }
      }
    }
  }

  async createExclusively(path: string, content: string): Promise<boolean> {
    const safePath = this.resolvePath(path);
    const parent = await this.ensureParent(safePath, true);
    if (parent === null) {
      throw new Error("Workspace parent creation did not complete.");
    }
    if ((await this.inspectLeaf(safePath)) !== null) {
      return false;
    }

    const temporary = await this.createTemporaryFile(
      parent,
      safePath.absolutePath,
      0o600,
    );
    let handleOpen = true;
    try {
      await temporary.handle.writeFile(content, "utf8");
      await temporary.handle.sync();
      await temporary.handle.close();
      handleOpen = false;

      if ((await this.ensureParent(safePath, false)) === null) {
        throw new Error("Workspace parent disappeared before exclusive creation.");
      }
      if ((await this.inspectLeaf(safePath)) !== null) {
        return false;
      }
      try {
        await link(temporary.path, safePath.absolutePath);
        return true;
      } catch (error) {
        if (isNodeErrorWithCode(error, "EEXIST")) {
          return false;
        }
        throw error;
      }
    } finally {
      if (handleOpen) {
        await temporary.handle.close();
      }
      try {
        await unlink(temporary.path);
      } catch (error) {
        if (!isNodeErrorWithCode(error, "ENOENT")) {
          throw error;
        }
      }
    }
  }

  async removeIfContentMatches(
    path: string,
    expectedContent: string,
  ): Promise<boolean> {
    if ((await this.read(path)) !== expectedContent) {
      return false;
    }
    if ((await this.read(path)) !== expectedContent) {
      return false;
    }
    await this.removeAtomically(path);
    return true;
  }

  async removeAtomically(path: string): Promise<void> {
    const safePath = this.resolvePath(path);
    if ((await this.ensureParent(safePath, false)) === null) {
      return;
    }
    if ((await this.inspectLeaf(safePath)) === null) {
      return;
    }
    await unlink(safePath.absolutePath);
  }
}
