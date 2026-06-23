"use client";

import type { ReactNode } from "react";
import { Subtitle } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { spacing } from "@leafygreen-ui/tokens";
import Button from "@leafygreen-ui/button";

type WhyMongoDBBannerProps = {
  children: ReactNode;
  title?: string;
  onLearnMore?: () => void;
  learnMoreLabel?: string;
};

export default function WhyMongoDBBanner({
  children,
  title = "🍃 Why MongoDB?",
  onLearnMore,
  learnMoreLabel = "✨ Learn More",
}: WhyMongoDBBannerProps) {
  return (
    <div
      style={{
        background: palette.green.light3,
        border: `1px solid ${palette.green.light2}`,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          marginBottom: spacing[200],
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing[100],
        }}
      >
        <Subtitle style={{ color: palette.green.dark2, margin: 0 }}>
          {title}
        </Subtitle>
        {onLearnMore && (
          <Button size="small" variant="default" onClick={onLearnMore}>
            {learnMoreLabel}
          </Button>
        )}
      </div>
      <div style={{ color: palette.gray.dark2, margin: 0 }}>{children}</div>
    </div>
  );
}
