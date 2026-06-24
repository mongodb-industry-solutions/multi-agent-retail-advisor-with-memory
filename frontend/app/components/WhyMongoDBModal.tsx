"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { H2, Body } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { Icon } from "@leafygreen-ui/icon";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WhyMongoDBModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 780, maxHeight: "82vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0"
          style={{ borderRadius: "16px 16px 0 0" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22 }}>🍃</span>
            <H2 style={{ margin: 0, color: palette.green.dark2, fontSize: 20 }}>
              Why MongoDB
            </H2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icon glyph="X" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={(i) => setActiveTab(i as number)}
            aria-label="Why MongoDB"
          >
            <Tab name="Architecture">
              <div className="p-6">
                <Body className="text-gray-400 italic">Coming soon</Body>
              </div>
            </Tab>

            <Tab name="Document Model">
              <div className="p-6">
                <Body className="text-gray-400 italic">Coming soon</Body>
              </div>
            </Tab>

            <Tab name="Search & Vector Search">
              <div className="p-6">
                <Body className="text-gray-400 italic">Coming soon</Body>
              </div>
            </Tab>

            <Tab name="Voyage AI">
              <div className="p-6">
                <Body className="text-gray-400 italic">Coming soon</Body>
              </div>
            </Tab>

            <Tab name="Auto Embedding">
              <div className="p-6">
                <Body className="text-gray-400 italic">Coming soon</Body>
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>,
    document.body
  );
}
