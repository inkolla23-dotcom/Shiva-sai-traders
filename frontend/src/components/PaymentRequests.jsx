import React, { useState, useEffect } from 'react';
import { Send, Search, X, MessageCircle, DollarSign } from 'lucide-react';
import { API_BASE } from '../App';

function PaymentRequests({ token, showToast }) {
  const [requests, setRequests] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Receive Payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [payForm, setPayForm] = useState({
    amount_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    remarks: ''
  });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Nearest due date first (already sorted server-side); rows disappear automatically
      // once pending_amount hits zero because the API only returns pending_amount > 0.
      const res = await fetch(`${API_BASE}/outstandings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch pending payment requests');
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusiness = async () => {
    try {
      const res = await fetch(`${API_BASE}/business`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBusiness(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchBusiness();
  }, [token]);

  const handleOpenPayment = (req) => {
    setSelectedRequest(req);
    setPayForm({
      amount_paid: req.pending_amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      remarks: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payForm.amount_paid || parseFloat(payForm.amount_paid) <= 0) {
      showToast('Please enter a valid positive payment amount', 'warning');
      return;
    }

    if (parseFloat(payForm.amount_paid) > parseFloat(selectedRequest.pending_amount)) {
      showToast(`Payment cannot exceed outstanding balance of ₹${selectedRequest.pending_amount}`, 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/outstandings/${selectedRequest.id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_paid: parseFloat(payForm.amount_paid),
          payment_date: payForm.payment_date,
          payment_method: payForm.payment_method,
          remarks: payForm.remarks
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment recording failed');

      showToast(data.remaining_balance === 0 ?
        'Fully paid! Removed from Payment Requests.' :
        `Payment recorded. Remaining: ₹${data.remaining_balance}`
      );
      setIsPaymentModalOpen(false);
      fetchRequests();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Send WhatsApp reminder directly from this list, no invoice preview needed
  const sendWhatsAppReminder = (req) => {
    const phone = req.phone || '';
    const publicLink = `${window.location.origin}/?invoiceId=${req.sale_id}`;
    const dueDateStr = req.due_date ? new Date(req.due_date).toLocaleDateString('en-IN') : 'Immediate';
    const upiLine = business?.upi_id ? `\n💳 *Pay using UPI:* ${business.upi_id}` : '';

    const message = `Hello ${req.owner_name || ''}, this is a payment reminder from *${business?.shop_name || 'Shiva Sai Traders'}*.

📄 *Invoice No:* ${req.invoice_number}
⚠️ *Amount Due:* ₹${parseFloat(req.pending_amount).toFixed(2)}
📅 *Due Date:* ${dueDateStr}${upiLine}

🔗 *Invoice Link:* ${publicLink}

Kindly clear the dues at your earliest convenience. Thank you!`;

    const url = `https://api.whatsapp.com/send?phone=91${phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredRequests = requests.filter(r =>
    r.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div className="header-toolbar">
        <h2 className="page-title">Payment Requests</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          Customers with pending dues, nearest due date first
        </div>
      </div>

      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search by shop, owner, or invoice..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
        </div>
      </div>

      <div className="panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Total Bill</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Due Date</th>
                <th>Phone</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading payment requests...
                  </td>
                </tr>
              ) : filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const isOverdue = new Date(req.due_date) < new Date();
                  const received = parseFloat(req.amount_received || (req.grand_total - req.pending_amount)) || 0;
                  return (
                    <tr key={req.id}>
                      <td>
                        <b>{req.shop_name}</b>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.owner_name}</div>
                      </td>
                      <td><b>{req.invoice_number}</b></td>
                      <td>₹{parseFloat(req.grand_total).toFixed(2)}</td>
                      <td style={{ color: 'var(--success)' }}>₹{received.toFixed(2)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: '700' }}>₹{parseFloat(req.pending_amount).toFixed(2)}</td>
                      <td>
                        <span style={{ color: isOverdue ? 'var(--danger)' : 'inherit', fontWeight: isOverdue ? '700' : 'normal' }}>
                          {req.due_date ? new Date(req.due_date).toLocaleDateString('en-IN') : '-'}
                        </span>
                      </td>
                      <td>{req.phone}</td>
                      <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px', minWidth: 'auto', borderColor: '#22c55e', color: '#22c55e' }}
                          title="Send WhatsApp Reminder"
                          onClick={() => sendWhatsAppReminder(req)}
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          onClick={() => handleOpenPayment(req)}
                        >
                          <DollarSign size={14} /> Receive
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No pending payment requests. All caught up!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Payment Modal */}
      {isPaymentModalOpen && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} /> Receive Payment: {selectedRequest.shop_name}
              </h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsPaymentModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '10px' }}>
                  Invoice: <b>{selectedRequest.invoice_number}</b><br />
                  Outstanding Amount: <b style={{ color: 'var(--danger)' }}>₹{selectedRequest.pending_amount}</b>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={payForm.payment_date}
                    onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Received (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="Enter amount paid"
                    value={payForm.amount_paid}
                    onChange={e => setPayForm({ ...payForm, amount_paid: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="input-field"
                    value={payForm.payment_method}
                    onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Notes / Reference</label>
                  <textarea
                    rows="2"
                    className="input-field"
                    placeholder="Txn ID, bank info..."
                    value={payForm.remarks}
                    onChange={e => setPayForm({ ...payForm, remarks: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentRequests;
