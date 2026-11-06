import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FileText, CheckCircle, Pen, ArrowLeft, MousePointerClick } from "lucide-react";
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
  if (!res.ok) throw new Error("Invalid or expired session");
  return res.json();
}

async function authenticateSession(token: string) {
  const res = await fetch(`${API_BASE}/signing/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Authentication failed");
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
  if (!res.ok) throw new Error("Signing failed");
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
  const dimsRef = useRef<{ width: number; height: number } | null>(null);
  const placementSetRef = useRef(false);

  const { data: session, isLoading, isError } = useQuery<SessionResponse>({
    queryKey: ["signing-session", token],
    queryFn: () => fetchSession(token!),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (session) setStep("view");
  }, [session]);

  const authenticateMutation = useMutation({
    mutationFn: () => authenticateSession(token!),
    onSuccess: () => {
      setStep("sign");
      setError("");
      // Default placement one page 1 (bottom-centre) so signing works immediately.
      if (!placementSetRef.current && dimsRef.current) {
        setPlacement({
          page: 1,
          x: dimsRef.current.width / 2 - 80,
          y: dimsRef.current.height * 0.9,
        });
        placementSetRef.current = true;
      }
    },
    onError: () => setError("Authentication failed"),
  });

  const signMutation = useMutation({
    mutationFn: () => {
      const imageData =
        signatureType === "TYPED" ? renderTypedSignature(typedName.trim()) ?? typedName.trim() : drawnData;
      return signDocument(token!, {
        type: signatureType,
        imageData: imageData ?? undefined,
        page: placement?.page,
        fieldX: placement?.x,
        fieldY: placement?.y,
      });
    },
    onSuccess: () => setStep("complete"),
    onError: () => setError("Failed to sign document. Please try again."),
  });

  const canSign =
    (signatureType === "TYPED" && typedName.trim().length > 0) ||
    (signatureType === "DRAWN" && !!drawnData);

  const participant = session?.participant;
  const contractTitle = participant?.contract?.title || "Document to sign";
  const documentUrl = token
    ? `${API_BASE}/signing/session/${token}/document`
    : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    );
  }

  if (isError || (!session && !isLoading)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Invalid or expired signing link</p>
          <p className="text-gray-500 mt-2">Please contact the sender for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-brand-500 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow">
        <div>
          <h1 className="text-lg font-bold tracking-wide">AXA SIGN</h1>
          <p className="text-xs text-gray-300">by Tunaxa</p>
        </div>
        {participant && (
          <div className="text-right">
            <p className="text-sm font-medium">{participant.name}</p>
            <p className="text-xs text-gray-300">{participant.email}</p>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1">
        {step === "view" && (
          <div className="lg:flex">
            <div className="lg:flex-1 lg:max-w-[calc(100%-360px)] overflow-auto">
              <DocumentViewer
                url={documentUrl}
                mode="view"
                onLoaded={(_, dims) => {
                  dimsRef.current = dims;
                }}
              />
            </div>
            <aside className="lg:w-[360px] shrink-0 bg-white lg:border-l border-gray-200 p-6 lg:min-h-[calc(100vh-65px)]">
              <div className="lg:sticky lg:top-20 space-y-6">
                <div>
                  <FileText className="h-10 w-10 text-gray-300" />
                  <h2 className="text-xl font-semibold mt-3">{contractTitle}</h2>
                  <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                    {participant?.name}, you've been asked to review and sign this
                    document. Review every page before proceeding.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                <button
                  onClick={() => authenticateMutation.mutate()}
                  disabled={authenticateMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-white font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {authenticateMutation.isPending ? "Authenticating..." : "Review & Sign"}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  By continuing you agree your signature applies to the document shown.
                </p>
              </div>
            </aside>
          </div>
        )}

        {step === "sign" && (
          <div className="lg:flex">
            <div className="lg:flex-1 lg:max-w-[calc(100%-360px)] overflow-auto">
              <div className="flex items-center gap-2 px-6 pt-4 text-sm text-gray-500">
                <MousePointerClick size={16} className="text-brand-500" />
                {placement
                  ? "Click anywhere on the document to reposition your signature."
                  : "Click on the document to place your signature."}
              </div>
              <DocumentViewer
                url={documentUrl}
                mode="place"
                placement={placement}
                onPlace={setPlacement}
                onLoaded={(_, dims) => {
                  const firstLoad = dimsRef.current === null;
                  dimsRef.current = dims;
                  if (firstLoad && !placementSetRef.current) {
                    setPlacement({
                      page: 1,
                      x: dims.width / 2 - 80,
                      y: dims.height * 0.9,
                    });
                    placementSetRef.current = true;
                  }
                }}
              />
            </div>
            <aside className="lg:w-[360px] shrink-0 bg-white lg:border-l border-gray-200 p-6 lg:min-h-[calc(100vh-65px)]">
              <div className="lg:sticky lg:top-20 space-y-5">
                <h2 className="text-xl font-semibold">{contractTitle}</h2>

                {/* Signature type selector */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSignatureType("TYPED")}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      signatureType === "TYPED"
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Type
                  </button>
                  <button
                    onClick={() => setSignatureType("DRAWN")}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      signatureType === "DRAWN"
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Pen size={14} />
                      Draw
                    </span>
                  </button>
                </div>

                {signatureType === "TYPED" && (
                  <div>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Type your full legal name"
                      className="w-full text-center text-2xl font-serif border-b-2 border-gray-300 py-3 focus:outline-none focus:border-brand-500 bg-transparent"
                      style={{ fontStyle: "italic" }}
                    />
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      This is how your signature will appear on the document.
                    </p>
                  </div>
                )}

                {signatureType === "DRAWN" && (
                  <SignaturePad onChange={setDrawnData} />
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("view")}
                    disabled={signMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    onClick={() => signMutation.mutate()}
                    disabled={signMutation.isPending || !canSign || !placement}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand-500 text-white font-medium text-sm py-2.5 hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {signMutation.isPending ? "Signing..." : "Sign Document"}
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === "complete" && (
          <div className="max-w-lg mx-auto text-center py-24">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Document signed!</h2>
            <p className="text-gray-500">
              Thank you, {participant?.name}. Your signature has been recorded securely.
            </p>
            <p className="text-sm text-gray-400 mt-4">You can close this window.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t">
        Secure document signing powered by AXA Sign (Tunaxa)
      </footer>
    </div>
  );
}