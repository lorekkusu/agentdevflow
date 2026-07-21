import { parsePrivateCliArguments } from "../../../src/interface/private-cli-arguments.js";
import { parsePrivateDomainProjectDocument } from "../../../src/interface/private-domain-project-document.js";
import { resolvePrivateDomainProject } from "../../../src/project/private-domain-project-resolution.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../../src/workflows/private-local-reviewed-change.js";
import { balancedInitArguments } from "./specimens.js";

const parsed = parsePrivateCliArguments(balancedInitArguments);
if (!parsed.ok || parsed.invocation.command !== "init") {
  throw new Error("Candidate CLI argument specimen failed.");
}
const document = parsePrivateDomainProjectDocument(
  parsed.invocation.configurationContent,
);
if (!document.ok) {
  throw new Error("Candidate project configuration document failed.");
}
const project = resolvePrivateDomainProject(parsed.invocation.intent, {
  capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
});
if (!project.ok) {
  throw new Error("Candidate project intent failed resolution.");
}

console.log(
  JSON.stringify(
    {
      command: parsed.invocation.command,
      projectConfigPath: parsed.invocation.projectConfigPath,
      configurationDigest: project.resolution.intentDigest,
      contentDigest: document.document.contentDigest,
      syntax: document.document.syntax,
    },
    null,
    2,
  ),
);
