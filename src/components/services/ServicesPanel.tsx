import { useMemo } from 'react';
import { useSession } from '@/state/session-context';
import { ServiceCatalogItem } from './ServiceCatalogItem';

/** Lists every Service available to the Challenge, grouped by category (FR-008). */
export function ServicesPanel() {
  const { challenge } = useSession();

  const services = challenge.services;

  // Preserves first-appearance order of categories from the Challenge data.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof services>();
    for (const service of services) {
      map.set(service.category, [...(map.get(service.category) ?? []), service]);
    }
    return [...map.entries()];
  }, [services]);

  return (
    <div className="flex flex-col gap-5">
      {grouped.map(([category, services]) => (
        <div key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {category}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {services.map((service) => (
              <li key={service.id}>
                <ServiceCatalogItem service={service} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
