"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Case,
  ISSUE_LABEL,
  ReportResult,
  submitReport,
} from "@/lib/api";
import { LoadingLine } from "./LoadingLine";
import { SeverityTag } from "./SeverityTag";
import { useCountUp } from "./useCountUp";
import { RoutedDept } from "./RoutedDept";
import { AgentTrace } from "./AgentTrace";
import { useVoiceRecorder } from "./useVoiceRecorder";

type Coords = { lat: number; lng: number };

export function ReportPanel({ onCreated }: { onCreated: (c: Case) => void }) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  const pickImage = useCallback((file: File | undefined | null) => {
    if (!file) return;
    setImage(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
  }, []);

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share location. Enter it manually below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Could not read your location. Enter it manually below.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // A photo or a voice note, plus a location, is enough to submit.
  const canSubmit =
    !!coords && (!!image || !!voice.audioFile) && !submitting && !voice.recording;

  const submit = useCallback(async () => {
    if (!coords || (!image && !voice.audioFile)) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await submitReport({
        lat: coords.lat,
        lng: coords.lng,
        note: note.trim() || undefined,
        image,
        audio: voice.audioFile,
      });
      setResult(outcome);
      onCreated(outcome.case);
      voice.reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong submitting the report."
      );
    } finally {
      setSubmitting(false);
    }
  }, [image, coords, note, onCreated, voice]);

  return (
    <section className="rounded-lg border border-line bg-surface p-6 shadow-soft">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tightish text-primary">
          Report a road issue
        </h2>
        <p className="mt-1 font-body text-sm text-muted">
          Add a photo and your location. An agent classifies it the moment you
          submit.
        </p>
      </header>

      {/* Image upload */}
      <div className="mt-6">
        <label className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Photo
        </label>
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
            pickImage(e.dataTransfer.files?.[0]);
          }}
          className={`mt-2 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors ${
            dragging ? "border-accent bg-accent/5" : "border-line bg-ink"
          } ${preview ? "h-48" : "h-32"}`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Selected road issue"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-4 text-center font-body text-sm text-muted">
              Drag a photo here, or click to choose one.
            </span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0])}
        />
      </div>

      {/* Location */}
      <div className="mt-6">
        <label className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Location
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="rounded-lg border border-line bg-ink px-4 py-2 font-body text-sm font-medium text-primary transition-colors hover:border-accent/60 disabled:opacity-50"
          >
            {locating ? "Locating you" : "Use my location"}
          </button>
          {coords ? (
            <span className="font-body text-sm tabular-nums text-muted">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          ) : null}
        </div>
        {/* Manual fallback */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input
            inputMode="decimal"
            placeholder="Latitude"
            value={coords?.lat ?? ""}
            onChange={(e) =>
              setCoords((c) => ({
                lat: parseFloat(e.target.value) || 0,
                lng: c?.lng ?? 0,
              }))
            }
            className="rounded-lg border border-line bg-ink px-3 py-2 font-body text-sm text-primary tabular-nums outline-none focus:border-accent/60"
          />
          <input
            inputMode="decimal"
            placeholder="Longitude"
            value={coords?.lng ?? ""}
            onChange={(e) =>
              setCoords((c) => ({
                lat: c?.lat ?? 0,
                lng: parseFloat(e.target.value) || 0,
              }))
            }
            className="rounded-lg border border-line bg-ink px-3 py-2 font-body text-sm text-primary tabular-nums outline-none focus:border-accent/60"
          />
        </div>
      </div>

      {/* Voice note */}
      <div className="mt-6">
        <label className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Voice note (optional)
        </label>
        <p className="mt-1 font-body text-xs text-muted">
          Speak in Telugu, Kannada, Hindi, or English. An agent transcribes and
          translates it.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!voice.recording ? (
            <button
              type="button"
              onClick={voice.start}
              disabled={submitting || voice.processing}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink px-4 py-2 font-body text-sm font-medium text-primary transition-colors hover:border-accent/60 disabled:opacity-50"
            >
              <MicIcon />
              {voice.audioFile ? "Record again" : "Record"}
            </button>
          ) : (
            <button
              type="button"
              onClick={voice.stop}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 font-body text-sm font-medium text-danger transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 rounded-full bg-danger animate-pulse-soft" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
              </span>
              Stop recording
            </button>
          )}
          {voice.processing ? (
            <span className="font-body text-xs text-muted">Processing audio</span>
          ) : voice.audioFile ? (
            <span className="font-body text-xs text-positive">
              Voice note ready
            </span>
          ) : null}
        </div>
        {voice.error ? (
          <p className="mt-2 font-body text-xs text-muted">{voice.error}</p>
        ) : null}
      </div>

      {/* Note */}
      <div className="mt-6">
        <label className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Anything the photo does not show."
          className="mt-2 w-full resize-none rounded-lg border border-line bg-ink px-3 py-2 font-body text-sm text-primary outline-none placeholder:text-muted/70 focus:border-accent/60"
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-3 font-body text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit report
      </button>
      {(!image && !voice.audioFile) || !coords ? (
        <p className="mt-2 font-body text-xs text-muted">
          A photo or a voice note, plus a location, is needed to submit.
        </p>
      ) : null}

      {/* Loading state */}
      <AnimatePresence>
        {submitting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <LoadingLine label="Classifying with the intake agent" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Error */}
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-ink px-3 py-2 font-body text-sm text-muted">
          {error}
        </p>
      ) : null}

      {/* Live outcome: merged into an existing case, or a new case */}
      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 space-y-4"
          >
            {result.trace && result.trace.length > 0 ? (
              <AgentTrace steps={result.trace} />
            ) : null}
            {result.merged ? (
              <MergedOutcome result={result} />
            ) : (
              <NewCaseOutcome caseItem={result.case} />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NewCaseOutcome({ caseItem }: { caseItem: Case }) {
  return (
    <div className="rounded-lg border border-line bg-ink p-5">
      <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
        New case created
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="font-display text-2xl font-semibold tracking-tightish text-primary">
          {ISSUE_LABEL[caseItem.type]}
        </span>
        <SeverityTag severity={caseItem.severity} />
      </div>
      <p className="mt-3 font-body text-sm leading-relaxed text-muted">
        {caseItem.description}
      </p>
      {typeof caseItem.classificationConfidence === "number" ? (
        <p className="mt-3 font-body text-xs tabular-nums text-muted">
          Confidence {Math.round(caseItem.classificationConfidence * 100)} percent
        </p>
      ) : null}
      <div className="mt-4">
        <RoutedDept caseItem={caseItem} />
      </div>
    </div>
  );
}

function MergedOutcome({ result }: { result: ReportResult }) {
  const affected = result.citizensAffected ?? result.case.citizensAffected ?? 2;
  const matches = result.matchesReports ?? affected - 1;
  // Count up from the prior total to the new one for the live merge feel.
  const affectedDisplay = useCountUp(affected, { duration: 1.2 });

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 p-5">
      <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Merged into an existing case
      </p>
      <p className="mt-2 font-body text-sm text-primary">
        This is already being tracked. Your report strengthens it.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-display text-4xl font-semibold tabular-nums tracking-tightish text-accent">
            {affectedDisplay}
          </p>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.12em] text-muted">
            Citizens affected
          </p>
        </div>
        <div>
          <p className="font-display text-4xl font-semibold tabular-nums tracking-tightish text-primary">
            {matches}
          </p>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.12em] text-muted">
            Matching reports
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="font-display text-lg font-semibold tracking-tightish text-primary">
          {ISSUE_LABEL[result.case.type]}
        </span>
        <SeverityTag severity={result.case.severity} />
      </div>

      {result.dedup?.reasoning ? (
        <p className="mt-3 font-body text-sm leading-relaxed text-muted">
          {result.dedup.reasoning}
        </p>
      ) : null}
      {result.dedup?.provenance ? (
        <p className="mt-2 font-body text-xs text-muted">
          {result.dedup.provenance}
        </p>
      ) : null}
      <div className="mt-4 border-t border-accent/20 pt-3">
        <RoutedDept caseItem={result.case} />
      </div>

      {result.autoEscalation ? (
        <AutoEscalationReveal escalation={result.autoEscalation} />
      ) : null}
    </div>
  );
}

// The on-stage moment. When a live merge crosses the citizens threshold, the
// system escalates to public on its own. This reveals deliberately, with a live
// amber pulse and the drafted public text appearing as if just written.
function AutoEscalationReveal({
  escalation,
}: {
  escalation: { label: string; text: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-5 rounded-lg border border-accent/50 bg-accent/10 p-5"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-accent animate-halo-soft" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent animate-pulse-soft" />
        </span>
        <span className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          The system escalated this on its own
        </span>
      </div>
      <p className="mt-3 font-display text-xl font-semibold tracking-tightish text-primary">
        {escalation.label}
      </p>
      <p className="mt-1 font-body text-sm text-muted">
        Enough citizens are affected that this crossed the public escalation
        threshold. No human pressed a button.
      </p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.6 }}
        className="mt-4 whitespace-pre-line rounded-lg border border-line bg-ink p-4 font-body text-sm leading-relaxed text-primary"
      >
        {escalation.text}
      </motion.div>
    </motion.div>
  );
}
