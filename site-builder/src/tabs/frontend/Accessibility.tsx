import { useMemo } from 'react';
import { useSite } from '../../store';
import { a11yAudit, score } from '../../lib/audits';
import { Card, Checks, PageHead, Score } from '../../components/ui';
import { useFix } from '../../hooks';

export function AccessibilityTab() {
  const { site } = useSite();
  const fix = useFix();
  const checks = useMemo(() => a11yAudit(site), [site]);
  return (
    <div className="tab-page">
      <PageHead title="Accessibility" subtitle="Usable by everyone — including keyboard and screen-reader users. Checked against WCAG 2.1 AA." />
      <div className="grid-2col">
        <Card title="Score">
          <div className="row gap-lg">
            <Score value={score(checks)} label="A11y" size={110} />
            <p className="muted">Accessible sites reach more customers, rank better and reduce legal risk. Fix red items first.</p>
          </div>
        </Card>
        <Card title="Generated automatically">
          <ul className="ticks">
            <li>“Skip to content” link and landmark regions</li>
            <li>Visible keyboard focus rings</li>
            <li>Labelled form fields and live status messages</li>
            <li>Keyboard-operable mobile menu with ARIA state</li>
            <li>Respects “reduce motion” system setting</li>
            <li>48px touch targets for buttons and inputs</li>
          </ul>
        </Card>
      </div>
      <Card title="Checks">
        <Checks checks={checks} onFix={fix} />
      </Card>
    </div>
  );
}
