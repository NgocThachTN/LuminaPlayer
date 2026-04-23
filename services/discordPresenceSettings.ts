const STORAGE_KEY = "lumina.discordPresenceEnabled";
const CHANGE_EVENT = "lumina:discord-presence-changed";

const isElectron = !!window.electronAPI;

export const getDiscordPresenceEnabled = async (): Promise<boolean> => {
  if (isElectron && window.electronAPI?.getDiscordPresenceEnabled) {
    const enabled = await window.electronAPI.getDiscordPresenceEnabled();
    localStorage.setItem(STORAGE_KEY, String(enabled));
    return enabled;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? true : saved === "true";
};

export const setDiscordPresenceEnabled = async (enabled: boolean): Promise<boolean> => {
  localStorage.setItem(STORAGE_KEY, String(enabled));

  if (isElectron && window.electronAPI?.setDiscordPresenceEnabled) {
    await window.electronAPI.setDiscordPresenceEnabled(enabled);
  }

  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: enabled,
    })
  );

  return enabled;
};

export const subscribeDiscordPresenceEnabled = (
  listener: (enabled: boolean) => void
): (() => void) => {
  const handleChange = (event: Event) => {
    const enabled = (event as CustomEvent<boolean>).detail;
    listener(typeof enabled === "boolean" ? enabled : true);
  };

  window.addEventListener(CHANGE_EVENT, handleChange as EventListener);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange as EventListener);
  };
};
