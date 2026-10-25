# Security policy

Use this plugin only for authorized defensive review of source code and local test fixtures. Do not use it to probe systems, identities, accounts, or infrastructure without explicit authorization. Prefer source inspection and synthetic principals.

Never commit credentials, production data, exploit payloads that target live services, or raw environment dumps in reports. Run reviewed target code only in an OS-enforced sandbox with external networking disabled, a sanitized allowlisted environment, read-only source, isolated scratch paths, and hard resource limits. If those controls cannot be established, stop execution and record the precise validation blocker.

Report a vulnerability in this plugin through the GitHub repository's private vulnerability-reporting option when available, or open an issue without sensitive exploit details. Include the affected version, narrow reproduction, impact, and proposed mitigation.
