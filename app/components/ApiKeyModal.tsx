
import React, { useState, useEffect } from "react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    onSave(apiKey);
    onClose();
    // Dispatch event to notify listeners (like services)
    window.dispatchEvent(new Event('storage'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative bg-[#1a1a1a] rounded-xl border border-white/10 p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-white">Gemini API Key</h2>
        <p className="text-sm text-gray-400 mb-4">
          Enter your Gemini API key to enable AI-powered lyrics generation and metadata enhancement.
        </p>
        
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API Key"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-white/30 transition-colors"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};
