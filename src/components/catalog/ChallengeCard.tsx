import type { Challenge } from '@/domain/types';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * One Catalog Page card (FR-003): title, Difficulty, short description, Tags,
 * and a Start Challenge control that navigates to `/challenge/:id` (FR-004).
 */
export function ChallengeCard({
  challenge,
  navigate,
}: {
  readonly challenge: Challenge;
  readonly navigate: (path: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{challenge.title}</h2>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {capitalize(challenge.difficulty)}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-slate-600">{challenge.shortDescription}</p>

      <ul className="flex flex-wrap gap-1.5">
        {challenge.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500"
          >
            {tag}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => navigate(`/challenge/${challenge.id}`)}
        className="mt-1 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Start Challenge
      </button>
    </article>
  );
}
