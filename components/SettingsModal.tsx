import React, { useEffect, useState } from "react";
import {
  getDiscordPresenceEnabled,
  setDiscordPresenceEnabled,
} from "../services/discordPresenceSettings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [discordPresenceEnabled, setDiscordPresenceEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    void getDiscordPresenceEnabled().then((enabled) => {
      if (isMounted) {
        setDiscordPresenceEnabledState(enabled);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleToggle = async () => {
    const nextValue = !discordPresenceEnabled;
    setIsLoading(true);
    setDiscordPresenceEnabledState(nextValue);

    try {
      await setDiscordPresenceEnabled(nextValue);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="mx-4 w-full max-w-md border border-white/10 bg-neutral-900 p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Settings</h2>
            <p className="mt-2 text-sm text-white/45">
              Bật hoặc tắt Discord Rich Presence khi đang nghe nhạc.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 transition-colors hover:text-white"
            aria-label="Close settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Discord Presence</p>
              <p className="mt-1 text-xs text-white/45">
                Hiển thị bài hát đang phát trên Discord.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggle}
              disabled={isLoading}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                discordPresenceEnabled ? "bg-white" : "bg-white/15"
              } ${isLoading ? "cursor-wait opacity-70" : ""}`}
              aria-pressed={discordPresenceEnabled}
              title="Toggle Discord Presence"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full transition-all ${
                  discordPresenceEnabled ? "left-7 bg-black" : "left-1 bg-white"
                }`}
              />
            </button>
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/30">
            {discordPresenceEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-3 text-sm uppercase tracking-widest text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
