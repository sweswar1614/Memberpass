import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { qrApi, authApi } from '../services/api';

const formatSafeDate = (val) => {
  if (!val) return 'N/A';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

const formatSafeDateTime = (val) => {
  if (!val) return 'Date unavailable';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Date unavailable';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Date unavailable';
  }
};

export default function StaffDashboard({ currentUser, onLogout }) {
  const [passCode, setPassCode] = useState('');
  const [member, setMember] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadAttendanceHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const result = await qrApi.getAttendanceHistory();

      if (result && result.success) {
        setAttendanceHistory(Array.isArray(result.history) ? result.history : []);
      } else {
        setHistoryError(result?.message || 'Unable to load attendance history');
      }
    } catch {
      setHistoryError('Unable to connect to server');
    } finally {
      setHistoryLoading(false);
    }
  };

  const stopScanner = () => {
    const scanner = window.memberPassScanner;
    if (scanner) {
      try {
        scanner.clear().catch(() => { });
      } catch {
        // Ignore cleanup error
      }
      window.memberPassScanner = null;
    }
    setScannerOpen(false);
  };

  useEffect(() => {
    let unmounted = false;

    qrApi.getAttendanceHistory()
      .then((result) => {
        if (!unmounted && result && result.success) {
          setAttendanceHistory(Array.isArray(result.history) ? result.history : []);
        } else if (!unmounted && result && !result.success) {
          setHistoryError(result?.message || 'Unable to load attendance history');
        }
      })
      .catch(() => {
        if (!unmounted) setHistoryError('Unable to connect to server');
      });

    return () => {
      unmounted = true;
      const scanner = window.memberPassScanner;
      if (scanner) {
        try {
          scanner.clear().catch(() => { });
        } catch {
          // Ignore cleanup error
        }
        window.memberPassScanner = null;
      }
    };
  }, []);

  const startScanner = () => {
    setMessage('');
    setMember(null);
    setScannerOpen(true);

    setTimeout(() => {
      const el = document.getElementById('memberpass-qr-reader');
      if (!el) return;

      try {
        const scanner = new Html5QrcodeScanner(
          'memberpass-qr-reader',
          { fps: 10, qrbox: { width: 230, height: 230 } },
          false
        );

        window.memberPassScanner = scanner;

        scanner.render(
          (decodedText) => {
            try {
              const payload = JSON.parse(decodedText);
              if (!payload.pass_code) {
                setMessage('Invalid MemberPass QR code');
                return;
              }
              setPassCode(payload.pass_code);
              scanner.clear().catch(() => { });
              window.memberPassScanner = null;
              setScannerOpen(false);
              validateMember(payload.pass_code);
            } catch {
              setMessage('Unable to read QR pass payload');
            }
          },
          () => { }
        );
      } catch (err) {
        console.error('QR scanner init error:', err);
        setMessage('Camera scanner could not be started. Please enter pass code manually.');
        setScannerOpen(false);
      }
    }, 120);
  };

  const validateMember = async (code = passCode) => {
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      setMessage('Please scan or enter a pass code');
      return;
    }

    setLoading(true);
    setMember(null);
    setMessage('');

    try {
      const result = await qrApi.validate(trimmed);

      if (result && result.success && result.entryStatus === 'ENTRY_ALLOWED') {
        setMember(result.member);
        setMessage('Membership verified. Confirm check-in below.');
      } else {
        setMessage(result?.reason || 'Membership verification failed');
      }
    } catch {
      setMessage('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const confirmCheckIn = async () => {
    if (!member || !String(passCode || '').trim()) return;

    setLoading(true);
    setMessage('');

    const checkInId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `chk_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

    try {
      const result = await qrApi.checkIn(String(passCode).trim(), checkInId);

      if (result && result.success && result.entryStatus === 'ENTRY_ALLOWED') {
        setLastCheckIn(result);
        setMessage(
          result.alreadyCheckedIn
            ? 'This check-in was already recorded.'
            : 'Class check-in successful!'
        );
        setMember(null);
        setPassCode('');
        await loadAttendanceHistory();
      } else {
        setMessage(result?.reason || 'Check-in denied');
      }
    } catch {
      setMessage('Check-in request failed. Please verify before retrying.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-dashboard" style={{ paddingTop: '105px' }}>
      <header className="staff-header">
        <div>
          <span className="staff-kicker">MEMBERPASS • STUDIO ADMIN</span>
          <h1>Staff Dashboard</h1>
          <p>Welcome, {currentUser?.name || 'Staff'}</p>
        </div>
        <button
          className="staff-logout-btn"
          onClick={async () => {
            await authApi.logout();
            onLogout();
          }}
        >
          Logout
        </button>
      </header>

      <section className="staff-content">
        <div className="staff-card">
          <span className="staff-kicker">MEMBERSHIP ACCESS</span>
          <h2>Scan Member Pass</h2>
          <p>Scan the member's QR code to verify their membership and record class attendance.</p>

          {!scannerOpen ? (
            <button className="staff-primary-btn" onClick={startScanner}>
              Start QR Scanner
            </button>
          ) : (
            <>
              <div id="memberpass-qr-reader" className="staff-qr-reader" />
              <button className="staff-secondary-btn" onClick={stopScanner}>
                Stop Scanner
              </button>
            </>
          )}

          <div className="staff-divider">OR ENTER PASS CODE</div>

          <form onSubmit={(e) => {
            e.preventDefault();
            validateMember();
          }}>
            <input
              className="staff-pass-input"
              value={passCode}
              onChange={(e) => setPassCode(e.target.value)}
              placeholder="Enter member pass code"
            />
            <button className="staff-primary-btn" type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Pass'}
            </button>
          </form>

          {message && <div className="staff-message" role="status">{message}</div>}

          {member && (
            <div className="staff-member-result">
              <span className="staff-kicker">VERIFIED MEMBER</span>
              <h3>{member.name}</h3>
              <p>Plan: {member.plan}</p>
              <p>Classes used: {member.classesUsed} / {member.classLimit ?? 'Unlimited'}</p>
              <p>Membership ends: {formatSafeDate(member.endDate)}</p>
              <button
                className="staff-primary-btn"
                onClick={confirmCheckIn}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Class Check-in'}
              </button>
            </div>
          )}

          {lastCheckIn && (
            <div className="staff-success-result">
              <h3>Last Check-in</h3>
              <p>{lastCheckIn.member?.name || 'Member'}</p>
              <p>Classes used: {lastCheckIn.classesUsed ?? 'Recorded'}</p>
              <p>{lastCheckIn.message}</p>
            </div>
          )}
        </div>

        <div className="staff-card attendance-history-card">
          <div className="staff-card-header">
            <div>
              <span className="staff-kicker">STUDIO ACTIVITY</span>
              <h2>Attendance History</h2>
              <p>Recent member class check-ins across studio sessions.</p>
            </div>
            <button
              className="staff-secondary-btn staff-refresh-btn"
              onClick={loadAttendanceHistory}
              disabled={historyLoading}
            >
              {historyLoading ? 'Refreshing...' : '↻ Refresh History'}
            </button>
          </div>

          {historyError && (
            <div className="staff-message" role="status">{historyError}</div>
          )}

          {historyLoading && attendanceHistory.length === 0 ? (
            <div className="no-payments-placeholder">
              <p>Loading attendance records...</p>
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="no-payments-placeholder">
              <span className="placeholder-icon">✦</span>
              <p>No attendance records found yet.</p>
            </div>
          ) : (
            <div className="attendance-history-list">
              {attendanceHistory.map((record, idx) => (
                <div className="attendance-history-item" key={record?.id || record?._id || idx}>
                  <div className="attendance-info-col">
                    <h3>{record?.memberName || 'Member'}</h3>
                    <p className="attendance-email">{record?.memberEmail || ''}</p>
                    <div className="attendance-tags">
                      <span className="attendance-tag-pill plan-pill">{record?.planName || 'Yoga'}</span>
                      <span className="attendance-tag-pill staff-pill">Staff: {record?.staffName || 'Staff'}</span>
                    </div>
                  </div>
                  <div className="attendance-history-date">
                    {formatSafeDateTime(record?.checkedInAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
