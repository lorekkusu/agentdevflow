import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  opendir,
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

import type { RenderReadWorkspace } from "../renderer/contract.js";
import {
  validatePrivateConvergentMutationIntent,
  type PrivateConvergentMutationIntent,
} from "./private-convergent-intent.js";

export type PrivateFilesystemWorkspaceErrorCode =
  | "UNSAFE_WORKSPACE_PATH"
  | "WORKSPACE_ROOT_NOT_DIRECTORY"
  | "WORKSPACE_ROOT_SYMLINK"
  | "WORKSPACE_PATH_SYMLINK"
  | "WORKSPACE_PATH_NOT_FILE"
  | "WORKSPACE_PATH_NOT_DIRECTORY"
  | "WORKSPACE_FILE_INVALID_UTF8"
  | "WORKSPACE_FILE_TOO_LARGE"
  | "WORKSPACE_DIRECTORY_TOO_LARGE"
  | "WORKSPACE_PARENT_NOT_DIRECTORY"
  | "WORKSPACE_OWNED_TEMPORARY_CONFLICT"
  | "WORKSPACE_OWNED_TEMPORARY_INVALID"
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

export type PrivateConvergentWriteEvent =
  | { readonly kind: "temporary-ready"; readonly targetPath: string }
  | { readonly kind: "temporary-synced"; readonly targetPath: string }
  | { readonly kind: "target-replaced"; readonly targetPath: string };

export type PrivateConvergentWriteFaultInjector = (
  event: PrivateConvergentWriteEvent,
) => void | Promise<void>;

export interface PrivateConvergentAllowedDigests {
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
}

export type PrivateConvergentMutationOutcome =
  | "applied"
  | "already-applied"
  | "drift";

export interface PrivateConvergentWorkspace extends RenderReadWorkspace {
  writeConvergently(
    intent: PrivateConvergentMutationIntent,
    content: string,
    allowedDigests: PrivateConvergentAllowedDigests,
    faultInjector?: PrivateConvergentWriteFaultInjector,
  ): Promise<PrivateConvergentMutationOutcome>;
  discardConvergentTemporary(
    intent: PrivateConvergentMutationIntent,
  ): Promise<"absent" | "removed">;
  removeAtomically(
    path: string,
    allowedDigests: PrivateConvergentAllowedDigests,
  ): Promise<PrivateConvergentMutationOutcome>;
}

export interface PrivateFilesystemReadWorkspace {
  read(path: string): Promise<string | null>;
  readBounded(path: string, maxBytes: number): Promise<string | null>;
  listDirectoryBounded(
    path: string,
    maxEntries: number,
  ): Promise<readonly PrivateFilesystemDirectoryEntry[] | null>;
}

export type PrivateFilesystemDirectoryEntryKind =
  | "directory"
  | "file"
  | "other"
  | "symbolic-link";

export interface PrivateFilesystemDirectoryEntry {
  readonly name: string;
  readonly kind: PrivateFilesystemDirectoryEntryKind;
}

let temporaryFileSequence = 0;
const digestPattern = /^[a-f0-9]{64}$/u;

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

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

function notDirectory(path: string): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_PATH_NOT_DIRECTORY",
    `Workspace path is not a directory: ${path}`,
    path,
  );
}

function fileTooLarge(path: string, maxBytes: number): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_FILE_TOO_LARGE",
    `Workspace file exceeds the configured byte limit ${maxBytes}: ${path}`,
    path,
  );
}

function directoryTooLarge(path: string, maxEntries: number): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_DIRECTORY_TOO_LARGE",
    `Workspace directory exceeds the configured entry limit ${maxEntries}: ${path}`,
    path,
  );
}

function invalidUtf8(path: string): never {
  throw new PrivateFilesystemWorkspaceError(
    "WORKSPACE_FILE_INVALID_UTF8",
    `Workspace file is not valid UTF-8: ${path}`,
    path,
  );
}

function validateAllowedDigests(
  allowedDigests: PrivateConvergentAllowedDigests,
  path: string,
): void {
  if (
    (allowedDigests.beforeDigest !== null &&
      !digestPattern.test(allowedDigests.beforeDigest)) ||
    (allowedDigests.afterDigest !== null &&
      !digestPattern.test(allowedDigests.afterDigest)) ||
    (allowedDigests.beforeDigest === null &&
      allowedDigests.afterDigest === null)
  ) {
    throw new PrivateFilesystemWorkspaceError(
      "WORKSPACE_OWNED_TEMPORARY_INVALID",
      "Convergent mutation allowed digests are invalid.",
      path,
    );
  }
}

export class PrivateFilesystemWorkspace
  implements PrivateConvergentWorkspace
{
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
    return new PrivateFilesystemWorkspace(await realpath(requestedRoot));
  }

  static async openReadOnly(
    root: string,
  ): Promise<PrivateFilesystemReadWorkspace> {
    const workspace = await PrivateFilesystemWorkspace.open(root);
    return {
      read(path: string): Promise<string | null> {
        return workspace.read(path);
      },
      readBounded(path: string, maxBytes: number): Promise<string | null> {
        return workspace.readBounded(path, maxBytes);
      },
      listDirectoryBounded(
        path: string,
        maxEntries: number,
      ): Promise<readonly PrivateFilesystemDirectoryEntry[] | null> {
        return workspace.listDirectoryBounded(path, maxEntries);
      },
    };
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

  async readBounded(path: string, maxBytes: number): Promise<string | null> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
      throw new Error("maxBytes must be a non-negative safe integer.");
    }
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
      const fileStat = await handle.stat();
      if (!fileStat.isFile()) {
        return notRegularFile(safePath.relativePath);
      }
      if (fileStat.size > maxBytes) {
        return fileTooLarge(safePath.relativePath, maxBytes);
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      while (true) {
        const remaining = maxBytes - totalBytes;
        const buffer = Buffer.allocUnsafe(Math.min(65_536, remaining + 1));
        const { bytesRead } = await handle.read(
          buffer,
          0,
          buffer.byteLength,
          null,
        );
        if (bytesRead === 0) {
          break;
        }
        totalBytes += bytesRead;
        if (totalBytes > maxBytes) {
          return fileTooLarge(safePath.relativePath, maxBytes);
        }
        chunks.push(buffer.subarray(0, bytesRead));
      }

      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.concat(chunks, totalBytes),
        );
      } catch {
        return invalidUtf8(safePath.relativePath);
      }
    } finally {
      await handle.close();
    }
  }

  async listDirectoryBounded(
    path: string,
    maxEntries: number,
  ): Promise<readonly PrivateFilesystemDirectoryEntry[] | null> {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 0) {
      throw new Error("maxEntries must be a non-negative safe integer.");
    }
    const safePath = this.resolvePath(path);
    if ((await this.ensureParent(safePath, false)) === null) {
      return null;
    }

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
    if (!entry.isDirectory()) {
      return notDirectory(safePath.relativePath);
    }

    const canonicalDirectory = await realpath(safePath.absolutePath);
    if (!pathIsWithinRoot(this.canonicalRoot, canonicalDirectory)) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_PATH_ESCAPES_ROOT",
        `Workspace path escapes the repository root: ${safePath.relativePath}`,
        safePath.relativePath,
      );
    }

    let directory: Awaited<ReturnType<typeof opendir>>;
    try {
      directory = await opendir(canonicalDirectory);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }
      if (isNodeErrorWithCode(error, "ELOOP")) {
        return symlinkPath(safePath.relativePath);
      }
      if (isNodeErrorWithCode(error, "ENOTDIR")) {
        return notDirectory(safePath.relativePath);
      }
      throw error;
    }

    const entries: PrivateFilesystemDirectoryEntry[] = [];
    try {
      while (true) {
        const child = await directory.read();
        if (child === null) {
          break;
        }
        if (entries.length >= maxEntries) {
          return directoryTooLarge(safePath.relativePath, maxEntries);
        }
        const kind: PrivateFilesystemDirectoryEntryKind =
          child.isFile()
            ? "file"
            : child.isDirectory()
              ? "directory"
              : child.isSymbolicLink()
                ? "symbolic-link"
                : "other";
        entries.push({ name: child.name, kind });
      }
    } finally {
      await directory.close();
    }
    return entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
  }

  private convergentPaths(intent: PrivateConvergentMutationIntent): {
    readonly target: SafeWorkspacePath;
    readonly temporary: SafeWorkspacePath;
  } {
    try {
      validatePrivateConvergentMutationIntent(intent);
    } catch (error) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_OWNED_TEMPORARY_INVALID",
        `Convergent temporary intent is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const target = this.resolvePath(intent.targetPath);
    const temporary = this.resolvePath(intent.temporaryPath);
    if (
      posix.dirname(target.relativePath) !==
      posix.dirname(temporary.relativePath)
    ) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_OWNED_TEMPORARY_INVALID",
        "Convergent temporary file must share its target directory.",
        intent.targetPath,
      );
    }
    return { target, temporary };
  }

  async writeConvergently(
    intent: PrivateConvergentMutationIntent,
    content: string,
    allowedDigests: PrivateConvergentAllowedDigests,
    faultInjector?: PrivateConvergentWriteFaultInjector,
  ): Promise<PrivateConvergentMutationOutcome> {
    const paths = this.convergentPaths(intent);
    validateAllowedDigests(allowedDigests, intent.targetPath);
    if (
      allowedDigests.afterDigest !== intent.targetDigest ||
      digest(content) !== intent.targetDigest
    ) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_OWNED_TEMPORARY_INVALID",
        "Convergent temporary content and allowed target digest must match the intent.",
        intent.targetPath,
      );
    }
    const parent = await this.ensureParent(paths.target, true);
    if (parent === null) {
      throw new Error("Workspace parent creation did not complete.");
    }
    if ((await this.ensureParent(paths.temporary, false)) !== parent) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_OWNED_TEMPORARY_INVALID",
        "Convergent temporary parent does not match the target parent.",
        intent.targetPath,
      );
    }
    const existing = await this.inspectLeaf(paths.target);
    const temporary = await this.inspectLeaf(paths.temporary);
    if (temporary !== null) {
      await unlink(paths.temporary.absolutePath);
    }
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(
        paths.temporary.absolutePath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        existing?.mode === undefined ? 0o666 : existing.mode & 0o777,
      );
    } catch (error) {
      if (isNodeErrorWithCode(error, "ELOOP")) {
        return symlinkPath(intent.temporaryPath);
      }
      if (isNodeErrorWithCode(error, "EEXIST")) {
        throw new PrivateFilesystemWorkspaceError(
          "WORKSPACE_OWNED_TEMPORARY_CONFLICT",
          "Convergent temporary path changed during acquisition.",
          intent.temporaryPath,
        );
      }
      throw error;
    }

    let handleOpen = true;
    try {
      await faultInjector?.({
        kind: "temporary-ready",
        targetPath: intent.targetPath,
      });
      await handle.writeFile(content, "utf8");
      await handle.sync();
      await faultInjector?.({
        kind: "temporary-synced",
        targetPath: intent.targetPath,
      });
      await handle.close();
      handleOpen = false;
      await this.ensureParent(paths.target, false);
      await this.inspectLeaf(paths.target);
      const currentContent = await this.read(intent.targetPath);
      const currentDigest =
        currentContent === null ? null : digest(currentContent);
      if (currentDigest === allowedDigests.afterDigest) {
        await unlink(paths.temporary.absolutePath);
        return "already-applied";
      }
      if (currentDigest !== allowedDigests.beforeDigest) {
        await unlink(paths.temporary.absolutePath);
        return "drift";
      }
      await rename(paths.temporary.absolutePath, paths.target.absolutePath);
      await faultInjector?.({
        kind: "target-replaced",
        targetPath: intent.targetPath,
      });
      return "applied";
    } finally {
      if (handleOpen) {
        await handle.close();
      }
    }
  }

  async discardConvergentTemporary(
    intent: PrivateConvergentMutationIntent,
  ): Promise<"absent" | "removed"> {
    const { temporary } = this.convergentPaths(intent);
    const parent = await this.ensureParent(temporary, false);
    if (parent === null || (await this.inspectLeaf(temporary)) === null) {
      return "absent";
    }
    await unlink(temporary.absolutePath);
    return "removed";
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

  async removeAtomically(
    path: string,
    allowedDigests: PrivateConvergentAllowedDigests,
  ): Promise<PrivateConvergentMutationOutcome> {
    validateAllowedDigests(allowedDigests, path);
    if (
      allowedDigests.beforeDigest === null ||
      allowedDigests.afterDigest !== null
    ) {
      throw new PrivateFilesystemWorkspaceError(
        "WORKSPACE_OWNED_TEMPORARY_INVALID",
        "Convergent removal requires a before digest and a null after digest.",
        path,
      );
    }
    const safePath = this.resolvePath(path);
    if ((await this.ensureParent(safePath, false)) === null) {
      return "already-applied";
    }
    if ((await this.inspectLeaf(safePath)) === null) {
      return "already-applied";
    }
    const currentContent = await this.read(path);
    if (currentContent === null) {
      return "already-applied";
    }
    if (digest(currentContent) !== allowedDigests.beforeDigest) {
      return "drift";
    }
    try {
      await unlink(safePath.absolutePath);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return "already-applied";
      }
      throw error;
    }
    const parent = await this.ensureParent(safePath, false);
    if (parent === null) {
      throw new Error("Workspace parent disappeared after file removal.");
    }
    return "applied";
  }
}
