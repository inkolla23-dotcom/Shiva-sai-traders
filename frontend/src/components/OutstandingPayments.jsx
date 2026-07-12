import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  History, 
  Calendar, 
  X,
  CreditCard,
  CheckCircle
} from 'lucide-react';
import { API_BASE } from '../App';

function OutstandingPayments({ token, showToast }) {
  const [outstandings, setOutstandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Active items for modals
  const [selectedOutstanding, setSelectedOutstanding] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  
  // Payment Form fields
  const [payForm, setPayForm] = useState({
    amount_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    remarks: ''
  });

  const fetchOutstandings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/outstandings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch outstanding balances');
      const data = await res.json();
      setOutstandings(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutstandings();
  }, [token]);

  // Form open helpers
  const handleOpenPayment = (op) => {
    setSelectedOutstanding(op);
    setPayForm({
      amount_paid: op.pending_amount, // Prefill with max remaining balance
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      remarks: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handleOpenHistory = async (op) => {
    setSelectedOutstanding(op);
    try {
      const res = await fetch(`${API_BASE}/sales/${op.sale_id}`);
      if (!res.ok) throw new Error('Failed to fetch transaction details');
      const data = await res.json();
      setPaymentHistory(data.payments || []);
      setIsHistoryModalOpen(true);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Submit payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payForm.amount_paid || parseFloat(payForm.amount_paid) <= 0) {
      showToast('Please enter a valid positive payment amount', 'warning');
      return;
    }

    if (parseFloat(payForm.amount_paid) > parseFloat(selectedOutstanding.pending_amount)) {
      showToast(`Payment cannot exceed outstanding balance of ₹${selectedOutstanding.pending_amount}`, 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/outstandings/${selectedOutstanding.id}/payment`, {
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
        'Invoice fully paid! Removed from outstandings list.' : 
        `Payment recorded. Remaining: ₹${data.remaining_balance}`
      );
      setIsPaymentModalOpen(false);
      fetchOutstandings();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Filter list by search term
  const filteredOutstandings = outstandings.filter(op => 
    op.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    op.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.owner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header */}
      <div className="header-toolbar">
        <h2 className="page-title">Accounts Receivable</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          Outstanding Payments Ledger
        </div>
      </div>

      {/* Search panel */}
      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by shop name, invoice..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Receivable list */}
      <div className="panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer / Shop</th>
                <th>Owner Name</th>
                <th>Invoice Number</th>
                <th>Grand Total</th>
                <th>Pending Balance</th>
                <th>Payment Due Date</th>
                <th>Status</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading outstanding logs...
                  </td>
                </tr>
              ) : filteredOutstandings.length > 0 ? (
                filteredOutstandings.map(op => {
                  const isOverdue = new Date(op.due_date) < new Date();
                  return (
                    <tr key={op.id}>
                      <td><b>{op.shop_name}</b></td>
                      <td>{op.owner_name}</td>
                      <td><b>{op.invoice_number}</b></td>
                      <td>₹{parseFloat(op.grand_total).toFixed(2)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: '700' }}>
                        ₹{parseFloat(op.pending_amount).toFixed(2)}
                      </td>
                      <td>
                        <span style={{ color: isOverdue ? 'var(--danger)' : 'inherit', fontWeight: isOverdue ? '700' : 'normal' }}>
                          {new Date(op.due_date).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                          {isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px', minWidth: 'auto' }}
                          title="View Payment Logs"
                          onClick={() => handleOpenHistory(op)}
                        >
                          <History size={16} />
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleOpenPayment(op)}
                        >
                          <DollarSign size={14} /> Pay
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No outstanding accounts receivable found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================== MODAL DIALOGS =================== */}

      {/* Receive Payment Modal */}
      {isPaymentModalOpen && selectedOutstanding && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Payment: {selectedOutstanding.shop_name}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsPaymentModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '10px' }}>
                  Invoice: <b>{selectedOutstanding.invoice_number}</b><br />
                  Outstanding Amount: <b style={{ color: 'var(--danger)' }}>₹{selectedOutstanding.pending_amount}</b>
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

      {/* Payment History Log Modal */}
      {isHistoryModalOpen && selectedOutstanding && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Payment History: {selectedOutstanding.invoice_number}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount Received</th>
                      <th>Method</th>
                      <th>Notes / Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.length > 0 ? (
                      paymentHistory.map((p, i) => (
                        <tr key={i}>
                          <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                          <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{parseFloat(p.amount_paid).toFixed(2)}</td>
                          <td>{p.payment_method}</td>
                          <td>{p.remarks || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                          No payment history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default OutstandingPayments;
