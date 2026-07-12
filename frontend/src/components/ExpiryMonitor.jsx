import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { API_BASE } from '../App';

function ExpiryMonitor({ token, showToast }) {
  const [expiryData, setExpiryData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchExpiryData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/expiry`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load expiry monitor details');
      const data = await res.json();
      setExpiryData(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryData();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>
        Loading Expiry details...
      </div>
    );
  }

  const expiredList = expiryData?.expired || [];
  const expiringSoonList = expiryData?.expiringSoon || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header */}
      <div className="header-toolbar">
        <h2 className="page-title">Expiry Monitor</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          Batch Expiration Watchdog
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-header">
            <span className="stat-title">Expired Batches</span>
            <div className="stat-icon" style={{ backgroundColor: 'var(--danger-light)' }}>
              <ShieldAlert size={20} style={{ color: 'var(--danger)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{expiredList.length}</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-header">
            <span className="stat-title">Expiring Soon (30 Days)</span>
            <div className="stat-icon" style={{ backgroundColor: 'var(--warning-light)' }}>
              <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{expiringSoonList.length}</div>
        </div>
      </div>

      {/* Expired Products List */}
      <div className="panel">
        <div className="panel-header" style={{ borderBottomColor: 'var(--danger-light)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <ShieldAlert size={18} /> Already Expired Batches (Action Required)
          </h3>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Brand</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Current Stock</th>
                <th>Expiry Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expiredList.length > 0 ? (
                expiredList.map(p => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td>{p.brand_name || 'Generic'}</td>
                    <td>₹{parseFloat(p.purchase_price).toFixed(2)}</td>
                    <td>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                    <td style={{ fontWeight: '700' }}>{p.current_stock} units</td>
                    <td style={{ color: 'var(--danger)', fontWeight: '700' }}>
                      {new Date(p.expiry_date).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-danger">
                        {Math.abs(p.days_remaining)} days ago
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    ✓ No expired products in active inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiring Soon Products List */}
      <div className="panel">
        <div className="panel-header" style={{ borderBottomColor: 'var(--warning-light)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
            <Clock size={18} /> Expiring Soon (Next 30 Days)
          </h3>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Brand</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Current Stock</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
              </tr>
            </thead>
            <tbody>
              {expiringSoonList.length > 0 ? (
                expiringSoonList.map(p => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td>{p.brand_name || 'Generic'}</td>
                    <td>₹{parseFloat(p.purchase_price).toFixed(2)}</td>
                    <td>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                    <td>{p.current_stock} units</td>
                    <td style={{ color: 'var(--warning)', fontWeight: '600' }}>
                      {new Date(p.expiry_date).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-warning">
                        {p.days_remaining} days left
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No products expiring within the next 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default ExpiryMonitor;
