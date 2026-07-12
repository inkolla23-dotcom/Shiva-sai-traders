import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail,
  Database, 
  Trash2, 
  Clock, 
  X, 
  FileText,
  AlertTriangle,
  Upload,
  Download
} from 'lucide-react';
import { API_BASE } from '../App';

function Settings({ token, showToast, handleLogout, setUser, user, setToken }) {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email fields
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Critical Actions Password Modals
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [criticalActionType, setCriticalActionType] = useState(''); // 'reset', 'sales-cleanup', 'restore', 'clear-logs'

  // Restore fields
  const [restoreFileJson, setRestoreFileJson] = useState(null);

  // Template upload fields
  const [templateInputUrl, setTemplateInputUrl] = useState(localStorage.getItem('sst_invoice_template') || '');

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/settings/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load system activity logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentEmail(data.user?.email || '');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchProfile();
  }, [token]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');

      showToast('Password changed successfully! Signing out...');
      setTimeout(() => {
        handleLogout();
      }, 1500);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    if (!emailCurrentPassword || !newEmail) {
      showToast('Current password and new email are required', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: emailCurrentPassword, newEmail })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email update failed');

      showToast('Admin email updated successfully');
      setCurrentEmail(data.user?.email || newEmail);
      setEmailCurrentPassword('');
      setNewEmail('');

      // Keep the locally stored session/user object in sync with the new email
      if (data.token && setToken) {
        localStorage.setItem('sst_token', data.token);
        setToken(data.token);
      }

      if (setUser && user) {
        const updatedUser = { 
          ...user, 
          email: data.user?.email || newEmail
        };
        setUser(updatedUser);
        localStorage.setItem('sst_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Secure Database Backup Downloader
  const handleBackupDownload = async () => {
    try {
      showToast('Generating backup dump...', 'info');
      const res = await fetch(`${API_BASE}/settings/backup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Backup download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sst_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('Database backup JSON file saved successfully');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // File Picker change loader
  const handleRestoreFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setRestoreFileJson(parsed);
        showToast('Backup file parsed. Ready to restore.', 'info');
      } catch (err) {
        showToast('Invalid backup JSON file structure', 'danger');
      }
    };
    reader.readAsText(file);
  };

  // Action verification modal launcher
  const triggerCriticalAction = (type) => {
    setCriticalActionType(type);
    setConfirmPasswordInput('');
    setIsConfirmModalOpen(true);
  };

  // Process critical database modifications
  const handleCriticalActionSubmit = async (e) => {
    e.preventDefault();
    if (!confirmPasswordInput) return;

    try {
      let url = '';
      let bodyPayload = { password: confirmPasswordInput };

      if (criticalActionType === 'reset') {
        url = `${API_BASE}/settings/reset`;
      } else if (criticalActionType === 'sales-cleanup') {
        url = `${API_BASE}/settings/sales-cleanup`;
      } else if (criticalActionType === 'clear-logs') {
        url = `${API_BASE}/settings/logs/clear`;
      } else if (criticalActionType === 'restore') {
        url = `${API_BASE}/settings/restore`;
        bodyPayload.backupData = restoreFileJson;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication / operation failed');

      showToast(data.message || 'Operation executed successfully');
      setIsConfirmModalOpen(false);
      setConfirmPasswordInput('');
      setRestoreFileJson(null);
      
      // Wipe storage state if complete reset
      if (criticalActionType === 'reset' || criticalActionType === 'restore') {
        setTimeout(() => {
          handleLogout();
        }, 1000);
      } else {
        fetchLogs();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Apply invoice design template logo link
  const handleSaveInvoiceTemplate = () => {
    if (templateInputUrl) {
      localStorage.setItem('sst_invoice_template', templateInputUrl);
      showToast('Invoice template background header saved');
    } else {
      localStorage.removeItem('sst_invoice_template');
      showToast('Invoice template cleared (default title headers restored)');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Left controls column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* Password Modifier */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} style={{ color: 'var(--primary)' }} /> Modify Credentials
            </h3>
          </div>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Old Password *</label>
              <input 
                type="password" 
                className="input-field" 
                value={oldPassword} 
                onChange={e => setOldPassword(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input 
                type="password" 
                className="input-field" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <input 
                type="password" 
                className="input-field" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Change Password & Sign Out
            </button>
          </form>
        </div>

        {/* Email Modifier */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} /> Admin Email
            </h3>
          </div>
          <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Current Admin Email</label>
              <input
                type="text"
                className="input-field"
                value={currentEmail || 'Not set'}
                disabled
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                className="input-field"
                value={emailCurrentPassword}
                onChange={e => setEmailCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Email Address *</label>
              <input
                type="email"
                className="input-field"
                placeholder="admin@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Update Admin Email
            </button>
          </form>
        </div>

        {/* Database backup & restore utilities */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--primary)' }} /> Database Backups
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Download a complete backup of the database in structured JSON format. This file can be restored anytime below.
              </p>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleBackupDownload}>
                <Download size={14} /> Download Database JSON Backup
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Upload a valid JSON database backup file. <b>WARNING: This replaces current database values.</b>
              </p>
              <input 
                type="file" 
                accept=".json" 
                id="restore-file-picker" 
                style={{ display: 'none' }} 
                onChange={handleRestoreFileSelect} 
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => document.getElementById('restore-file-picker').click()}>
                  <Upload size={14} /> Pick Backup File
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  disabled={!restoreFileJson}
                  onClick={() => triggerCriticalAction('restore')}
                >
                  Restore Data
                </button>
              </div>
              {restoreFileJson && (
                <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px', fontWeight: '600' }}>
                  ✓ Backup Loaded successfully. Click 'Restore Data' and authorize to write.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom invoice graphic template */}
        <div className="panel">
          <div className="panel-header">
            <h3>Invoice Layout template logo</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Company Header/Template Logo Image URL</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="https://example.com/logo.png"
              value={templateInputUrl} 
              onChange={e => setTemplateInputUrl(e.target.value)} 
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Add a URL to a header image banner. This replaces the standard company headers on A4 PDF previews.
            </p>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '12px' }} onClick={handleSaveInvoiceTemplate}>
              Apply Template Graphic
            </button>
          </div>
        </div>

        {/* Wipe Resets */}
        <div className="panel" style={{ borderColor: 'var(--danger-light)' }}>
          <div className="panel-header" style={{ borderBottomColor: 'var(--danger-light)' }}>
            <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} /> Danger Operations zone
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Clears all sales invoices, transactions ledger, outstandings payments, and resets all stock levels to 0. Keeps product definition lists and customer contacts directories.
              </p>
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => triggerCriticalAction('sales-cleanup')}>
                Clean Up Sales & Reset Stock
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--danger-light)' }} />

            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Performs a complete database wipe. Deletes all products, brands, customers, outstandings, and sales records. Wipes settings and resets credentials to default.
              </p>
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => triggerCriticalAction('reset')}>
                Full System Wipe & Reset
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Right audits timeline log column */}
      <div className="panel" style={{ height: '100%' }}>
        <div className="panel-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} /> Audit Trails & Logs
          </h3>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }} onClick={() => triggerCriticalAction('clear-logs')}>
            Clear Logs
          </button>
        </div>
        <div className="table-container" style={{ maxHeight: '700px', overflowY: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>User</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading audit trail logs...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td><b>{log.user}</b></td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>[{log.module}]</span> {log.action}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No audit records saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Action Confirm Modal */}
      {isConfirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Authorize Critical Action</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsConfirmModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCriticalActionSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {criticalActionType === 'reset' && 'You are executing a complete system reset. All products, sales, and customers lists will be wiped.'}
                  {criticalActionType === 'sales-cleanup' && 'You are cleaning up sales history ledger. Stock counts will reset to 0, but lists remain.'}
                  {criticalActionType === 'restore' && 'You are restoring a database dump. All current records will be overwritten.'}
                  {criticalActionType === 'clear-logs' && 'You are wiping all system audit timeline records.'}
                  <br /><br />
                  Please enter your administrator account password to authorize.
                </p>
                <div className="form-group">
                  <label className="form-label">Administrator Password *</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Enter password"
                    value={confirmPasswordInput} 
                    onChange={e => setConfirmPasswordInput(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsConfirmModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Authorize & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Settings;
