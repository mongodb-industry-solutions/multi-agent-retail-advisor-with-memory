"use client";

import Image from "next/image";
import { InlineCode } from "@leafygreen-ui/typography";
import { Callout } from "@leafygreen-ui/callout";
import { palette } from "@leafygreen-ui/palette";

const MODEL_ROWS = [
  {
    model: "voyage-4-large",
    use: "Catalog indexing",
    cost: "Higher",
    when: "Once (on insert)",
  },
  {
    model: "voyage-4-lite",
    use: "Query embedding",
    cost: "Significantly lower",
    when: "Every search",
  },
];

export function VoyageAITab() {
  return (
    <div className="p-6 space-y-5">
      <p className="text-sm text-gray-700">
        Voyage 4 introduces a{" "}
        <a
          href="https://blog.voyageai.com/2026/01/15/voyage-4/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: palette.green.dark2, textDecoration: "underline" }}
        >
          shared embedding space
        </a>
        {" "}— embed your catalog once with the best model, query with the fastest. No re-indexing ever.
      </p>

      {/* Asymmetric retrieval diagram */}
      <Image
        src="/images/asymmetric-retrieval.svg"
        alt="Asymmetric retrieval diagram"
        width={700}
        height={300}
        style={{ width: "100%", height: "auto", marginTop: "-20px" }}
      />

      {/* Comparison table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: palette.green.light3 }}>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Model</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Used for</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Cost</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Runs</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_ROWS.map(({ model, use, cost, when }) => (
              <tr key={model} className="border-t border-gray-100">
                <td className="px-3 py-2"><InlineCode>{model}</InlineCode></td>
                <td className="px-3 py-2 text-gray-600">{use}</td>
                <td className="px-3 py-2 text-gray-600">{cost}</td>
                <td className="px-3 py-2 text-gray-600">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout variant="important" title="Dedicated Search Nodes">
        In production, spin up search-specific nodes so vector and text search operations never
        compete with your operational workload for CPU and memory.
      </Callout>
    </div>
  );
}
