# Security follow-up — 19 October 2026

Compatible lockfile updates reduce dependency findings. Vitest/tinypool critical development-tool advisories require a separately tested major upgrade. JWT_SECRET and admin credentials must be provisioned at the actual Worker host; the current per-isolate fallback is unsuitable for stable production sessions. Add durable edge limits to login, registration and scan routes. Do not expose development servers publicly.

The new baseline scans the current checked-out tree, not historical commits. Do not interpret a green check as proof that historical credentials were revoked. No production deployment or provider credential test was performed.

Repository rulesets, required PR checks, secret scanning/push protection, Dependabot alerts, account 2FA, and token/SSH-key hygiene require verification in GitHub settings. These settings were not mutated by this PR. Apply required checks only after their first verified successful run, so existing deployments are not unexpectedly blocked.
