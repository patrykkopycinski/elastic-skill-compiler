# Alert Classification Guide

Criteria for classifying alerts as benign, unknown, or malicious.

## Fundamental Principle

Most alerts are false positives. Your job is to find EVIDENCE, not to confirm suspicions. When in doubt, classify as
"unknown" — this is better than a wrong malicious classification that wastes IR resources, or a wrong benign
classification that misses a threat.

## Classification: Benign (score 0–19)

Confirmed false positive or legitimate activity. Requires positive evidence of legitimacy:

- Recognized enterprise software performing expected functions
- Known IT management/deployment activity (SCCM, Group Policy, Intune)
- Security testing with clear test environment indicators
- Rule known to have a high FP rate for this specific scenario
- No malicious behaviors observed (no persistence, no C2, no credential theft)

## Classification: Unknown (score 20–60)

Insufficient information to determine. Use when:

- Suspicious indicators exist BUT lack corroborating evidence of malicious intent
- Activity could be malicious or legitimate, and you cannot tell which
- Need more context that is not available in the current data
- First time seeing this pattern with no baseline

## Classification: Malicious (score 61–100)

Confirmed or highly suspected malicious activity. Requires at least ONE high-confidence indicator:

- Confirmed C2 communication (beaconing to known bad IP/domain)
- Persistence mechanisms established (registry Run keys, scheduled tasks, services)
- Credential theft (LSASS access, credential file access, keylogging)
- Lateral movement (RDP/SMB/WinRM to other internal hosts)
- Active defense evasion (disabling AV, clearing logs, timestomping)
- Known malware hash match
- Data exfiltration observed

## Indicators That Are NOT Sufficient Alone

These require corroboration before classifying as malicious:

- Unsigned binary (many legitimate apps are unsigned)
- Large file size (Electron apps are routinely 100 MB+)
- Running from Temp folder (installers commonly do this)
- WriteProcessMemory API (used by legitimate apps for child process creation)
- VirtualAlloc RWX (used by JIT compilers in .NET, Java, Node.js)
- Alert severity is "critical" (severity is rule author's opinion, not evidence)
- Rule name contains "Malicious" (rule names are often sensationalized)

## Behavioral Weight Table

### Strong indicators (can support MALICIOUS)

| Behavior | Score range |
| --- | --- |
| Persistence + C2 together | 75+ |
| Credential access (actual LSASS memory read) | 80+ |
| Confirmed C2 beaconing to known-bad infrastructure | 75+ |
| Lateral movement (connections to other internal hosts) | 75+ |
| Active AV/EDR disabling | 80+ |
| Known malware hash match | 90+ |

### Weak indicators (alone = UNKNOWN)

| Behavior | Score range |
| --- | --- |
| Process injection APIs without confirmed malicious target | 35–50 |
| Binary padding / large file alone | 25–40 |
| WriteProcessMemory to own child process | 20–30 |
| VirtualAlloc RWX | 20–35 |
| Unsigned executable | 25–40 |
| Running from Temp/AppData | 25–40 |
| PowerShell execution | 20–35 |
| Network connection alone (without C2 indicators) | 30–45 |

Single suspicious behaviors without corroborating evidence = UNKNOWN, not MALICIOUS.
