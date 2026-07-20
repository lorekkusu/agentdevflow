import { createHash } from "node:crypto";

import {
  applyEdits,
  createScanner,
  getNodeValue,
  modify,
  parseTree,
  printParseErrorCode,
  type Edit,
  type Node,
  type ParseError,
} from "jsonc-parser";
import * as jsoncParser from "jsonc-parser";

import {
  candidateProviderProducts,
  candidateProviderSurfaces,
  candidateRoles,
} from "../config/candidate.js";
import type { PrivateDomainCapabilityObservation } from "../compiler/private-domain-workflow.js";
import {
  resolvePrivateDomainProject,
  type PrivateDomainProjectIntent,
  type PrivateDomainProjectResolutionDiagnostic,
  type PrivateDomainProjectResolutionResult,
} from "../project/private-domain-project-resolution.js";
import { privateDomainPresets } from "../project/private-domain-preset.js";
import { privateZod as z } from "./private-zod.js";

export const privateDomainProjectDocumentRevision = 1;
export const privateDomainProjectDocumentDefaultMaxBytes = 262_144;
export const privateDomainProjectDocumentDefaultMaxNestingDepth = 32;
export const privateDomainProjectDocumentDefaultMaxDiagnostics = 64;

const privateTrackerModes = [
  "github-issues",
  "linear",
  "local",
  "none",
] as const;
const providerIdentifierPattern = /^[a-z][a-z0-9-]*$/u;
const logicalBindingPattern = /^[a-z][a-z0-9-]*$/u;
const externalIdentifierPattern = /^[a-z][a-z0-9.-]*$/u;
const syntaxKind = (
  jsoncParser as unknown as {
    readonly SyntaxKind: {
      readonly OpenBraceToken: number;
      readonly CloseBraceToken: number;
      readonly OpenBracketToken: number;
      readonly CloseBracketToken: number;
      readonly EOF: number;
    };
  }
).SyntaxKind;

const providerSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(providerIdentifierPattern),
  product: z.enum(candidateProviderProducts),
  surface: z.enum(candidateProviderSurfaces),
});

const responsibilityTargetSchema = z.strictObject({
  kind: z.literal("responsibility"),
  responsibility: z.enum(candidateRoles),
});
const trackerTargetSchema = z.strictObject({ kind: z.literal("tracker") });
const externalTargetSchema = z.strictObject({
  kind: z.literal("external"),
  id: z.string().min(1).max(128).regex(externalIdentifierPattern),
});

export const privateDomainProjectIntentSchema = z.strictObject({
  revision: z.literal(1),
  preset: z.enum(privateDomainPresets),
  providers: z.array(providerSchema).min(1).max(32),
  roles: z.strictObject({
    developer: z.string().min(1).max(64).regex(providerIdentifierPattern),
    reviewer: z.string().min(1).max(64).regex(providerIdentifierPattern),
    steward: z.string().min(1).max(64).regex(providerIdentifierPattern),
  }),
  tracker: z.strictObject({ mode: z.enum(privateTrackerModes) }),
  workflow: z.discriminatedUnion("family", [
    z.strictObject({
      family: z.literal("issue-to-reviewed-pull-request"),
      initialState: z.enum(["draft", "ready"]),
      auxiliaryReview: z.enum(["disabled", "enabled"]),
      mergeMethod: z.literal("squash"),
    }),
    z.strictObject({ family: z.literal("local-reviewed-change") }),
  ]),
  capabilityBindings: z
    .array(
      z.strictObject({
        binding: z.string().min(1).max(64).regex(logicalBindingPattern),
        target: z.discriminatedUnion("kind", [
          responsibilityTargetSchema,
          trackerTargetSchema,
          externalTargetSchema,
        ]),
      }),
    )
    .max(64),
});

export type PrivateDomainProjectDocumentDiagnosticCode =
  | "DIAGNOSTIC_LIMIT_EXCEEDED"
  | "DOCUMENT_TOO_LARGE"
  | "DUPLICATE_PROPERTY"
  | "EDIT_REQUEST_INVALID"
  | "NESTING_LIMIT_EXCEEDED"
  | "SCHEMA_INVALID"
  | "SYNTAX_INVALID"
  | "UNSAFE_PROPERTY_NAME"
  | "WORKFLOW_RESOLUTION_FAILED";

export interface PrivateDomainProjectDocumentDiagnostic {
  readonly stage: "edit" | "parse" | "schema" | "resolution";
  readonly code: PrivateDomainProjectDocumentDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly offset?: number;
  readonly length?: number;
  readonly cause?: PrivateDomainProjectResolutionDiagnostic;
}

export interface PrivateDomainProjectDocumentLimits {
  readonly maxBytes?: number;
  readonly maxNestingDepth?: number;
  readonly maxDiagnostics?: number;
}

export interface PrivateDomainProjectDocument {
  readonly revision: 1;
  readonly syntax: "jsonc";
  readonly contentDigest: string;
  readonly schemaDigest: string;
  readonly intent: PrivateDomainProjectIntent;
}

export type PrivateDomainProjectDocumentParseResult =
  | { readonly ok: true; readonly document: PrivateDomainProjectDocument }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainProjectDocumentDiagnostic[];
    };

export type PrivateDomainProjectDocumentCompilationResult =
  | {
      readonly ok: true;
      readonly document: PrivateDomainProjectDocument;
      readonly project: Extract<
        PrivateDomainProjectResolutionResult,
        { readonly ok: true }
      >;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainProjectDocumentDiagnostic[];
    };

export type PrivateDomainProjectDocumentEditOperation =
  | {
      readonly kind: "set";
      readonly path: readonly (string | number)[];
      readonly value: unknown;
    }
  | {
      readonly kind: "insert";
      readonly path: readonly (string | number)[];
      readonly value: unknown;
    };

export type PrivateDomainProjectDocumentEditResult =
  | {
      readonly ok: true;
      readonly content: string;
      readonly beforeContentDigest: string;
      readonly afterContentDigest: string;
      readonly edits: readonly Edit[];
      readonly document: PrivateDomainProjectDocument;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainProjectDocumentDiagnostic[];
    };

export interface PrivateDomainProjectDocumentCompilationOptions
  extends PrivateDomainProjectDocumentLimits {
  readonly capabilityObservations: readonly PrivateDomainCapabilityObservation[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareText)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const jsonSchema = z.toJSONSchema(privateDomainProjectIntentSchema, {
  target: "draft-2020-12",
  unrepresentable: "throw",
  cycles: "throw",
  reused: "inline",
});

export const privateDomainProjectIntentJsonSchemaCanonicalJson =
  canonicalJson(jsonSchema);
export const privateDomainProjectIntentJsonSchemaDigest = digestText(
  privateDomainProjectIntentJsonSchemaCanonicalJson,
);

function checkedLimit(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return selected;
}

function pathText(path: readonly PropertyKey[]): string {
  let result = "$";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else if (
      typeof segment === "string" &&
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(segment)
    ) {
      result += `.${segment}`;
    } else {
      result += `[${JSON.stringify(String(segment))}]`;
    }
  }
  return result;
}

function diagnosticOrder(
  left: PrivateDomainProjectDocumentDiagnostic,
  right: PrivateDomainProjectDocumentDiagnostic,
): number {
  return (
    (left.offset ?? Number.MAX_SAFE_INTEGER) -
      (right.offset ?? Number.MAX_SAFE_INTEGER) ||
    compareText(left.path, right.path) ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

function boundDiagnostics(
  diagnostics: readonly PrivateDomainProjectDocumentDiagnostic[],
  maxDiagnostics: number,
): readonly PrivateDomainProjectDocumentDiagnostic[] {
  const sorted = [...diagnostics].sort(diagnosticOrder);
  if (sorted.length <= maxDiagnostics) {
    return sorted;
  }
  return [
    ...sorted.slice(0, maxDiagnostics),
    {
      stage: sorted[0]?.stage ?? "parse",
      code: "DIAGNOSTIC_LIMIT_EXCEEDED",
      path: "$",
      message: `${sorted.length - maxDiagnostics} additional diagnostics were omitted after the configured limit ${maxDiagnostics}.`,
    },
  ];
}

function nestingDiagnostic(
  content: string,
  maxNestingDepth: number,
): PrivateDomainProjectDocumentDiagnostic | undefined {
  const scanner = createScanner(content, false);
  let depth = 0;
  while (true) {
    const token = scanner.scan();
    if (token === syntaxKind.EOF) {
      return undefined;
    }
    if (
      token === syntaxKind.OpenBraceToken ||
      token === syntaxKind.OpenBracketToken
    ) {
      depth += 1;
      if (depth > maxNestingDepth) {
        return {
          stage: "parse",
          code: "NESTING_LIMIT_EXCEEDED",
          path: "$",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
          message: `Project document nesting exceeds the configured limit ${maxNestingDepth}.`,
        };
      }
    } else if (
      token === syntaxKind.CloseBraceToken ||
      token === syntaxKind.CloseBracketToken
    ) {
      depth = Math.max(0, depth - 1);
    }
  }
}

function syntaxDiagnostics(
  errors: readonly ParseError[],
): PrivateDomainProjectDocumentDiagnostic[] {
  return errors.map((error) => ({
    stage: "parse",
    code: "SYNTAX_INVALID",
    path: "$",
    offset: error.offset,
    length: error.length,
    message: `JSONC syntax error ${printParseErrorCode(error.error)} at offset ${error.offset}.`,
  }));
}

function inspectTree(
  node: Node,
  path: readonly PropertyKey[],
  diagnostics: PrivateDomainProjectDocumentDiagnostic[],
): void {
  if (node.type === "array") {
    for (const [index, child] of (node.children ?? []).entries()) {
      inspectTree(child, [...path, index], diagnostics);
    }
    return;
  }
  if (node.type !== "object") {
    return;
  }

  const seen = new Set<string>();
  for (const property of node.children ?? []) {
    const keyNode = property.children?.[0];
    const valueNode = property.children?.[1];
    if (keyNode?.type !== "string" || typeof keyNode.value !== "string") {
      continue;
    }
    const key = keyNode.value;
    const propertyPath = [...path, key];
    if (seen.has(key)) {
      diagnostics.push({
        stage: "parse",
        code: "DUPLICATE_PROPERTY",
        path: pathText(propertyPath),
        offset: keyNode.offset,
        length: keyNode.length,
        message: `Property ${pathText(propertyPath)} is duplicated.`,
      });
    }
    seen.add(key);
    if (key === "__proto__") {
      diagnostics.push({
        stage: "parse",
        code: "UNSAFE_PROPERTY_NAME",
        path: pathText(propertyPath),
        offset: keyNode.offset,
        length: keyNode.length,
        message: `Property ${pathText(propertyPath)} is not accepted.`,
      });
    }
    if (valueNode !== undefined) {
      inspectTree(valueNode, propertyPath, diagnostics);
    }
  }
}

export function parsePrivateDomainProjectDocument(
  content: string,
  limits: PrivateDomainProjectDocumentLimits = {},
): PrivateDomainProjectDocumentParseResult {
  const maxBytes = checkedLimit(
    limits.maxBytes,
    privateDomainProjectDocumentDefaultMaxBytes,
    "maxBytes",
  );
  const maxNestingDepth = checkedLimit(
    limits.maxNestingDepth,
    privateDomainProjectDocumentDefaultMaxNestingDepth,
    "maxNestingDepth",
  );
  const maxDiagnostics = checkedLimit(
    limits.maxDiagnostics,
    privateDomainProjectDocumentDefaultMaxDiagnostics,
    "maxDiagnostics",
  );
  const contentBytes = Buffer.byteLength(content, "utf8");
  if (contentBytes > maxBytes) {
    return {
      ok: false,
      diagnostics: [
        {
          stage: "parse",
          code: "DOCUMENT_TOO_LARGE",
          path: "$",
          message: `Project document is ${contentBytes} UTF-8 bytes, exceeding the configured limit ${maxBytes}.`,
        },
      ],
    };
  }

  const depthFailure = nestingDiagnostic(content, maxNestingDepth);
  if (depthFailure !== undefined) {
    return { ok: false, diagnostics: [depthFailure] };
  }

  const errors: ParseError[] = [];
  const tree = parseTree(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });
  if (errors.length > 0 || tree === undefined) {
    const diagnostics = syntaxDiagnostics(errors);
    if (tree === undefined && diagnostics.length === 0) {
      diagnostics.push({
        stage: "parse",
        code: "SYNTAX_INVALID",
        path: "$",
        message: "Project document does not contain a JSONC value.",
      });
    }
    return {
      ok: false,
      diagnostics: boundDiagnostics(diagnostics, maxDiagnostics),
    };
  }

  const treeDiagnostics: PrivateDomainProjectDocumentDiagnostic[] = [];
  inspectTree(tree, [], treeDiagnostics);
  if (treeDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: boundDiagnostics(treeDiagnostics, maxDiagnostics),
    };
  }

  const parsed = getNodeValue(tree) as unknown;
  const schemaResult = privateDomainProjectIntentSchema.safeParse(parsed, {
    jitless: true,
  });
  if (!schemaResult.success) {
    const diagnostics = schemaResult.error.issues.map((issue) => ({
      stage: "schema" as const,
      code: "SCHEMA_INVALID" as const,
      path: pathText(issue.path),
      message: issue.message,
    }));
    return {
      ok: false,
      diagnostics: boundDiagnostics(diagnostics, maxDiagnostics),
    };
  }

  return {
    ok: true,
    document: {
      revision: privateDomainProjectDocumentRevision,
      syntax: "jsonc",
      contentDigest: digestText(content),
      schemaDigest: privateDomainProjectIntentJsonSchemaDigest,
      intent: schemaResult.data,
    },
  };
}

export function compilePrivateDomainProjectDocument(
  content: string,
  options: PrivateDomainProjectDocumentCompilationOptions,
): PrivateDomainProjectDocumentCompilationResult {
  const parsed = parsePrivateDomainProjectDocument(content, options);
  if (!parsed.ok) {
    return parsed;
  }
  const project = resolvePrivateDomainProject(parsed.document.intent, {
    capabilityObservations: options.capabilityObservations,
  });
  if (!project.ok) {
    const maxDiagnostics = checkedLimit(
      options.maxDiagnostics,
      privateDomainProjectDocumentDefaultMaxDiagnostics,
      "maxDiagnostics",
    );
    return {
      ok: false,
      diagnostics: boundDiagnostics(
        project.diagnostics.map((cause) => ({
          stage: "resolution",
          code: "WORKFLOW_RESOLUTION_FAILED",
          path: cause.path,
          message: cause.message,
          cause,
        })),
        maxDiagnostics,
      ),
    };
  }
  return { ok: true, document: parsed.document, project };
}

function validateEditPath(
  path: readonly (string | number)[],
): PrivateDomainProjectDocumentDiagnostic | undefined {
  if (path.length === 0 || path.length > 16) {
    return {
      stage: "edit",
      code: "EDIT_REQUEST_INVALID",
      path: "$",
      message: "Private JSONC edit paths must contain between 1 and 16 segments.",
    };
  }
  for (const [index, segment] of path.entries()) {
    if (
      (typeof segment === "string" &&
        (segment.length === 0 || segment === "__proto__")) ||
      (typeof segment === "number" &&
        (!Number.isSafeInteger(segment) || segment < 0))
    ) {
      return {
        stage: "edit",
        code: "EDIT_REQUEST_INVALID",
        path: `$[editPath][${index}]`,
        message: `Private JSONC edit path segment ${index} is invalid.`,
      };
    }
  }
  return undefined;
}

export function editPrivateDomainProjectDocument(
  content: string,
  operation: PrivateDomainProjectDocumentEditOperation,
  limits: PrivateDomainProjectDocumentLimits = {},
): PrivateDomainProjectDocumentEditResult {
  const current = parsePrivateDomainProjectDocument(content, limits);
  if (!current.ok) {
    return current;
  }
  const pathFailure = validateEditPath(operation.path);
  if (pathFailure !== undefined) {
    return { ok: false, diagnostics: [pathFailure] };
  }

  let edits: Edit[];
  try {
    edits = modify(content, [...operation.path], operation.value, {
      ...(operation.kind === "insert" ? { isArrayInsertion: true } : {}),
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: "\n",
      },
    });
  } catch {
    return {
      ok: false,
      diagnostics: [
        {
          stage: "edit",
          code: "EDIT_REQUEST_INVALID",
          path: pathText(operation.path),
          message: `Private JSONC ${operation.kind} edit could not be represented at ${pathText(operation.path)}.`,
        },
      ],
    };
  }

  const editedContent = applyEdits(content, edits);
  const edited = parsePrivateDomainProjectDocument(editedContent, limits);
  if (!edited.ok) {
    return edited;
  }
  return {
    ok: true,
    content: editedContent,
    beforeContentDigest: current.document.contentDigest,
    afterContentDigest: edited.document.contentDigest,
    edits,
    document: edited.document,
  };
}
