"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Case,
  ISSUE_LABEL,
  Verification,
  verifyResolution,
} from "@/lib/api";
import { LoadingLine } from "./LoadingLine";

export function VerifyPanel({
  caseItem,
  onClose,
  onVerified,
}: {
  caseItem: Case;
  onClose: () => void;
  onVerified: (updated: Case) => void;
}) {
  const beforeUrl = caseItem.photos?.before?.[0] || null;
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pick = useCallback((file: File | undefined | null) => {
    if (!file) return;
    setAfterFile(file);
    setAfterPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!afterFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyResolution(caseItem.id, afterFile);
      setVerification(res.verification);
      onVerified(res.case);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The verification could not be completed."
      );
    } finally {
      setSubmitting(false);
    }
  }, [afterFile, caseItem.id, onVerified]);

  const resolved = verification?.verdict === "verified_resolved";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/85 p-4 backdrop-blur-sm md:items-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-3xl rounded-lg border border-line bg-surface shadow-soft"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Verify resolution
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tightish text-primary">
              {ISSUE_LABEL[caseItem.type]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-body text-xs uppercase tracking-[0.12em] text-muted hover:text-primary"
          >
            Close
          </button>
        </header>

        <div className="px-6 py-6">
          {/* The before and after pair: the hero visual of this step */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
            <Frame label="Before" src={beforeUrl} />
            <div className="border-l border-line">
              <Frame
                label="After"
                src={afterPreview}
                placeholder="Upload a follow-up photo of the same spot."
              />
            </div>
          </div>

          {/* Upload control (hidden once a verdict is in) */}
          {!verification ? (
            <div className="mt-5">
              <div
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
                className={`flex h-16 cursor-pointer items-center justify-center rounded-lg border border-dashed transition-colors ${
                  dragging ? "border-accent bg-accent/5" : "border-line bg-ink"
                }`}
              >
                <span className="px-4 text-center font-body text-sm text-muted">
                  {afterFile
                    ? "Follow-up photo ready. Run the check below."
                    : "Drag the after photo here, or click to choose one."}
                </span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />

              <button
                type="button"
                onClick={submit}
                disabled={!afterFile || submitting}
                className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-body text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Run vision check
              </button>

              <AnimatePresence>
                {submitting ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-5"
                  >
                    <LoadingLine label="Comparing before and after with Gemini Vision" />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {error ? (
                <p className="mt-4 rounded-lg border border-line bg-ink px-3 py-2 font-body text-sm text-muted">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Verdict */}
          <AnimatePresence>
            {verification ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`mt-5 rounded-lg border p-5 ${
                  resolved
                    ? "border-positive/40 bg-positive/10"
                    : "border-line bg-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      resolved ? "bg-positive" : "bg-accent"
                    }`}
                  />
                  <span
                    className={`font-display text-xl font-semibold tracking-tightish ${
                      resolved ? "text-positive" : "text-primary"
                    }`}
                  >
                    {resolved ? "Verified resolved" : "Needs review"}
                  </span>
                </div>
                <p className="mt-3 font-body text-sm leading-relaxed text-primary">
                  {verification.reasoning}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 font-body text-xs tabular-nums text-muted">
                  <span>
                    Confidence {Math.round(verification.confidence * 100)} percent
                  </span>
                  <span>
                    Same location {verification.sameLocation ? "yes" : "no"}
                  </span>
                </div>
                <p className="mt-3 font-body text-xs text-muted">
                  {verification.provenance}
                </p>

                <button
                  onClick={onClose}
                  className="mt-5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 font-body text-sm font-medium text-primary transition-colors hover:border-accent/60"
                >
                  Done
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function Frame({
  label,
  src,
  placeholder,
}: {
  label: string;
  src: string | null;
  placeholder?: string;
}) {
  return (
    <div className="relative aspect-[4/3] bg-ink">
      <span className="absolute left-3 top-3 z-10 rounded-md border border-line bg-ink/80 px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center">
          <span className="font-body text-sm text-muted">
            {placeholder || "No photo on file."}
          </span>
        </div>
      )}
    </div>
  );
}
