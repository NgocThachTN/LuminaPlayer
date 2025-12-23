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
        style={{ contain: 'paint' }} // Optimization: Isolate paint
      >
        {/* Optimized Shimmer Placeholder */}
        <div className={`absolute inset-0 bg-neutral-800 ${!isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 overflow-hidden`}>
           {!isLoaded && (
             <div 
               className="absolute inset-0 -inset-x-full"
               style={{
                 background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)', // Lighter gradient
                 transform: 'skewX(-20deg)',
                 animation: 'shimmer-slide 1.5s infinite linear',
               }}
             />
           )}
          
          <style>{`
            @keyframes shimmer-slide {
              0% { transform: translateX(-150%) skewX(-20deg); }
              100% { transform: translateX(150%) skewX(-20deg); }
            }
          `}</style>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
             <svg
                className="w-12 h-12 text-white/10 scale-50"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
          </div>
        </div>

        {/* Image with Scale + Fade animation */}
        {isVisible && (
          <img
            src={src}
            alt={alt}
            className={`${className} relative z-10 transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-102"
            }`}
            style={{ backfaceVisibility: 'hidden' }}
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
