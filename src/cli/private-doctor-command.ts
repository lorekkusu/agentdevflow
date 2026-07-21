import { open, type FileHandle } from "node:fs/promises";

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

class DoctorObservationReadError extends Error {
  readonly code:
    | "CLI_DOCTOR_INPUT_READ_FAILED"
    | "CLI_DOCTOR_OBSERVATIONS_TOO_LARGE";

  constructor(
    code:
      | "CLI_DOCTOR_INPUT_READ_FAILED"
      | "CLI_DOCTOR_OBSERVATIONS_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

async function readBoundedObservationFile(path: string): Promise<string> {
  let file: FileHandle | undefined;
  try {
    file = await open(path, "r");
    const metadata = await file.stat();
    if (!metadata.isFile()) {
      throw new DoctorObservationReadError(
        "CLI_DOCTOR_INPUT_READ_FAILED",
        "The observation envelope must be a regular file.",
      );
    }
    if (metadata.size > observationByteLimit) {
      throw new DoctorObservationReadError(
        "CLI_DOCTOR_OBSERVATIONS_TOO_LARGE",
        `The observation envelope exceeds ${observationByteLimit} UTF-8 bytes.`,
      );
    }

    const bytes = Buffer.alloc(observationByteLimit + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(
        bytes,
        length,
        bytes.length - length,
        length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > observationByteLimit) {
      throw new DoctorObservationReadError(
        "CLI_DOCTOR_OBSERVATIONS_TOO_LARGE",
        `The observation envelope exceeds ${observationByteLimit} UTF-8 bytes.`,
      );
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(0, length),
      );
    } catch {
      throw new DoctorObservationReadError(
        "CLI_DOCTOR_INPUT_READ_FAILED",
        "The observation envelope must contain valid UTF-8.",
      );
    }
  } catch (error) {
    if (error instanceof DoctorObservationReadError) throw error;
    throw new DoctorObservationReadError(
      "CLI_DOCTOR_INPUT_READ_FAILED",
      "The observation envelope could not be read.",
    );
  } finally {
    await file?.close();
  }
}

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
      readBoundedObservationFile(invocation.observationsPath),
    ]);
    if (configuration === null) throw new Error("Configuration is absent.");
    configurationContent = configuration;
    observationContent = observations;
  } catch (error) {
    const observationError =
      error instanceof DoctorObservationReadError ? error : null;
    return blockedDoctor(io, [
      {
        code: observationError?.code ?? "CLI_DOCTOR_INPUT_READ_FAILED",
        level: "error",
        message: observationError?.message ??
          "The project configuration and observation envelope must both be readable UTF-8 files.",
        path: observationError === null
          ? invocation.projectConfigPath
          : invocation.observationsPath,
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
