import { motion } from 'framer-motion';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  open,
  title,
  message,
  meta,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmClass = variant === 'accent' ? 'btn btn--accent' : 'btn btn--danger';
  const handleCancel = () => {
    if (!loading) onCancel?.();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <motion.div
        className="modal confirm-dialog"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h3 className="modal__title" id="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog__message" id="confirm-dialog-message">{message}</p>
        {meta && <p className="confirm-dialog__meta">{meta}</p>}
        <div className="modal__actions confirm-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
