import React, { useState, useRef, useEffect, memo } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

// Optimized memoized component with faster loading animation
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
          rootMargin: "100px", // Reduced from 200px
          threshold: 0.01,
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
        {/* Static placeholder - no animation for better performance */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white/10"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {/* Image with faster fade animation */}
        {isVisible && (
          <img
            src={src}
            alt={alt}
            className={`${className} transition-opacity duration-150 ease-out ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setIsLoaded(true)}
            decoding="async"
            loading="lazy"
          />
        )}
      </div>
    );
  },
  // Custom comparison - only re-render if src changes
  (prevProps, nextProps) => prevProps.src === nextProps.src
);
