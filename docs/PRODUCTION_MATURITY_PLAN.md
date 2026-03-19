# Production Maturity Plan

A practical, prioritized checklist for making KeepWiz feel and operate more like a mature company product.

## How to Use This

1. Start with **Tier 1** items only.
2. Pick 1-2 items at a time, complete them fully, then move on.
3. Revisit this file weekly and mark progress.
4. Do not start Tier 2 until Tier 1 is mostly done.

---

## Tier 1: Critical (Do First)

These reduce the highest business and trust risk.

### 1) Production Monitoring and Alerting
- Importance: **Very High**
- Effort: **Medium**
- Why: You cannot fix user-facing issues quickly if you cannot see them.
- Success criteria:
  - [ ] Frontend and backend error tracking enabled
  - [ ] API dashboards for request rate, error rate, latency (p95)
  - [ ] Uptime checks and actionable alerts configured
  - [ ] Alerts notify only on user-impacting failures

### 2) Backup and Restore Testing
- Importance: **Very High**
- Effort: **Low-Medium**
- Why: Backups are only useful if restore is proven to work.
- Success criteria:
  - [ ] Automated MongoDB backups scheduled
  - [ ] Restore runbook documented
  - [ ] Monthly restore drill completed and logged

### 3) CI/CD Safety Gates
- Importance: **Very High**
- Effort: **Medium**
- Why: Prevents broken code and risky changes from reaching production.
- Success criteria:
  - [ ] Branch protection on main
  - [ ] Required checks: lint, tests, build, security scan
  - [ ] Deployment health checks in place
  - [ ] Rollback procedure documented and tested

### 4) Security Baseline
- Importance: **Very High**
- Effort: **Medium**
- Why: Security incidents create major trust and operational damage.
- Success criteria:
  - [ ] Secrets managed outside plain env files on hosts
  - [ ] Dependency vulnerability scanning enabled in CI
  - [ ] Auth endpoints rate-limited and abuse-protected
  - [ ] JWT/session policy reviewed (expiry/rotation)

---

## Tier 2: High (Do Next)

These improve reliability and delivery confidence.

### 1) SLOs and Error Budgets
- Importance: **High**
- Effort: **Low**
- Why: Reliability goals become measurable and enforceable.
- Success criteria:
  - [ ] 2-3 SLOs defined (uptime, latency, sync success)
  - [ ] Error budget policy documented
  - [ ] Weekly SLO review added to team rhythm

### 2) Critical Path Regression Tests
- Importance: **High**
- Effort: **Medium-High**
- Why: Core user journeys stay stable release to release.
- Success criteria:
  - [ ] Tests cover login, game creation, scoring
  - [ ] Tests cover offline sync and conflict handling
  - [ ] Smoke tests run on deployment

### 3) Incident Process and Postmortems
- Importance: **High**
- Effort: **Low**
- Why: Incidents become a source of improvement, not repeated pain.
- Success criteria:
  - [ ] Incident template created
  - [ ] Weekly ops review cadence established
  - [ ] Follow-up actions tracked to completion

### 4) Offline/Sync Operational Metrics
- Importance: **High**
- Effort: **Medium**
- Why: Your offline-first architecture needs dedicated health signals.
- Success criteria:
  - [ ] Queue depth tracked
  - [ ] Retry and failure rates tracked
  - [ ] Conflict frequency and resolution outcomes tracked

---

## Tier 3: Medium (Maturity Layer)

These add polish and organizational readiness.

### 1) Product Analytics Funnel
- Importance: **Medium-High**
- Effort: **Medium**
- Why: Roadmap decisions become data-driven.
- Success criteria:
  - [ ] Activation funnel defined and instrumented
  - [ ] Retention cohorts tracked
  - [ ] Feature adoption dashboard available

### 2) Status and Support Surface
- Importance: **Medium**
- Effort: **Low-Medium**
- Why: Increases trust and shortens support cycles.
- Success criteria:
  - [ ] Public status page published
  - [ ] In-app issue reporting with environment metadata
  - [ ] Support response workflow documented

### 3) Policy and Compliance Hardening
- Importance: **Medium**
- Effort: **Medium**
- Why: Needed as adoption grows and legal risk increases.
- Success criteria:
  - [ ] Privacy policy matches actual data flows
  - [ ] Data retention/deletion policy documented
  - [ ] Recovery targets documented (RPO/RTO)

---

## Recommended Execution Order

1. Monitoring and alerting
2. Backup and restore testing
3. CI/CD safety gates
4. Security baseline
5. SLOs and incident process
6. Regression tests and sync metrics
7. Analytics, status/support, policy hardening

---

## Quick Pick Section (Choose Next 1-2)

- [ ] Monitoring and alerting
- [ ] Backup and restore testing
- [ ] CI/CD safety gates
- [ ] Security baseline
- [ ] SLOs and error budgets
- [ ] Critical path regression tests
- [ ] Incident process and postmortems
- [ ] Offline/sync operational metrics
- [ ] Product analytics funnel
- [ ] Status and support surface
- [ ] Policy and compliance hardening

## Notes

- Date reviewed:
- Current priority:
- Owner:
- Target completion date:
- Risks/blockers:
