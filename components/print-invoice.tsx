"use client";
export function PrintInvoice() {
  return (
    <button
      className="button-secondary no-print"
      onClick={() => window.print()}
    >
      Печать / сохранить PDF
    </button>
  );
}
