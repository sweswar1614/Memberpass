
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { qrApi, authApi } from '../services/api';

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

      if (result.success) {
        setAttendanceHistory(result.history || []);
      } else {
        setHistoryError(result.message || 'Unable to load attendance history');
      }
    } catch {
      setHistoryError('Unable to connect to server');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceHistory();
  }, []);

  const stopScanner = () => {
    const scanner = window.memberPassScanner;
    if (scanner) {
      scanner.clear().catch(() => { });
      window.memberPassScanner = null;
    }
    setScannerOpen(false);
  };

  const startScanner = () => {
    setMessage('');
    setMember(null);
    setScannerOpen(true);

    setTimeout(() => {
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
            setMessage('Unable to read QR pass');
          }
        },
        () => { }
      );
    }, 100);
  };

  const validateMember = async (code = passCode) => {
    if (!code.trim()) {
      setMessage('Please scan or enter a pass code');
      return;
    }

    setLoading(true);
    setMember(null);
    setMessage('');

    try {
      const result = await qrApi.validate(code.trim());

      if (result.success && result.entryStatus === 'ENTRY_ALLOWED') {
        setMember(result.member);
        setMessage('Membership verified. Confirm check-in below.');
      } else {
        setMessage(result.reason || 'Membership verification failed');
      }
    } catch {
      setMessage('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const confirmCheckIn = async () => {
    if (!member || !passCode.trim()) return;

    setLoading(true);
    setMessage('');

    const checkInId = crypto.randomUUID();

    try {
      const result = await qrApi.checkIn(passCode.trim(), checkInId);

      if (result.success && result.entryStatus === 'ENTRY_ALLOWED') {
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
        setMessage(result.reason || 'Check-in denied');
      }
    } catch {
      setMessage('Check-in request failed. Please verify before retrying.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-dashboard">
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
              <p>Membership ends: {new Date(member.endDate).toLocaleDateString()}</p>
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
              {attendanceHistory.map((record) => (
                <div className="attendance-history-item" key={record.id}>
                  <div className="attendance-info-col">
                    <h3>{record.memberName}</h3>
                    <p className="attendance-email">{record.memberEmail}</p>
                    <div className="attendance-tags">
                      <span className="attendance-tag-pill plan-pill">{record.planName}</span>
                      <span className="attendance-tag-pill staff-pill">Staff: {record.staffName}</span>
                    </div>
                  </div>
                  <div className="attendance-history-date">
                    {record.checkedInAt
                      ? new Date(record.checkedInAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Date unavailable'}
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
