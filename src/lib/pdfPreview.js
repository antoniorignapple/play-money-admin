export function createPdfPreviewWindow() {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    throw new Error(
      "Il browser ha bloccato l'anteprima PDF. Consenti l'apertura delle finestre e riprova.",
    );
  }

  previewWindow.document.title = "Preparazione PDF...";
  previewWindow.document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#f8f5ed;font-family:Arial,sans-serif;color:#3d2a0b">
      <div style="text-align:center">
        <div style="font-size:13px;font-weight:800;letter-spacing:.14em">PLAY MONEY</div>
        <div style="margin-top:10px;font-size:18px;font-weight:800">Preparazione PDF...</div>
      </div>
    </main>
  `;

  return previewWindow;
}

export function openPdfPreview(doc, targetWindow = null) {
  const previewWindow = targetWindow || createPdfPreviewWindow();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  previewWindow.location.replace(url);
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

export function closePdfPreviewWindow(targetWindow) {
  if (targetWindow && !targetWindow.closed) targetWindow.close();
}
