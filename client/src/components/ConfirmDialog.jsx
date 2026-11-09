const ConfirmDialog = ({ open, title, body, confirmLabel = "Confirm", onConfirm, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-600 bg-[#282142] p-5 text-white">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-2 text-sm text-gray-300">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-full border border-gray-500">Cancel</button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm rounded-full bg-violet-600">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
