"use client";

import { ParsedArtifact } from "@/lib/artifacts";
import { ArtifactPreview } from "./ArtifactPreview";

type ArtifactPanelProps = {
  artifact: ParsedArtifact | null;
  onClose: () => void;
};

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  if (!artifact) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 lg:relative lg:w-[500px] lg:shadow-none">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <ArtifactPreview artifact={artifact} />
      </div>
    </>
  );
}
