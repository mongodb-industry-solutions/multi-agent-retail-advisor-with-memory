"use client";

import { useState } from "react";
import { Modal } from "@leafygreen-ui/modal";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { H2 } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { ArchitectureTab } from "./why-mongodb/ArchitectureTab";
import { DocumentModelTab } from "./why-mongodb/DocumentModelTab";
import { SearchVectorTab } from "./why-mongodb/SearchVectorTab";
import { VoyageAITab } from "./why-mongodb/VoyageAITab";
import { AutoEmbeddingTab } from "./why-mongodb/AutoEmbeddingTab";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WhyMongoDBModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Modal open={open} setOpen={(v) => { if (!v) onClose(); }} size="large">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ fontSize: 22 }}>🍃</span>
        <H2 style={{ margin: 0, color: palette.green.dark2, fontSize: 20 }}>
          Why MongoDB
        </H2>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(i) => setActiveTab(i as number)}
        aria-label="Why MongoDB"
      >
        <Tab name="Architecture">
          <ArchitectureTab />
        </Tab>

        <Tab name="Document Model">
          <DocumentModelTab />
        </Tab>

        <Tab name="Search & Vector Search">
          <SearchVectorTab />
        </Tab>

        <Tab name="Voyage AI">
          <VoyageAITab />
        </Tab>

        <Tab name="Auto Embedding">
          <AutoEmbeddingTab />
        </Tab>
      </Tabs>
    </Modal>
  );
}
