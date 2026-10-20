import { DEMO } from '../demo';

export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="demo-banner" role="note">
      <strong>Preview edition.</strong> Designing, pages, media, SEO, audits, versions and the launch checklist all work here, and your work is saved in this browser.
      Publishing, website analysis, DNS checks and file downloads need the installed studio.
    </div>
  );
}
