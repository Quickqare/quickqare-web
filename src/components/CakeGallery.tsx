import { useState } from "react";

/**
 * CakeGallery — simple multi-angle product photo gallery (Amazon/Flipkart
 * style): one large image plus a thumbnail strip to jump between shots.
 * No drag/rotate simulation — bakers just need a handful of clear photos
 * (front, top, side, a close-up), not evenly-spaced turntable frames.
 */
export default function CakeGallery({ photos, className = "" }: { photos: string[]; className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!photos.length) return null;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/3]">
        <img
          src={photos[activeIndex]}
          alt="Cake"
          className="w-full h-full object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center text-lg"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i + 1) % photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center text-lg"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {photos.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                i === activeIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
