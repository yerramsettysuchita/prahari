"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Case, ISSUE_LABEL, Verification, verifyResolution } from "@/lib/api";
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
  const storedBefore = caseItem.photos?.before?.[0] || null;

  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);

  const makePicker = useCallback(
    (
      setFile: (f: File) => void,
      setPreview: (s: string) => void,
      prev: string | null
    ) =>
      (file: File | undefined | null) => {
        if (!file) return;
        setFile(file);
        if (prev) URL.revokeObjectURL(prev);
        setPreview(URL.createObjectURL(file));
        setError(null);
      },
    []
  );

  const pickBefore = makePicker(setBeforeFile, setBeforePreview, beforePreview);
  const pickAfter = makePicker(setAfterFile, setAfterPreview, afterPreview);

  // The before image is either already stored, or one the user uploads now.
  const beforeSrc = storedBefore || beforePreview;
  const beforeReady = !!beforeSrc;
  const canSubmit = !!afterFile && beforeReady && !submitting;

  const submit = useCallback(async () => {
    if (!afterFile || !beforeReady) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyResolution(
        caseItem.id,
        afterFile,
        beforeFile ?? undefined
      );
      setVerification(res.verification);
      onVerified(res.case);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The verification could not be completed."
      );
    } finally {
      setSubmitting(false);
    }
  }, [afterFile, beforeFile, beforeReady, caseItem.id, onVerified]);

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
          {/* The before and after pair. Both are uploadable, before is locked
              once a stored photo exists. This is the hero visual of the step. */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
            <Frame
              label="Before"
              src={beforeSrc}
              editable={!storedBefore && !verification}
              onFile={pickBefore}
              placeholder="Click to upload the before photo."
            />
            <div className="border-l border-line">
              <Frame
                label="After"
                src={afterPreview}
                editable={!verification}
                onFile={pickAfter}
                placeholder="Click to upload the after photo."
              />
            </div>
          </div>

          {!verification ? (
            <div className="mt-5">
              <p className="font-body text-sm text-muted">
                {!beforeReady
                  ? "Upload the before photo to compare against."
                  : !afterFile
                  ? "Now upload the after photo of the same spot."
                  : "Both photos ready. Run the vision check."}
              </p>

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
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
  editable = false,
  onFile,
  placeholder,
}: {
  label: string;
  src: string | null;
  editable?: boolean;
  onFile?: (f: File | undefined | null) => void;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onClick={() => editable && input.current?.click()}
      onDragOver={(e) => {
        if (!editable) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!editable) return;
        e.preventDefault();
        setDragging(false);
        onFile?.(e.dataTransfer.files?.[0]);
      }}
      className={`relative aspect-[4/3] bg-ink ${
        editable ? "cursor-pointer" : ""
      } ${dragging ? "ring-1 ring-accent" : ""}`}
    >
      <span className="absolute left-3 top-3 z-10 rounded-md bg-primary px-2 py-0.5 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
        {label}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center">
          <span className="font-body text-sm text-muted">
            {editable ? placeholder : "No photo on file."}
          </span>
        </div>
      )}
      {editable ? (
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile?.(e.target.files?.[0])}
        />
      ) : null}
    </div>
  );
}
