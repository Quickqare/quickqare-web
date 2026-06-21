import { useState } from "react";
import client from "../api/client";

type Props = { bookingId: string; onClose: () => void };

const TAGS_GOOD = ["Professional", "On time", "Clean work", "Friendly", "Great value"];
const TAGS_BAD  = ["Late arrival", "Poor quality", "Unprofessional", "Overcharged", "Rude"];

export default function RatingModal({ bookingId, onClose }: Props) {
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const tags = stars >= 4 ? TAGS_GOOD : TAGS_BAD;

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSubmit = async () => {
    if (stars === 0) return;
    if (stars <= 2 && !review.trim()) return;
    setSubmitting(true);
    try {
      await client.post("/api/ratings", {
        bookingId,
        rating: stars,
        tags: selectedTags,
        review: review.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(onClose, 1500);
    } catch { onClose(); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-6">
        {submitted ? (
          <div className="text-center py-6">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-bold text-ink text-lg">Thank you!</p>
            <p className="text-sm text-muted mt-1">Your feedback helps us improve.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-ink text-lg">Rate your experience</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-ink text-2xl leading-none">×</button>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => { setStars(s); setSelectedTags([]); }}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  <span className={(hoveredStar || stars) >= s ? "text-yellow-400" : "text-gray-200"}>★</span>
                </button>
              ))}
            </div>

            {/* Tags */}
            {stars > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                      selectedTags.includes(tag)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted hover:border-primary"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Review text */}
            {stars > 0 && (
              <div className="mb-4">
                <textarea
                  className="input resize-none text-sm"
                  rows={3}
                  placeholder={stars <= 2 ? "Tell us what went wrong (required)…" : "Add a comment (optional)…"}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={stars === 0 || submitting || (stars <= 2 && !review.trim())}
                className="flex-1 btn-primary disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button onClick={onClose} className="px-4 text-sm text-muted hover:text-ink transition">
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
