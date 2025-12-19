import React, { useState, useEffect } from "react";
import { getApiKey, setApiKey, hasApiKey } from "../services/geminiService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ApiKeyModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKeyValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKey();
    }
  }, [isOpen]);

  const loadApiKey = async () => {
    const key = await getApiKey();
    setApiKeyValue(key);
    setHasKey(!!key);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await setApiKey(apiKey);
    setIsSaving(false);
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="bg-neutral-900 border border-white/10 p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-2">Gemini API Key</h2>
        <p className="text-white/40 text-sm mb-6">
          Nhập API key để sử dụng Gemini AI tìm lyrics khi không có trên lrclib.
          <br />
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Lấy API key tại đây →
          </a>
        </p>

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKeyValue(e.target.value)}
          placeholder="AIza..."
          className="w-full bg-black border border-white/20 px-4 py-3 text-sm font-mono focus:outline-none focus:border-white/50 mb-6"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-white/20 text-white/60 hover:bg-white/5 text-sm uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest font-bold disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {hasKey && (
          <p className="text-green-400/60 text-xs mt-4 text-center">
            ✓ API key đã được lưu
          </p>
        )}
      </div>
    </div>
  );
};



