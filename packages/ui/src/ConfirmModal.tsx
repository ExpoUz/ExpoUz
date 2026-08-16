"use client";

import { ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * Confirmation dialog that spells out the exact impact of a destructive/money
 * action before it happens, e.g. impact="Refund 180 000 UZS to 4 players".
 * Both panels use this so no destructive action fires without a clear preview.
 */
export function ConfirmModal({
  title,
  message,
  impact,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: ReactNode;
  impact?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
              danger ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#00C853] hover:bg-[#00b34a]"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {message && <div className="text-sm text-[#374151]">{message}</div>}
      {impact && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
            danger ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]" : "bg-[#F0FDF4] text-[#00875A] border border-[#BBF7D0]"
          }`}
        >
          {impact}
        </div>
      )}
    </Modal>
  );
}
