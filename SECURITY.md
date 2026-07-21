# Security Policy

## Supported versions

`agentdevflow` has no stable release. When security fixes are issued during the prerelease period, they target the latest published beta. Older prereleases may not receive fixes.

Before the first publication, reports should identify the affected repository commit.

## Reporting a vulnerability

Do not open a public issue containing vulnerability details, exploit code, credentials, secrets, or unrelated private data.

Use GitHub's **Report a vulnerability** form when private vulnerability reporting is available:

<https://github.com/lorekkusu/agentdevflow/security/advisories/new>

If that private route is unavailable, open a minimal public issue asking the maintainers to provide a private contact route. Do not include technical vulnerability details in that issue.

When possible, include the following information in the private report:

- the affected version or commit;
- the operating system and Node.js version;
- the expected and observed behavior;
- the security impact and required preconditions;
- a minimal reproduction with secrets and personal data removed;
- a suggested remediation, if known.

## Coordinated disclosure

The maintainers will evaluate reports privately and coordinate remediation and disclosure when appropriate. This early-stage project does not promise a response or remediation deadline. Do not publish vulnerability details before a coordinated fix or advisory is available.

## Scope

Reports may cover this repository, a released `agentdevflow` package, or a flaw in an `agentdevflow` integration boundary. Vulnerabilities that affect only a third-party provider or dependency should also be reported through that project's security process.
