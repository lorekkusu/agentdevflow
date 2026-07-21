import { readFile } from "node:fs/promises";

import {
  executePrivateDoctorCommand,
  type PrivateDoctorCommandResult,
} from "../commands/private-doctor-command-service.js";
import type { PrivateCapabilityRequirement } from "../compiler/private-model.js";
import type { PrivateCliInvocation } from "../interface/private-cli-arguments.js";
import { parsePrivateDomainProjectDocument } from "../interface/private-domain-project-document.js";
import { privateLocalReviewedChangeDefinition } from "../workflows/private-local-reviewed-change.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
} from "../workspace/private-filesystem-workspace.js";
import {
  blockedWithoutPlan,
  formatDoctor,
  planningDiagnostics,
  writeBoundedOutput,
  writeLine,
  type PrivateLocalCliIo,
} from "./private-local-cli-output.js";

const observationByteLimit = 262_144;

function blockedDoctor(
  io: PrivateLocalCliIo,
  diagnostics: Parameters<typeof blockedWithoutPlan>[1],
  invocation: Extract<PrivateCliInvocation, { readonly command: "doctor" }>,
): 2 {
  writeLine(
    io.stdout,
    blockedWithoutPlan("doctor", diagnostics, invocation.outputFormat),
  );
  return 2;
}

function localRequirements(): readonly PrivateCapabilityRequirement[] {
  return privateLocalReviewedChangeDefinition.capabilityRequirements.map(
    (requirement) => {
      if (requirement.capability !== "project-instructions") {
        throw new Error(
          `Local doctor does not support capability ${requirement.capability}.`,
        );
      }
      return {
        id: requirement.id,
        capability: requirement.capability,
        requiredStrength: requirement.requiredStrength,
        providerScope: "all-provider-instances" as const,
      };
    },
  );
}

export async function runPrivateDoctor(
  invocation: Extract<PrivateCliInvocation, { readonly command: "doctor" }>,
  io: PrivateLocalCliIo,
): Promise<0 | 1 | 2> {
  let workspace: Awaited<
    ReturnType<typeof PrivateFilesystemWorkspace.openReadOnly>
  >;
  try {
    workspace = await PrivateFilesystemWorkspace.openReadOnly(
      invocation.repositoryPath,
    );
  } catch (error) {
    return blockedDoctor(
      io,
      [
        {
          code:
            error instanceof PrivateFilesystemWorkspaceError
              ? error.code
              : "CLI_REPOSITORY_OPEN_FAILED",
          level: "error",
          message:
            error instanceof Error
              ? error.message
              : "The repository could not be opened read-only.",
          path: invocation.repositoryPath,
        },
      ],
      invocation,
    );
  }

  let configurationContent: string;
  let observationContent: string;
  try {
    const [configuration, observations] = await Promise.all([
      workspace.read(invocation.projectConfigPath),
      readFile(invocation.observationsPath, "utf8"),
    ]);
    if (configuration === null) throw new Error("Configuration is absent.");
    configurationContent = configuration;
    observationContent = observations;
  } catch {
    return blockedDoctor(io, [
      {
        code: "CLI_DOCTOR_INPUT_READ_FAILED",
        level: "error",
        message:
          "The project configuration and observation envelope must both be readable UTF-8 files.",
        path: invocation.projectConfigPath,
      },
    ], invocation);
  }

  if (Buffer.byteLength(observationContent, "utf8") > observationByteLimit) {
    return blockedDoctor(io, [
      {
        code: "CLI_DOCTOR_OBSERVATIONS_TOO_LARGE",
        level: "error",
        message: `The observation envelope exceeds ${observationByteLimit} UTF-8 bytes.`,
        path: invocation.observationsPath,
      },
    ], invocation);
  }

  const parsed = parsePrivateDomainProjectDocument(configurationContent);
  if (!parsed.ok) {
    return blockedDoctor(io, planningDiagnostics(parsed.diagnostics), invocation);
  }
  if (parsed.document.intent.workflow.family !== "local-reviewed-change") {
    return blockedDoctor(io, [
      {
        code: "CLI_DOCTOR_WORKFLOW_UNSUPPORTED",
        level: "error",
        message:
          "The current private doctor supports only the local-reviewed-change workflow without live probes.",
      },
    ], invocation);
  }

  let observations: unknown;
  try {
    observations = JSON.parse(observationContent) as unknown;
  } catch {
    observations = observationContent;
  }

  let result: PrivateDoctorCommandResult;
  try {
    result = executePrivateDoctorCommand({
      providers: parsed.document.intent.providers,
      capabilityRequirements: localRequirements(),
      requiredEnvironment: ["filesystem-read", "filesystem-write"],
      observations,
    });
  } catch (error) {
    return blockedDoctor(io, [
      {
        code: "CLI_DOCTOR_FAILED",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "The private doctor could not evaluate its bounded inputs.",
      },
    ], invocation);
  }
  if (!writeBoundedOutput(
    io.stdout,
    "doctor",
    invocation.outputFormat,
    formatDoctor(result, invocation.outputFormat),
  )) return 2;
  return result.candidateExitCode;
}
