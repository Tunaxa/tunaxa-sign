import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  CheckCircle2,
  Pen,
  ArrowLeft,
  MousePointerClick,
  FileSignature,
  ShieldCheck,
  Lock,
  Download,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { DocumentViewer, type Placement } from "./components/DocumentViewer";
import { SignaturePad } from "./components/SignaturePad";
import { renderTypedSignature } from "./lib/signature";

const API_BASE = "/api/v1";

interface ParticipantInfo {
  id: string;
  name: string;
  email: string;
  contract?: { id: string; title: string | null };
}

interface SessionResponse {
  session: { id: string; status: string };
  participant: ParticipantInfo;
}

async function fetchSession(token: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/signing/session/${token}`);
  if (!res.ok) throw new Error("Invalid or expired signing invitation");
  return res.json();
}

async function authenticateSession(token: string) {
  const res = await fetch(`${API_BASE}/signing/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Session authentication failed");
  return res.json();
}

async function signDocument(
  token: string,
  data: { type: string; imageData?: string; page?: number; fieldX?: number; fieldY?: number }
) {
  const res = await fetch(`${API_BASE}/signing/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...data }),
  });
  if (!res.ok) throw new Error("Cryptographic sealing failed");
  return res.json();
}

type Step = "loading" | "view" | "sign" | "complete" | "error";

export function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [signatureType, setSignatureType] = useState<"DRAWN" | "TYPED">("TYPED");
  const [typedName, setTypedName] = useState("");
  const [drawnData, setDrawnData] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [error, setError] = useState("");
  const [hasReviewed, setHasReviewed] = useState(false);
  const dimsRef = useRef<{ width: number; height: number } | null>(null);
  const placementSetRef = useRef(false);

  const { data: session, isLoading, isError } = useQuery<SessionResponse>({
    queryKey: ["signing-session", token],
    queryFn: () => fetchSession(token!),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (session) {
      setStep("view");
      if (session.participant?.name) {
        setTypedName(session.participant.name);
      }
    }
  }, [session]);

  const authenticateMutation = useMutation({
    mutationFn: () => authenticateSession(token!),
    onSuccess: () => {
      setStep("sign");
      setError("");
      if (!placementSetRef.current && dimsRef.current) {
        setPlacement({
          page: 1,
          x: dimsRef.current.width / 2 - 80,
          y: dimsRef.current.height * 0.88,
        });
        placementSetRef.current = true;
      }
    },
    onError: () => setError("Failed to authenticate session. Please retry."),
  });

  const signMutation = useMutation({
    mutationFn: () => {
      const imageData =
        signatureType === "TYPED"
          ? renderTypedSignature(typedName.trim()) ?? typedName.trim()
          : drawnData;
      return signDocument(token!, {
        type: signatureType,
        imageData: imageData ?? undefined,
        page: placement?.page,
        fieldX: placement?.x,
        fieldY: placement?.y,
      });
    },
    onSuccess: () => setStep("complete"),
    onError: () => setError("Failed to cryptographically sign document. Please try again."),
  });

  const canSign =
    (signatureType === "TYPED" && typedName.trim().length > 0) ||
    (signatureType === "DRAWN" && !!drawnData);

  const participant = session?.participant;
  const contractTitle = participant?.contract?.title || "Document Agreement";
  const documentUrl = token ? `${API_BASE}/signing/session/${token}/document` : "";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md animate-pulse mb-3">
            <FileSignature size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-800">Verifying secure signing link...</p>
          <p className="text-xs text-slate-400 mt-1">AXA Sign Trust Network</p>
        </div>
      </div>
    );
  }

  if (isError || (!session && !isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500 mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Invalid or Expired Signing Link</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            This document invitation has expired, already been executed, or has been revoked by the sender.
          </p>
          <p className="mt-4 text-xs font-semibold text-slate-700">
            Please contact the document sender to receive a fresh signing invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <FileSignature size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-slate-900">AXA SIGN</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <ShieldCheck size={11} /> eIDAS Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-xs">{contractTitle}</p>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className={`flex items-center gap-1.5 ${step === "view" ? "text-brand-600 font-bold" : "text-slate-400"}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === "view" ? "bg-brand-600 text-white" : "bg-slate-200"}`}>1</span>
            Review
          </span>
          <span>→</span>
          <span className={`flex items-center gap-1.5 ${step === "sign" ? "text-brand-600 font-bold" : "text-slate-400"}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === "sign" ? "bg-brand-600 text-white" : "bg-slate-200"}`}>2</span>
            Sign
          </span>
          <span>→</span>
          <span className={`flex items-center gap-1.5 ${step === "complete" ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === "complete" ? "bg-emerald-600 text-white" : "bg-slate-200"}`}>3</span>
            Completed
          </span>
        </div>

        {/* Signer Info */}
        {participant && (
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800">{participant.name}</p>
            <p className="text-[11px] text-slate-400">{participant.email}</p>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
        {/* Step 1: Document View & Review */}
        {step === "view" && (
          <div className="lg:flex">
            {/* PDF Viewer */}
            <div className="lg:flex-1 lg:max-w-[calc(100%-380px)] overflow-auto p-4 md:p-6">
              <DocumentViewer
                url={documentUrl}
                mode="view"
                onLoaded={(_, dims) => {
                  dimsRef.current = dims;
                }}
              />
            </div>

            {/* Sidebar Review Action Panel */}
            <aside className="lg:w-[380px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-6 lg:min-h-[calc(100vh-64px)] shadow-card">
              <div className="lg:sticky lg:top-24 space-y-6">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 mb-3">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{contractTitle}</h2>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Hello <span className="font-semibold text-slate-700">{participant?.name}</span>. You have been invited to review and execute this legal document electronically.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Lock size={14} className="text-brand-600" />
                    Legal Validity Notice
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Under EU Regulation No 910/2014 (eIDAS) and ESIGN Act, electronic signatures recorded here have full legal validity and enforceability.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasReviewed}
                      onChange={(e) => setHasReviewed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>I have reviewed the entire document and agree to sign electronically.</span>
                  </label>

                  <button
                    onClick={() => authenticateMutation.mutate()}
                    disabled={authenticateMutation.isPending || !hasReviewed}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {authenticateMutation.isPending ? "Authenticating Session..." : "Proceed to Sign"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Step 2: Signature Mode & Placement */}
        {step === "sign" && (
          <div className="lg:flex">
            {/* PDF Viewer with interactive placement */}
            <div className="lg:flex-1 lg:max-w-[calc(100%-380px)] overflow-auto p-4 md:p-6">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-xs text-blue-800 border border-blue-200/60">
                <div className="flex items-center gap-2">
                  <MousePointerClick size={16} className="text-blue-600 shrink-0" />
                  <span>
                    Click anywhere on the document to adjust your signature position.
                  </span>
                </div>
                {placement && (
                  <span className="font-semibold text-blue-900 bg-white px-2 py-0.5 rounded shadow-xs">
                    Page {placement.page}
                  </span>
                )}
              </div>

              <DocumentViewer
                url={documentUrl}
                mode="place"
                placement={placement}
                onPlace={setPlacement}
                onLoaded={(_, dims) => {
                  dimsRef.current = dims;
                }}
              />
            </div>

            {/* Signature Creation Panel */}
            <aside className="lg:w-[380px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-6 lg:min-h-[calc(100vh-64px)] shadow-card">
              <div className="lg:sticky lg:top-24 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Your Electronic Signature</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Select how you want your signature to appear</p>
                </div>

                {/* Type vs Draw Tab Selector */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSignatureType("TYPED")}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      signatureType === "TYPED"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Type Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureType("DRAWN")}
                    className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      signatureType === "DRAWN"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Pen size={13} />
                    Draw Signature
                  </button>
                </div>

                {/* Typed Option */}
                {signatureType === "TYPED" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Signer Legal Name
                      </label>
                      <input
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Your Full Legal Name"
                        className="w-full text-center text-3xl text-blue-900 py-3 outline-none border-b-2 border-slate-300 focus:border-brand-600 bg-transparent"
                        style={{ fontFamily: "'Dancing Script', cursive, sans-serif" }}
                      />
                    </div>
                    <p className="text-[11px] text-center text-slate-400">
                      Signature rendered in authentic legal blue ink
                    </p>
                  </div>
                )}

                {/* Drawn Option */}
                {signatureType === "DRAWN" && (
                  <div>
                    <SignaturePad onChange={setDrawnData} />
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                {/* Action buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("view")}
                    disabled={signMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => signMutation.mutate()}
                    disabled={signMutation.isPending || !canSign || !placement}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {signMutation.isPending ? "Sealing Document..." : "Adopt & Sign Document"}
                    <CheckCircle2 size={16} />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Step 3: Success Screen */}
        {step === "complete" && (
          <div className="mx-auto max-w-lg px-4 py-20 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 mb-6 shadow-md shadow-emerald-500/10">
              <CheckCircle2 size={44} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Document Successfully Signed!
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Thank you, <span className="font-semibold text-slate-800">{participant?.name}</span>. Your signature and certificate fingerprint have been cryptographically sealed.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-left space-y-3">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                <span className="text-slate-500">Document</span>
                <span className="font-semibold text-slate-900">{contractTitle}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                <span className="text-slate-500">Signer Identity</span>
                <span className="font-medium text-slate-800">{participant?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Compliance</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck size={14} /> eIDAS Compliant & Timestamped
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download size={15} /> Print / Save Confirmation
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-6">
              You can now safely close this browser window.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
        <span>© 2026 AXA Sign • Tunaxa Enterprise Platform</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <HelpCircle size={13} /> Support & Verification
        </span>
      </footer>
    </div>
  );
}
