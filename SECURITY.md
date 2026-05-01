# Security Policy for TON618

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

- **Email**: [security@ton618.app](mailto:security@ton618.app)
- **Security.txt**: https://ton618.app/.well-known/security.txt
- **Preferred Languages**: English, Spanish

Please do not open public issues for security vulnerabilities.

## Security Measures

### Encryption
- AES-256-GCM for sensitive data at rest (MongoDB)
- TLS/SSL enforced for MongoDB in production

### Authentication
- Discord OAuth 2.0 with CSRF state validation
- Owner-only commands with confirmation codes for destructive operations

### Rate Limiting
- 3-level: Global (1000/min), Guild (100/min), User (5/min)
- Health endpoint rate limiting (30/min per IP)

### Input Validation
- ReDoS prevention (max 5000 chars before regex)
- NoSQL injection prevention
- Discord exploit pattern detection

### Observability
- PII sanitization in logs
- Structured logging with sensitive field masking
- Log rotation by size (default 10 MB)
