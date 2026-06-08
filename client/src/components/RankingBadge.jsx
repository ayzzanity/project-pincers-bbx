const rankStyles = {
  1: 'border-bbx-gold bg-bbx-gold text-bbx-ink shadow-[0_8px_18px_rgba(245,180,51,0.28)]',
  2: 'border-bbx-silver bg-bbx-silver text-bbx-ink',
  3: 'border-bbx-bronze bg-bbx-bronze text-white'
};

export default function RankingBadge({ rank, size = 'md' }) {
  const sizing = size === 'lg' ? 'h-14 min-w-14 px-4 text-2xl' : 'h-8 min-w-8 px-2 text-sm';
  const style = rankStyles[rank] || 'border-bbx-line bg-white text-bbx-ink';

  return (
    <span
      className={`rank-number inline-flex items-center justify-center rounded border-2 font-black leading-none ${sizing} ${style}`}
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  );
}
