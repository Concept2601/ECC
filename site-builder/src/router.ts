import { useEffect, useState } from 'react';

export type Area = 'frontend' | 'backend' | 'delivery';

export type Route =
  | { name: 'landing' }
  | { name: 'projects' }
  | { name: 'studio'; siteId: string; area: Area; tab: string }
  | { name: 'preview'; siteId: string; pageId?: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'preview' && parts[1]) return { name: 'preview', siteId: parts[1], pageId: parts[2] };
  if (parts[0] === 'studio' && parts[1]) {
    const area = (['frontend', 'backend', 'delivery'].includes(parts[2]) ? parts[2] : 'frontend') as Area;
    return { name: 'studio', siteId: parts[1], area, tab: parts[3] ?? '' };
  }
  return { name: 'landing' };
}

export const href = (r: Route) => {
  switch (r.name) {
    case 'landing':
      return '#/';
    case 'projects':
      return '#/projects';
    case 'preview':
      return `#/preview/${r.siteId}${r.pageId ? `/${r.pageId}` : ''}`;
    case 'studio':
      return `#/studio/${r.siteId}/${r.area}${r.tab ? `/${r.tab}` : ''}`;
  }
};

export function openPreview(siteId: string, pageId?: string) {
  window.open(href({ name: 'preview', siteId, pageId }), '_blank');
}

export const go = (r: Route) => {
  window.location.hash = href(r);
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
