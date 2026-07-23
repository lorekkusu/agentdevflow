import { createHash } from "node:crypto";

import {
  createScanner,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from "jsonc-parser";
import * as jsoncParser from "jsonc-parser";

import {
  candidateProviderProducts,
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
      auxiliaryReview: z.literal("disabled"),
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
  | "NESTING_LIMIT_EXCEEDED"
  | "SCHEMA_INVALID"
  | "SYNTAX_INVALID"
  | "UNSAFE_PROPERTY_NAME"
  | "WORKFLOW_RESOLUTION_FAILED";

export interface PrivateDomainProjectDocumentDiagnostic {
  readonly stage: "parse" | "schema" | "resolution";
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

export interface PrivateJsoncValueParseOptions
  extends PrivateDomainProjectDocumentLimits {
  readonly description: string;
  readonly allowComments?: boolean;
  readonly allowTrailingComma?: boolean;
}

export type PrivateJsoncValueParseResult =
  | {
      readonly ok: true;
      readonly value: unknown;
      readonly contentDigest: string;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainProjectDocumentDiagnostic[];
    };

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
  description: string,
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
          message: `${description} nesting exceeds the configured limit ${maxNestingDepth}.`,
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
  description: string,
  syntaxName: "JSON" | "JSONC",
): PrivateDomainProjectDocumentDiagnostic[] {
  return errors.map((error) => ({
    stage: "parse",
    code: "SYNTAX_INVALID",
    path: "$",
    offset: error.offset,
    length: error.length,
    message: `${description} ${syntaxName} syntax error ${printParseErrorCode(error.error)} at offset ${error.offset}.`,
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
  const parsed = parsePrivateJsoncValue(content, {
    ...limits,
    description: "Project document",
  });
  if (!parsed.ok) {
    return parsed;
  }
  const maxDiagnostics = checkedLimit(
    limits.maxDiagnostics,
    privateDomainProjectDocumentDefaultMaxDiagnostics,
    "maxDiagnostics",
  );
  const schemaResult = privateDomainProjectIntentSchema.safeParse(parsed.value, {
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
      contentDigest: parsed.contentDigest,
      schemaDigest: privateDomainProjectIntentJsonSchemaDigest,
      intent: schemaResult.data,
    },
  };
}

export function parsePrivateJsoncValue(
  content: string,
  options: PrivateJsoncValueParseOptions,
): PrivateJsoncValueParseResult {
  if (options.description.length === 0) {
    throw new Error("description must not be empty.");
  }
  const maxBytes = checkedLimit(
    options.maxBytes,
    privateDomainProjectDocumentDefaultMaxBytes,
    "maxBytes",
  );
  const maxNestingDepth = checkedLimit(
    options.maxNestingDepth,
    privateDomainProjectDocumentDefaultMaxNestingDepth,
    "maxNestingDepth",
  );
  const maxDiagnostics = checkedLimit(
    options.maxDiagnostics,
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
          message: `${options.description} is ${contentBytes} UTF-8 bytes, exceeding the configured limit ${maxBytes}.`,
        },
      ],
    };
  }

  const depthFailure = nestingDiagnostic(
    content,
    maxNestingDepth,
    options.description,
  );
  if (depthFailure !== undefined) {
    return { ok: false, diagnostics: [depthFailure] };
  }

  const errors: ParseError[] = [];
  const allowComments = options.allowComments ?? true;
  const allowTrailingComma = options.allowTrailingComma ?? true;
  const syntaxName = !allowComments && !allowTrailingComma ? "JSON" : "JSONC";
  const tree = parseTree(content, errors, {
    allowTrailingComma,
    disallowComments: !allowComments,
    allowEmptyContent: false,
  });
  if (errors.length > 0 || tree === undefined) {
    const diagnostics = syntaxDiagnostics(
      errors,
      options.description,
      syntaxName,
    );
    if (tree === undefined && diagnostics.length === 0) {
      diagnostics.push({
        stage: "parse",
        code: "SYNTAX_INVALID",
        path: "$",
        message: `${options.description} does not contain a ${syntaxName} value.`,
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

  return {
    ok: true,
    value: getNodeValue(tree) as unknown,
    contentDigest: digestText(content),
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
