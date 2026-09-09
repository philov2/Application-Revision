"use client";

import { useEffect, useRef, useState } from "react";

/* Permet de composer un document en photographiant directement chaque
page avec l'appareil photo de l'appareil (signalement de Phil : utile sur
téléphone, où prendre une photo par page est plus rapide qu'importer un
fichier depuis la pellicule). Une seule photo devient une image ; deux
photos ou plus sont fusionnées en un seul PDF multi-pages via jsPDF, pour
que le document final reste un fichier unique comme les autres imports.
Le résultat est injecté dans l'input file existant (voir onTerminer dans
MatiereDocuments.js) : aucune autre partie du flux d'import n'a besoin
d'être modifiée. */
export default function CaptureAppareilPhoto({ onTerminer, label = "📷 Prendre une photo", className = "" }) {
  const [disponible, setDisponible] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [pages, setPages] = useState([]);
  const [erreur, setErreur] = useState("");
  const [enCoursFusion, setEnCoursFusion] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setDisponible(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  function arreterCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => arreterCamera(), []);

  async function ouvrirCamera() {
    setErreur("");
    setPages([]);
    setOuvert(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setErreur("Impossible d'accéder à l'appareil photo. Vérifiez les autorisations de votre navigateur.");
    }
  }

  function fermer() {
    arreterCamera();
    setOuvert(false);
    setPages([]);
    setErreur("");
  }

  function capturerPage() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPages((prev) => [...prev, dataUrl]);
  }

  function supprimerPage(index) {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }

  async function terminer() {
    if (pages.length === 0) return;
    setEnCoursFusion(true);
    try {
      let fichier;
      if (pages.length === 1) {
        const blob = await (await fetch(pages[0])).blob();
        fichier = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt" });
        for (let i = 0; i < pages.length; i++) {
          const img = new Image();
          img.src = pages[i];
          await new Promise((resolve) => { img.onload = resolve; });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          if (i > 0) pdf.addPage();
          pdf.addImage(pages[i], "JPEG", (pageWidth - w) / 2, (pageHeight - h) / 2, w, h);
        }
        const blob = pdf.output("blob");
        fichier = new File([blob], `photos-${Date.now()}.pdf`, { type: "application/pdf" });
      }
      onTerminer?.(fichier);
      fermer();
    } catch (err) {
      setErreur("Échec de la préparation du document : " + err.message);
    } finally {
      setEnCoursFusion(false);
    }
  }

  if (!disponible) return null;

  return (
    <>
      <button type="button" onClick={ouvrirCamera} className={className}>
        {label}
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          {erreur ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 max-w-sm text-center space-y-3">
              <p className="text-sm text-red-600">{erreur}</p>
              <button type="button" onClick={fermer} className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300">Fermer</button>
            </div>
          ) : (
            <>
              <p className="text-white text-sm mb-2 text-center">
                Prenez une photo de chaque page, puis appuyez sur Terminer.
              </p>
              <video ref={videoRef} playsInline muted className="max-w-full max-h-[60vh] rounded-lg bg-black" />
              {pages.length > 0 && (
                <div className="flex gap-2 flex-wrap justify-center mt-3 max-w-full overflow-x-auto">
                  {pages.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p} alt={`Page ${i + 1}`} className="w-14 h-14 object-cover rounded border-2 border-white" />
                      <button type="button" onClick={() => supprimerPage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-4">
                <button type="button" onClick={fermer} className="rounded-lg px-4 py-2 text-sm font-medium text-white border border-white/40">Annuler</button>
                <button type="button" onClick={capturerPage} className="rounded-full w-16 h-16 bg-white border-4 border-slate-300" title="Capturer" />
                <button
                  type="button"
                  onClick={terminer}
                  disabled={pages.length === 0 || enCoursFusion}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: "var(--azur)" }}
                >
                  {enCoursFusion ? "..." : `✓ Terminer (${pages.length})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
