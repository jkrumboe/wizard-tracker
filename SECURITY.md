# Security Policy

## Supported Versions

We release patches for security vulnerabilities. The following versions are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.6.x   | :white_check_mark: |
| < 1.6   | :x:                |

## Reporting a Vulnerability

We take the security of KeepWiz seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send an email to (Email will be provided when the Name of the product is finalized)
1. **GitHub Security Advisory**: Use GitHub's [private vulnerability reporting](https://github.com/jkrumboe/wizard-tracker/security/advisories/new)

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Assessment**: We will send an initial assessment of the vulnerability within 5 business days
- **Updates**: We will keep you informed of the progress towards a fix and may ask for additional information
- **Disclosure**: We aim to resolve critical vulnerabilities within 90 days and will coordinate disclosure with you

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security issue beyond what is necessary to demonstrate it
- Give us reasonable time to resolve the issue before any disclosure
- Do not access or modify other users' data

## Security Best Practices

When deploying KeepWiz, please follow these security best practices:

### Environment Variables

- Never commit `.env` files to version control
- Change all default passwords and secrets in production
- Use strong, randomly generated values for `JWT_SECRET`
- Keep MongoDB credentials secure and rotate them regularly

### MongoDB Security

- Do not use the default admin/admin123 credentials in production
- Enable MongoDB authentication
- Use strong passwords for database users
- Restrict MongoDB network access (bind to localhost or use firewall rules)
- Keep MongoDB updated to the latest stable version

### Application Security

- Always use HTTPS in production (never HTTP)
- Keep all dependencies up to date
- Review and audit third-party packages regularly
- Enable rate limiting on authentication endpoints
- Implement proper session timeout mechanisms
- Use secure cookie flags (httpOnly, secure, sameSite)

### Docker Security

- Don't run containers as root user
- Keep base images updated
- Scan images for vulnerabilities regularly
- Use specific image versions (avoid `latest` tag in production)
- Minimize container privileges

### Mongo Express (Development Tool)

- **Never expose Mongo Express in production**
- It should only be accessible on localhost or behind authentication
- Remove or disable it in production deployments
- Change default credentials immediately

## Known Security Considerations

### Current Security Measures

- JWT-based authentication with token expiration
- Bcrypt password hashing (10 rounds)
- Input validation on all API endpoints
- CORS configuration for cross-origin requests
- XSS prevention with DOMPurify
- Share validation for game URLs
- Rate limiting on authentication endpoints (recommended)

### Areas for Enhancement

The following areas could benefit from additional security hardening in future releases:

- Two-factor authentication (2FA)
- Rate limiting on all API endpoints
- Account lockout after failed login attempts
- Email verification for new accounts
- Password strength requirements enforcement
- Security headers (CSP, HSTS, X-Frame-Options)
- Automated dependency vulnerability scanning

## Security Update Policy

- **Critical vulnerabilities**: Patched within 48 hours, immediate release
- **High severity**: Patched within 7 days, planned release
- **Medium severity**: Patched within 30 days, next regular release
- **Low severity**: Patched in next regular release cycle

## Credit

We believe in recognizing security researchers for their contributions. With your permission, we will:

- Acknowledge your responsible disclosure in the release notes
- List you in our security hall of fame (if you'd like)
- Provide credit in the CHANGELOG for the fix

Thank you for helping keep KeepWiz and its users safe!
