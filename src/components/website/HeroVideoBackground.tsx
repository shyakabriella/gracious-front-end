"use client";

import { useEffect, useRef, useState } from "react";

const VIDEOS = [
  "/hero-videos/1.mp4",
  "/hero-videos/2.mp4",
  "/hero-videos/3.mp4",
  "/hero-videos/4.mp4",
  "/hero-videos/5.mp4",
  "/hero-videos/6.mp4",
] as const;

export default function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [errors, setErrors] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const update = () => {
      setReducedMotion(media.matches);
    };

    update();

    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  function nextVideo() {
    setReady(false);
    setIndex((current) => (current + 1) % VIDEOS.length);
  }

  function handleError() {
    setErrors((current) => current + 1);
    nextVideo();
  }

  function handleReady() {
    setReady(true);
    setErrors(0);

    const video = videoRef.current;

    if (video) {
      void video.play().catch(() => {
        // Keep the green fallback if autoplay is blocked.
      });
    }
  }

  const enabled = !reducedMotion && errors < VIDEOS.length;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {enabled && (
        <video
          key={index}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          onLoadedData={handleReady}
          onEnded={nextVideo}
          onError={handleError}
          className={`absolute inset-0 h-full w-full
            object-cover transition-opacity duration-700
            motion-reduce:transition-none
            ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <source
            src={VIDEOS[index]}
            type="video/mp4"
          />
        </video>
      )}

      <div
        className="absolute inset-0
          bg-gradient-to-b
          from-[#00180F]/75
          via-[#00180F]/40
          to-[#00180F]/80"
      />
    </div>
  );
}
