import { issuePriority } from './scoring-engine.js';

/** Findings for the shared recommendations list. */
export function securityIssues(sec) {
  return (sec?.items || [])
    .filter((i) => i.status === 'fail' || i.status === 'warn')
    .map((i) => {
      const severity = i.status === 'fail' ? 'critical' : 'warning';
      const impact = i.weight >= 20 ? 'high' : i.weight >= 10 ? 'medium' : 'low';
      return {
        id: `sec-${i.id}`, title: i.title, category: 'security', severity, impact, confidence: 'high',
        message: `${i.title}: ${i.detail}`, evidence: i.detail, recommendation: i.fix,
        priority: issuePriority(impact, 'high', severity, 0),
      };
    });
}
