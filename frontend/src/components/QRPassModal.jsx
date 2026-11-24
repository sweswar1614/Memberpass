import { useEffect, useState } from 'react';
import { memberApi } from '../services/api';

export default function QRPassModal({ isOpen, onClose, currentUser }) {
  const [passData, setPassData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadPass();
    }
  }, [isOpen]);

  const loadPass = async () => {
    try {
      setLoading(true);
      const res = await memberApi.getPass();
      if (res && res.success) {
        setPassData(res);
      }
    } catch (err) {
      console.error('Error fetching pass modal data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!passData?.pass?.qrCode) return;
    const a = document.createElement('a');
    a.href = passData.pass.qrCode;
    a.download = `MemberPass-${(currentUser?.name || 'card').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pass = passData?.pass;
  const isActive = passData?.hasActiveMembership;

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div
        className="modal-container qr-pass-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        <div className="modal-pass-header">
          <span className="modal-kicker">DIGITAL YOGA PASS</span>
          <h2 className="modal-title">Studio Verification Pass</h2>
          <p className="modal-subtitle">
            Hold your mobile device before the studio scanner to gain immediate authorized class entry.
          </p>
        </div>

        {loading ? (
          <div className="modal-loading-state">
            <div className="crest-spinner"></div>
            <p>Rendering secure cryptographic pass...</p>
          </div>
        ) : isActive && pass?.qrCode ? (
          <div className="modal-qr-body">
            <div className="qr-frame">
              <img src={pass.qrCode} alt="Member QR Code" className="modal-qr-image" />
            </div>

            <div className="modal-pass-meta">
              <div className="meta-line">
                <span className="meta-label">MEMBER</span>
                <strong className="meta-val">{currentUser?.name || pass.memberName}</strong>
              </div>
              <div className="meta-line">
                <span className="meta-label">TIER</span>
                <strong className="meta-val">{pass.plan} Plan</strong>
              </div>
              <div className="meta-line">
                <span className="meta-label">VALID UNTIL</span>
                <strong className="meta-val">{pass.endDate?.slice(0, 10)}</strong>
              </div>
            </div>

            <div className="modal-pass-actions">
              <button className="btn-primary btn-block" onClick={handleDownload}>
                <span>Download Pass Image</span>
                <span className="btn-arrow">↓</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-qr-inactive">
            <div className="inactive-icon">⚠</div>
            <h3>Membership Not Active</h3>
            <p>{passData?.message || 'You must have an active membership to display an entry pass.'}</p>
            <button className="btn-primary" onClick={onClose}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

