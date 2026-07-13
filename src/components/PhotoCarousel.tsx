import { useEffect, useState } from "react";

/**
 * PhotoCarousel — compact multi-photo slider for service cards: photos
 * auto-slide left every few seconds (same idea as the home banner), with
 * dot indicators. No arrows, no zoom. Shown when a service has an
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
  // Admin can turn auto-rotation off per service (Service.webAutoSlideEnabled);
  // dots keep working either way.
  autoSlide?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // True for the one frame that snaps from the last photo back to the first —
  // suppresses the transition so that wrap doesn't visibly slide backward
  // through every photo (every other step slides forward/left as normal).
  const [instant, setInstant] = useState(false);

  // Auto-advance — re-armed on every index change, paused on hover.
  useEffect(() => {
    if (!autoSlide || photos.length <= 1 || paused) return;
    const t = setTimeout(() => {
      setIndex((i) => {
        const next = i + 1;
        if (next >= photos.length) {
          setInstant(true);
          return 0;
        }
        return next;
      });
    }, intervalMs);
    return () => clearTimeout(t);
  }, [index, paused, photos.length, intervalMs, autoSlide]);

  // Re-enable the transition on the next frame, after the instant jump painted.
  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  if (!photos.length) return null;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Sliding track */}
      <div
        className={`flex h-full ${instant ? "" : "transition-transform duration-500 ease-out"}`}
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
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1" aria-hidden="true">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
