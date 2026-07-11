import { useEffect, useState } from "react";

/**
 * PhotoCarousel — compact multi-photo slider for service cards: photos
 * auto-slide left every few seconds (same idea as the home banner), with
 * prev/next arrows + dot indicators. No zoom. Shown when a service has an
 * admin-uploaded web photo gallery (webMedia360); single-photo services keep
 * their plain <img>. Fills its parent, so the parent controls the aspect
 * ratio. Auto-slide pauses while the mouse is over the card.
 */
export default function PhotoCarousel({
  photos,
  alt,
  imgClassName = "",
  intervalMs = 3500,
  autoSlide = true,
}: {
  photos: string[];
  alt: string;
  imgClassName?: string;
  intervalMs?: number;
  // Admin can turn auto-rotation off per service (Service.autoSlideEnabled);
  // arrows and dots keep working either way.
  autoSlide?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance — re-armed on every index change (so a manual arrow click
  // restarts the timer), paused on hover.
  useEffect(() => {
    if (!autoSlide || photos.length <= 1 || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % photos.length), intervalMs);
    return () => clearTimeout(t);
  }, [index, paused, photos.length, intervalMs, autoSlide]);

  if (!photos.length) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Sliding track */}
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={alt}
            className={`w-full h-full shrink-0 ${imgClassName}`}
            loading={i === 0 ? undefined : "lazy"}
          />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center text-sm leading-none transition"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center text-sm leading-none transition"
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1" aria-hidden="true">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
