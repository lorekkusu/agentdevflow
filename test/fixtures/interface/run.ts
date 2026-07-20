import { parsePrivateCliArguments } from "../../../src/interface/private-cli-arguments.js";
import { createPrivateProjectConfigDocument } from "../../../src/interface/private-project-config-document.js";
import { balancedInitArguments } from "./specimens.js";

const parsed = parsePrivateCliArguments(balancedInitArguments);
if (!parsed.ok || parsed.invocation.command !== "init") {
  throw new Error("Candidate CLI argument specimen failed.");
}
const document = createPrivateProjectConfigDocument(
  parsed.invocation.configuration,
);
if (!document.ok) {
  throw new Error("Candidate project configuration document failed.");
}

console.log(
  JSON.stringify(
    {
      command: parsed.invocation.command,
      projectConfigPath: parsed.invocation.projectConfigPath,
      configurationDigest: parsed.invocation.configurationDigest,
      contentDigest: document.document.contentDigest,
      syntax: document.document.syntax,
    },
    null,
    2,
  ),
);
