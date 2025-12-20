import React, { useState, useRef, useEffect, memo } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

// Memoized component with smooth loading animation and IntersectionObserver
export const LazyImage: React.FC<LazyImageProps> = memo(
  ({ src, alt, className = "", placeholderClassName = "" }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              if (imgRef.current) {
                observer.unobserve(imgRef.current);
              }
            }
          });
        },
        {
          rootMargin: "200px", // Load before it comes into view
          threshold: 0.1,
        }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
      };
    }, []);

    return (
      <div
        ref={imgRef}
        className={`relative overflow-hidden ${placeholderClassName}`}
      >
        {/* Animated shimmer placeholder */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-out ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 bg-neutral-800" />
          <div className="absolute inset-0 shimmer-effect" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white/10"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        </div>

        {/* Image with smooth scale + fade animation */}
        {isVisible && (
          <img
            src={src}
            alt={alt}
            className={`${className} transition-all duration-300 ease-out ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            onLoad={() => setIsLoaded(true)}
            decoding="async"
            loading="lazy"
          />
        )}
      </div>
    );
  }
);
