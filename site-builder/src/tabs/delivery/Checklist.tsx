import { useMemo } from 'react';
import { useSite } from '../../store';
import { launchChecklist, blockers } from '../../lib/launch';
import { score } from '../../lib/audits';
import { href } from '../../router';
import { Card, Checks, PageHead, Score } from '../../components/ui';
import { useFix } from '../../hooks';

export function ChecklistTab() {
  const { site } = useSite();
  const fix = useFix();
  const groups = useMemo(() => launchChecklist(site), [site]);
  const all = groups.flatMap((g) => g.checks);
  const block = blockers(groups);
  const warns = all.filter((c) => c.status === 'warn').length;
  return (
    <div className="tab-page">
      <PageHead
        title="Launch checklist"
        subtitle="Everything a professional site needs before going live."
        actions={<a className="btn" href={href({ name: 'studio', siteId: site.id, area: 'delivery', tab: 'launch' })}>Continue to launch →</a>}
      />
      <Card>
        <div className="row gap-lg">
          <Score value={score(all)} label="Ready" size={110} />
          <div>
            <h3>{block.length ? `${block.length} blocker${block.length > 1 ? 's' : ''} to fix` : warns ? 'Ready to launch — with a few suggestions' : 'Everything looks great 🎉'}</h3>
            <p className="muted">{all.filter((c) => c.status === 'pass').length} passed · {warns} suggestions · {block.length} blockers</p>
          </div>
        </div>
      </Card>
      <div className="grid-2col">
        {groups.map((g) => (
          <Card key={g.title} title={g.title} subtitle={`${g.checks.filter((c) => c.status === 'pass').length}/${g.checks.length} complete`}>
            <Checks checks={g.checks} onFix={fix} />
          </Card>
        ))}
      </div>
    </div>
  );
}
