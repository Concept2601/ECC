import { useStore } from './store';
import { go, type Area } from './router';

/** Map an audit "fix" hint to the studio tab that resolves it. */
const FIX_ROUTE: Record<string, [Area, string]> = {
  design: ['frontend', 'design'],
  pages: ['frontend', 'pages'],
  media: ['frontend', 'media'],
  speed: ['frontend', 'speed'],
  seo: ['backend', 'seo'],
  settings: ['backend', 'settings'],
  domains: ['backend', 'domains'],
  hosting: ['backend', 'hosting'],
  integrations: ['backend', 'integrations'],
};

export function useFix() {
  const { site } = useStore();
  return (fix: string) => {
    const [area, tab] = FIX_ROUTE[fix] ?? ['frontend', 'design'];
    if (site) go({ name: 'studio', siteId: site.id, area, tab });
  };
}
