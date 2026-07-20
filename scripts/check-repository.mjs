import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".bash",
  ".cjs",
  ".conf",
  ".css",
  ".cts",
  ".gql",
  ".graphql",
  ".html",
  ".ini",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".mts",
  ".properties",
  ".scss",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);
const textBasenames = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".npmignore",
  "Dockerfile",
  "LICENSE",
]);

function isTextFile(name) {
  return (
    textExtensions.has(extname(name)) ||
    textBasenames.has(name) ||
    name.startsWith(".env")
  );
}

const disclosurePatterns = [
  {
    code: "NON_ENGLISH_CJK",
    pattern: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u,
    message: "Repository text must be written in English.",
  },
  {
    code: "LOCAL_USER_PATH",
    pattern: /\/Users\/[^/\s]+(?:\/|$)/u,
    message: "Remove the local macOS user path.",
  },
  {
    code: "LOCAL_USER_PATH",
    pattern: /\/home\/[^/\s]+(?:\/|$)/u,
    message: "Remove the local Unix user path.",
  },
  {
    code: "LOCAL_USER_PATH",
    pattern: /[A-Za-z]:\\Users\\[^\\\s]+(?:\\|$)/u,
    message: "Remove the local Windows user path.",
  },
  {
    code: "PRIVATE_KEY",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
    message: "Remove private key material.",
  },
  {
    code: "TOKEN_PATTERN",
    pattern: /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})/u,
    message: "Remove the credential-like token.",
  },
];

const forbiddenTranscriptMarkers = [
  ["<environment", "_context>"].join(""),
  ["<skills", "_instructions>"].join(""),
  ["MEMORY_SUMMARY", " BEGINS"].join(""),
];

async function collectTextFiles(directory = root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name === ".DS_Store") {
      continue;
    }
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectTextFiles(absolutePath)));
      }
    } else if (entry.isFile() && isTextFile(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function inspectDisclosure(relativePath, content) {
  const diagnostics = [];

  for (const rule of disclosurePatterns) {
    const match = rule.pattern.exec(content);
    if (match?.index !== undefined) {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, match.index),
        code: rule.code,
        message: rule.message,
      });
    }
  }

  for (const marker of forbiddenTranscriptMarkers) {
    const index = content.indexOf(marker);
    if (index >= 0) {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, index),
        code: "TRANSCRIPT_MARKER",
        message: "Remove the private conversation or environment marker.",
      });
    }
  }

  return diagnostics;
}

function inspectWorkflowSecurity(relativePath, content) {
  if (!relativePath.startsWith(".github/workflows/")) {
    return [];
  }
  const diagnostics = [];
  const actionReferencePattern = /^\s*uses:\s*[^\s@]+@([^\s#]+).*$/gmu;
  for (const match of content.matchAll(actionReferencePattern)) {
    const reference = match[1];
    if (
      reference &&
      !/^[a-f0-9]{40}$/u.test(reference) &&
      match.index !== undefined
    ) {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, match.index),
        code: "WORKFLOW_ACTION_NOT_PINNED",
        message: "Pin every workflow action to a full commit SHA.",
      });
    }
  }
  if (/^\s*pull_request_target\s*:/mu.test(content)) {
    diagnostics.push({
      path: relativePath,
      line: lineNumberAt(content, content.search(/^\s*pull_request_target\s*:/mu)),
      code: "WORKFLOW_PRIVILEGED_TRIGGER",
      message: "Do not run repository code through pull_request_target.",
    });
  }
  const continueOnErrorIndex = content.search(
    /^\s*continue-on-error:\s*true\s*$/mu,
  );
  if (continueOnErrorIndex >= 0) {
    diagnostics.push({
      path: relativePath,
      line: lineNumberAt(content, continueOnErrorIndex),
      code: "WORKFLOW_FAILURE_HIDDEN",
      message: "Do not hide workflow failures with continue-on-error.",
    });
  }
  const writePermissionIndex = content.search(
    /^\s+[a-z-]+:\s+write\s*$/mu,
  );
  if (writePermissionIndex >= 0) {
    diagnostics.push({
      path: relativePath,
      line: lineNumberAt(content, writePermissionIndex),
      code: "WORKFLOW_WRITE_PERMISSION",
      message: "Qualification workflows must not request write permission.",
    });
  }
  if (!/^permissions:\s*\n\s+contents:\s+read\s*$/mu.test(content)) {
    diagnostics.push({
      path: relativePath,
      line: 1,
      code: "WORKFLOW_PERMISSIONS_MISSING",
      message: "Declare top-level read-only contents permission.",
    });
  }
  return diagnostics;
}

function inspectDependencyBoundaries(relativePath, content) {
  if (!relativePath.endsWith(".ts")) {
    return [];
  }
  const diagnostics = [];
  const rules = [
    {
      packageName: "jsonc-parser",
      allowedPath: "src/interface/private-domain-project-document.ts",
    },
    {
      packageName: "zod",
      allowedPath: "src/interface/private-zod.ts",
    },
  ];
  const imports = [
    ...content.matchAll(
      /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'](jsonc-parser(?:\/[^"']*)?|zod(?:\/[^"']*)?)["']/gu,
    ),
  ];
  for (const match of imports) {
    const specifier = match[1];
    if (specifier === undefined || match.index === undefined) {
      continue;
    }
    const rule = rules.find(
      ({ packageName }) =>
        specifier === packageName || specifier.startsWith(`${packageName}/`),
    );
    if (rule !== undefined && relativePath !== rule.allowedPath) {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, match.index),
        code: "DEPENDENCY_BOUNDARY_BYPASSED",
        message: `Import ${rule.packageName} only through ${rule.allowedPath}.`,
      });
    }
  }
  return diagnostics;
}

function inspectArchitectureBoundaries(relativePath, content) {
  if (!relativePath.startsWith("src/project/") || !relativePath.endsWith(".ts")) {
    return [];
  }
  const match = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']\.\.\/execution\//u.exec(
    content,
  );
  if (match === null || match.index === undefined) {
    return [];
  }
  return [
    {
      path: relativePath,
      line: lineNumberAt(content, match.index),
      code: "PROJECT_EXECUTION_BOUNDARY_BYPASSED",
      message:
        "Keep project resolution independent from optional execution exports.",
    },
  ];
}

function markdownLinkTargets(content) {
  const targets = [];
  const pattern = /\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/gu;
  for (const match of content.matchAll(pattern)) {
    const rawTarget = match[1];
    if (rawTarget && match.index !== undefined) {
      targets.push({
        target: rawTarget.replace(/^<|>$/gu, ""),
        index: match.index,
      });
    }
  }
  return targets;
}

async function inspectMarkdownLinks(absolutePath, relativePath, content) {
  const diagnostics = [];

  for (const link of markdownLinkTargets(content)) {
    if (
      link.target.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/iu.test(link.target) ||
      link.target.startsWith("/")
    ) {
      continue;
    }

    const pathPart = link.target.split("#", 1)[0]?.split("?", 1)[0];
    if (!pathPart) {
      continue;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, link.index),
        code: "INVALID_LOCAL_LINK",
        message: `Local link is not valid URI syntax: ${link.target}`,
      });
      continue;
    }

    try {
      await stat(resolve(dirname(absolutePath), decodedPath));
    } catch {
      diagnostics.push({
        path: relativePath,
        line: lineNumberAt(content, link.index),
        code: "BROKEN_LOCAL_LINK",
        message: `Local link target does not exist: ${link.target}`,
      });
    }
  }

  return diagnostics;
}

const diagnostics = [];
const files = await collectTextFiles();

for (const absolutePath of files) {
  const relativePath = relative(root, absolutePath).replaceAll("\\", "/");
  const content = await readFile(absolutePath, "utf8");
  if (content.includes("\0")) {
    continue;
  }
  diagnostics.push(...inspectDisclosure(relativePath, content));
  diagnostics.push(...inspectArchitectureBoundaries(relativePath, content));
  diagnostics.push(...inspectDependencyBoundaries(relativePath, content));
  diagnostics.push(...inspectWorkflowSecurity(relativePath, content));
  if (extname(absolutePath) === ".md") {
    diagnostics.push(
      ...(await inspectMarkdownLinks(absolutePath, relativePath, content)),
    );
  }
}

diagnostics.sort(
  (left, right) =>
    left.path.localeCompare(right.path) ||
    left.line - right.line ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message),
);

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.path}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(`Repository audit passed (${files.length} text files checked).`);
}
