
import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { qrApi, authApi, reminderApi, absenteeApi } from '../services/api';

const safeRandomUUID = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch {}
  }
  return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
};

export default function StaffDashboard({ currentUser, onLogout, onNavigateAI }) {
  const [passCode, setPassCode] = useState('');
  const [member, setMember] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [entryStatus, setEntryStatus] = useState(null);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [monitorPassCode, setMonitorPassCode] = useState('');
  const [monitorUntil, setMonitorUntil] = useState(0);
  const [monitoring, setMonitoring] = useState(false);

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Membership expiry reminder states
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderError, setReminderError] = useState(false);

  // M3 Task 11: Absentee Drafts
  const [absenteeDrafts, setAbsenteeDrafts] = useState([]);
  const [absenteeDays, setAbsenteeDays] = useState(14);
  const [absenteeLoading, setAbsenteeLoading] = useState(false);
  const [absenteeError, setAbsenteeError] = useState('');
  const [absenteeNotice, setAbsenteeNotice] = useState('');

  const scanHandledRef = useRef(false);

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

  const stopScanner = async () => {
    const scanner = window.memberPassScanner;

    if (scanner) {
      try {
        await scanner.clear();
      } catch (err) {
        console.warn('Error clearing scanner:', err);
      }
      window.memberPassScanner = null;
    }

    setScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (window.memberPassScanner) {
        window.memberPassScanner.clear().catch(() => {});
        window.memberPassScanner = null;
      }
    };
  }, []);

  const startScanner = async () => {
    setMessage('');
    setMember(null);
    setEntryStatus(null);
    setLastCheckIn(null);
    setMonitorPassCode('');
    setMonitoring(false);
    scanHandledRef.current = false;

    // Clean up any existing scanner instance first
    if (window.memberPassScanner) {
      try {
        await window.memberPassScanner.clear();
      } catch (err) {
        console.warn('Cleanup error:', err);
      }
      window.memberPassScanner = null;
    }

    setScannerOpen(true);

    window.setTimeout(() => {
      const reader = document.getElementById('memberpass-qr-reader');

      if (!reader) return;

      try {
        const scanner = new Html5QrcodeScanner(
          'memberpass-qr-reader',
          {
            fps: 10,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
          },
          false
        );

        window.memberPassScanner = scanner;

        scanner.render(
          async (decodedText) => {
            if (scanHandledRef.current) return;
            scanHandledRef.current = true;

            let code = null;
            try {
              const payload = JSON.parse(decodedText);
              code =
                payload.pass_code ||
                payload.passCode ||
                payload.code ||
                (typeof payload === 'string' ? payload : null);
            } catch {
              if (typeof decodedText === 'string' && decodedText.trim()) {
                code = decodedText.trim();
              }
            }

            if (!code) {
              setEntryStatus('denied');
              setMessage('Pass not recognised');
              scanHandledRef.current = false;
              return;
            }

            setPassCode(code);
            await stopScanner();
            validateMember(code);
          },
          () => {}
        );
      } catch (scannerErr) {
        console.error('Failed to initialize QR scanner:', scannerErr);
        setMessage('Camera or scanner initialization failed. Please use manual code entry.');
        setScannerOpen(false);
      }
    }, 150);
  };

  const recordCheckIn = async (code, validatedMember) => {
    try {
      const result = await qrApi.checkIn(
        code,
        safeRandomUUID()
      );

      if (result.success && result.entryStatus === 'ENTRY_ALLOWED') {
        setEntryStatus('allowed');

        const updatedMember = {
          ...validatedMember,
          ...(result.member || {}),
          classesUsed: result.classesUsed ?? result.member?.classesUsed ?? validatedMember?.classesUsed,
        };

        setMember(updatedMember);
        setLastCheckIn(result);
        setMessage(
          result.alreadyCheckedIn
            ? 'Already checked in today. No extra class was deducted.'
            : 'Entry allowed. Class check-in successful!'
        );

        setMonitorPassCode('');
        setMonitorUntil(0);
        setMonitoring(false);
        await loadAttendanceHistory();
        return true;
      }

      setEntryStatus('denied');
      setMember(result.member || validatedMember || null);
      setMessage(result.reason || result.message || 'Check-in denied');

      if (result.member || validatedMember) {
        setMonitorPassCode(code);
        setMonitorUntil(Date.now() + 5 * 60 * 1000);
        setMonitoring(true);
      }

      return false;
    } catch {
      setEntryStatus('denied');
      setMessage('Check-in request failed. Please verify again.');
      return false;
    }
  };

  const validateMember = async (code = passCode) => {
    const cleanCode = code.trim();

    if (!cleanCode) {
      setEntryStatus('denied');
      setMessage('Please scan or enter a pass code');
      return;
    }

    setLoading(true);
    setMember(null);
    setEntryStatus(null);
    setMessage('');
    setLastCheckIn(null);
    setMonitorPassCode('');
    setMonitorUntil(0);
    setMonitoring(false);

    try {
      const result = await qrApi.validate(cleanCode);

      if (result.success && result.entryStatus === 'ENTRY_ALLOWED') {
        setEntryStatus('allowed');
        setMember(result.member);
        await recordCheckIn(cleanCode, result.member);
      } else {
        setEntryStatus('denied');
        setMember(result.member || null);
        setMessage(result.reason || result.message || 'Pass not recognised');

        if (result.member) {
          setMonitorPassCode(cleanCode);
          setMonitorUntil(Date.now() + 5 * 60 * 1000);
          setMonitoring(true);
        }
      }
    } catch {
      setEntryStatus('denied');
      setMessage('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!monitorPassCode || !monitorUntil) return undefined;

    let checking = false;

    const checkMembershipAgain = async () => {
      if (checking) return;
      checking = true;

      try {
        if (Date.now() >= monitorUntil) {
          setMonitorPassCode('');
          setMonitorUntil(0);
          setMonitoring(false);
          setMessage('Monitoring ended after 5 minutes. Please scan the pass again.');
          return;
        }

        const result = await qrApi.validate(monitorPassCode);

        if (result.success && result.entryStatus === 'ENTRY_ALLOWED') {
          setEntryStatus('allowed');
          setMessage('Membership activated! Recording check-in...');

          const checkInResult = await qrApi.checkIn(
            monitorPassCode,
            safeRandomUUID()
          );

          if (
            checkInResult.success &&
            checkInResult.entryStatus === 'ENTRY_ALLOWED'
          ) {
            setMember({
              ...(result.member || {}),
              ...(checkInResult.member || {}),
              classesUsed:
                checkInResult.classesUsed ??
                checkInResult.member?.classesUsed ??
                result.member?.classesUsed,
            });

            setLastCheckIn(checkInResult);
            setMessage(
              checkInResult.alreadyCheckedIn
                ? 'Membership is active. Already checked in today; no extra class deducted.'
                : 'Membership activated. Class check-in successful!'
            );

            setMonitorPassCode('');
            setMonitorUntil(0);
            setMonitoring(false);
            await loadAttendanceHistory();
          } else {
            setEntryStatus('denied');
            setMessage(checkInResult.reason || 'Check-in denied');
          }
        } else if (result.member) {
          setMember(result.member);
          setEntryStatus('denied');
          setMessage(result.reason || 'Membership is not active yet');
        }
      } catch {
        // Keep monitoring until the five-minute deadline.
      } finally {
        checking = false;
      }
    };

    const intervalId = window.setInterval(checkMembershipAgain, 5000);

    return () => window.clearInterval(intervalId);
  }, [monitorPassCode, monitorUntil]);

  // Manually run membership expiry job
  const handleRunExpiryJob = async () => {
    setReminderLoading(true);
    setReminderMessage('');
    setReminderError(false);

    try {
      const result = await reminderApi.runNow();

      if (result.success) {
        const data = result.data || {};

        setReminderMessage(
          `Completed: ${data.endedCount || 0} memberships ended, ${data.sentCount || 0} reminders sent, ${data.failedCount || 0} failed.`
        );
      } else {
        setReminderError(true);
        setReminderMessage(result.message || 'Unable to run expiry job');
      }
    } catch {
      setReminderError(true);
      setReminderMessage('Unable to connect to reminder service');
    } finally {
      setReminderLoading(false);
    }
  };

  const loadAbsenteeDrafts = async (days = absenteeDays) => {
    setAbsenteeLoading(true);
    setAbsenteeError('');
    setAbsenteeNotice('');

    try {
      const result = await absenteeApi.getDrafts(days);

      if (result.success) {
        setAbsenteeDrafts(result.drafts || []);
      } else {
        setAbsenteeError(result.message || 'Unable to load absentee drafts');
      }
    } catch {
      setAbsenteeError('Unable to connect to absentee service');
    } finally {
      setAbsenteeLoading(false);
    }
  };

  const handleCopyDraft = async (draft) => {
    try {
      await navigator.clipboard.writeText(draft.message);
      setAbsenteeNotice(`Draft copied for ${draft.name}`);
    } catch {
      setAbsenteeNotice('Unable to copy message. Please copy it manually.');
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    onLogout();
  };

  return (
    <div className="staff-dashboard">
      <header className="staff-header">
        <div>
          <span className="staff-kicker">MEMBERPASS - STUDIO ADMIN</span>
          <h1>Staff Dashboard</h1>
          <p>Welcome, {currentUser?.name || 'Staff'}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {onNavigateAI && (
            <button
              className="staff-secondary-btn"
              onClick={onNavigateAI}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                width: 'auto',
                marginTop: 0,
                padding: '10px 16px'
              }}
              title="Open AI Assistant"
            >
              <span style={{ color: 'var(--rose)' }}>✦</span>
              <span>AI Assistant</span>
            </button>
          )}
          <button className="staff-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="staff-content">
        <div className="staff-card">
          <span className="staff-kicker">MEMBERSHIP ACCESS</span>
          <h2>Scan Member Pass</h2>
          <p>
            Scan the member's QR code to verify membership and record class attendance.
          </p>

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

          <form
            onSubmit={(event) => {
              event.preventDefault();
              validateMember();
            }}
          >
            <input
              className="staff-pass-input"
              value={passCode}
              onChange={(event) => setPassCode(event.target.value)}
              placeholder="Enter member pass code"
            />

            <button
              className="staff-primary-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Pass'}
            </button>
          </form>

          {message && (
            <div
              className="staff-message"
              role="status"
              style={{
                border: entryStatus
                  ? `1px solid ${entryStatus === 'allowed' ? '#198754' : '#dc3545'}`
                  : undefined,
                background: entryStatus === 'allowed' ? '#e8f7ee' : undefined,
                color: entryStatus === 'allowed' ? '#176b3a' : undefined,
              }}
            >
              {entryStatus === 'allowed' ? 'GREEN - ' : ''}
              {entryStatus === 'denied' ? 'RED - ' : ''}
              {message}
            </div>
          )}

          {monitoring && (
            <div className="staff-message">
              Watching this membership for up to 5 minutes. It will be checked
              automatically every 5 seconds.
            </div>
          )}

          {member && (
            <div
              className="staff-member-result"
              style={{
                borderColor: entryStatus === 'allowed' ? '#198754' : '#dc3545',
              }}
            >
              <span className="staff-kicker">
                {entryStatus === 'allowed' ? 'ENTRY ALLOWED' : 'MEMBER DETAILS'}
              </span>

              <h3>{member.name}</h3>
              <p>Plan: {member.plan}</p>
              <p>
                Classes used: {member.classesUsed} / {member.classLimit ?? 'Unlimited'}
              </p>
              <p>
                Membership ends: {member.endDate
                  ? new Date(member.endDate).toLocaleDateString()
                  : 'Not available'}
              </p>
            </div>
          )}

          {lastCheckIn && (
            <div className="staff-success-result">
              <h3>Last Check-in</h3>
              <p>{lastCheckIn.member?.name || member?.name || 'Member'}</p>
              <p>Classes used: {lastCheckIn.classesUsed ?? member?.classesUsed ?? 'Recorded'}</p>
              <p>{lastCheckIn.message || message}</p>
            </div>
          )}
        </div>

        {/* Membership Expiry Reminder Section */}
        <div className="staff-card">
          <span className="staff-kicker">MEMBERSHIP AUTOMATION</span>
          <h2>Expiry Reminders</h2>
          <p>
            Run the daily membership expiry check manually. Expired memberships
            will be marked as ended, and eligible members will receive their
            three-day expiry reminder.
          </p>

          <button
            className="staff-primary-btn"
            onClick={handleRunExpiryJob}
            disabled={reminderLoading}
          >
            {reminderLoading ? 'Running...' : 'Run Expiry Check Now'}
          </button>

          {reminderMessage && (
            <div
              className="staff-message"
              role="status"
              style={{
                border: `1px solid ${reminderError ? '#dc3545' : '#198754'}`,
                background: reminderError ? '#fff0f0' : '#e8f7ee',
                color: reminderError ? '#b02a37' : '#176b3a',
              }}
            >
              {reminderMessage}
            </div>
          )}
        </div>

        {/* M3 Task 11: AI Absentee Drafts */}
        <div className="staff-card absentee-drafts-card">
          <span className="staff-kicker">MEMBERSHIP ENGAGEMENT</span>
          <h2>AI Absentee Drafts</h2>
          <p>
            Identify active members who have not attended recently and prepare
            personalized follow-up messages for staff review.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <label htmlFor="absentee-days">Inactive period:</label>
            <select
              id="absentee-days"
              value={absenteeDays}
              onChange={(event) => {
                const days = Number(event.target.value);
                setAbsenteeDays(days);
                loadAbsenteeDrafts(days);
              }}
              style={{ padding: '10px', borderRadius: '8px' }}
            >
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>

            <button
              className="staff-primary-btn"
              onClick={() => loadAbsenteeDrafts()}
              disabled={absenteeLoading}
            >
              {absenteeLoading ? 'Generating...' : 'Generate Drafts'}
            </button>
          </div>

          {absenteeError && (
            <div className="staff-message" role="status">
              {absenteeError}
            </div>
          )}

          {absenteeNotice && (
            <div className="staff-message" role="status">
              {absenteeNotice}
            </div>
          )}

          {!absenteeLoading && absenteeDrafts.length === 0 && !absenteeError && (
            <div className="no-payments-placeholder">
              <p>Generate drafts to find inactive members.</p>
            </div>
          )}

          {absenteeDrafts.map((draft) => (
            <div
              key={draft.membershipId}
              className="attendance-history-item"
              style={{ marginTop: '16px', padding: '16px', border: '1px solid #ddd', borderRadius: '12px' }}
            >
              <div className="attendance-info-col">
                <h3>{draft.name}</h3>
                <p className="attendance-email">{draft.email}</p>
                {draft.phone && <p>Phone: {draft.phone}</p>}
                <div className="attendance-tags">
                  <span className="attendance-tag-pill plan-pill">
                    {draft.plan}
                  </span>
                  <span className="attendance-tag-pill staff-pill">
                    {draft.inactiveDays === null
                      ? 'Never attended'
                      : `${draft.inactiveDays} days inactive`}
                  </span>
                </div>
                <p style={{ marginTop: '10px' }}>
                  Last visit: {draft.lastAttendance
                    ? new Date(draft.lastAttendance).toLocaleDateString('en-IN')
                    : 'No attendance recorded'}
                </p>
                <p>
                  Membership ends: {draft.membershipEndDate
                    ? new Date(draft.membershipEndDate).toLocaleDateString('en-IN')
                    : 'Not available'}
                </p>
              </div>

              <div style={{ width: '100%', marginTop: '12px' }}>
                <label>Message draft (staff review):</label>
                <textarea
                  readOnly
                  value={draft.message}
                  rows={5}
                  style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: '8px', resize: 'vertical' }}
                />
                <button
                  className="staff-secondary-btn"
                  onClick={() => handleCopyDraft(draft)}
                  style={{ marginTop: '10px' }}
                >
                  Copy Message
                </button>
              </div>
            </div>
          ))}

          {absenteeDrafts.length > 0 && (
            <p style={{ marginTop: '16px' }}>
              {absenteeDrafts.length} absentee draft(s) generated.
              Messages are drafts only and are not automatically sent.
            </p>
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
              {historyLoading ? 'Refreshing...' : 'Refresh History'}
            </button>
          </div>

          {historyError && (
            <div className="staff-message" role="status">
              {historyError}
            </div>
          )}

          {historyLoading && attendanceHistory.length === 0 ? (
            <div className="no-payments-placeholder">
              <p>Loading attendance records...</p>
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="no-payments-placeholder">
              <span className="placeholder-icon">*</span>
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
                      <span className="attendance-tag-pill plan-pill">
                        {record.planName}
                      </span>
                      <span className="attendance-tag-pill staff-pill">
                        Staff: {record.staffName}
                      </span>
                    </div>
                  </div>

                  <div className="attendance-history-date">
                    {record.checkedInAt
                      ? new Date(record.checkedInAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
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
