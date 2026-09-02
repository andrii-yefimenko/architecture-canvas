import { ChallengeCard } from '@/components/catalog/ChallengeCard';
import { challengeRegistry } from '@/challenges';

/**
 * The landing page (FR-002): one card per Challenge in the Challenge
 * Registry, in Registry order — never sorted or computed.
 */
export function CatalogPage({ navigate }: { readonly navigate: (path: string) => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-semibold tracking-tight text-slate-900">Architecture Canvas</h1>
        <p className="mt-1 text-xs text-slate-500">Pick a Challenge to start designing.</p>
      </header>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        {challengeRegistry.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}
