import React, { useState, useEffect } from 'react';
import { Store, Save, Image as ImageIcon, Trash2 } from 'lucide-react';
import { API_BASE } from '../App';

function BusinessDetails({ token, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    shop_name: '',
    owner_name: '',
    mobile: '',
    email: '',
    gst_number: '',
    upi_id: '',
    logo: null
  });

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/business`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load business details');
      const data = await res.json();
      setForm({
        shop_name: data.shop_name || '',
        owner_name: data.owner_name || '',
        mobile: data.mobile || '',
        email: data.email || '',
        gst_number: data.gst_number || '',
        upi_id: data.upi_id || '',
        logo: data.logo || null
      });
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [token]);

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo image should be under 2MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(prev => ({ ...prev, logo: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logo: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shop_name.trim() || !form.owner_name.trim() || !form.mobile.trim()) {
      showToast('Shop name, owner name, and mobile number are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/business`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save business details');

      showToast('Business details saved successfully');
      fetchDetails();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        Loading business details...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div className="header-toolbar">
        <h2 className="page-title">Business Details</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          Used automatically across every invoice
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '30px', alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} style={{ color: 'var(--primary)' }} /> Shop Profile
            </h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Shop Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.shop_name}
                  onChange={e => setForm({ ...form, shop_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Owner Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.owner_name}
                  onChange={e => setForm({ ...form, owner_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile Number *</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">GST Number</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.gst_number}
                  onChange={e => setForm({ ...form, gst_number: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">UPI ID</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="merchant@upi"
                  value={form.upi_id}
                  onChange={e => setForm({ ...form, upi_id: e.target.value })}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Included automatically in WhatsApp payment reminders.
                </p>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Business Details'}
            </button>
          </form>
        </div>

        {/* Logo Panel */}
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={18} style={{ color: 'var(--primary)' }} /> Shop Logo
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              height: '140px',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-primary)',
              overflow: 'hidden'
            }}>
              {form.logo ? (
                <img src={form.logo} alt="Shop Logo Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No logo uploaded</span>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              id="logo-file-picker"
              style={{ display: 'none' }}
              onChange={handleLogoSelect}
            />
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => document.getElementById('logo-file-picker').click()}>
                Upload Logo
              </button>
              {form.logo && (
                <button type="button" className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={handleRemoveLogo}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Appears at the top of every invoice, PDF download, and public invoice link. Optional, max 2MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessDetails;
