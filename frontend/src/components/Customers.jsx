import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  History, 
  X,
  UserCheck,
  ShoppingBag,
  DollarSign
} from 'lucide-react';
import { API_BASE } from '../App';

function Customers({ token, showToast }) {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form fields
  const [custForm, setCustForm] = useState({
    shop_name: '',
    owner_name: '',
    phone: '',
    gst_number: '',
    address: ''
  });

  // Target item details
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState({ sales: [], payments: [] });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [token, searchTerm]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustForm({
      shop_name: '',
      owner_name: '',
      phone: '',
      gst_number: '',
      address: ''
    });
    setIsCustomerModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setCustForm({
      shop_name: customer.shop_name,
      owner_name: customer.owner_name,
      phone: customer.phone,
      gst_number: customer.gst_number || '',
      address: customer.address || ''
    });
    setIsCustomerModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!custForm.shop_name || !custForm.owner_name || !custForm.phone) {
      showToast('Shop name, owner name and phone number are required', 'warning');
      return;
    }

    try {
      const url = editingCustomer ? `${API_BASE}/customers/${editingCustomer.id}` : `${API_BASE}/customers`;
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(custForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save customer');

      showToast(editingCustomer ? 'Customer profile updated' : 'Customer profile created');
      setIsCustomerModalOpen(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.shop_name);
    try {
      const res = await fetch(`${API_BASE}/customers/${customer.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch history logs');
      const data = await res.json();
      setSelectedCustomerHistory(data);
      setIsHistoryModalOpen(true);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const triggerDelete = (id, name) => {
    setDeleteTargetId(id);
    setSelectedCustomerName(name);
    setDeletePassword('');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;

    try {
      const res = await fetch(`${API_BASE}/customers/${deleteTargetId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: deletePassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete authorization failed');

      showToast('Customer deleted successfully');
      setIsDeleteModalOpen(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Page Header */}
      <div className="header-toolbar">
        <h2 className="page-title">Customer Accounts</h2>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Customer Shop
        </button>
      </div>

      {/* Search panel */}
      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by Shop, Owner or Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Customer profiles list */}
      <div className="panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Shop / Business Name</th>
                <th>Owner Name</th>
                <th>Phone Number</th>
                <th>GSTIN</th>
                <th>Address</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading customer data...
                  </td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map(c => (
                  <tr key={c.id}>
                    <td><b>{c.shop_name}</b></td>
                    <td>{c.owner_name}</td>
                    <td>{c.phone}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {c.gst_number || 'N/A'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.address || '-'}
                    </td>
                    <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto' }}
                        title="View Billing History"
                        onClick={() => handleViewHistory(c)}
                      >
                        <History size={16} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto', color: 'var(--primary)' }}
                        onClick={() => handleOpenEdit(c)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                        onClick={() => triggerDelete(c.id, c.shop_name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No customer accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isCustomerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer Details' : 'Add Customer Profile'}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsCustomerModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Shop / Business Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={custForm.shop_name} 
                    onChange={e => setCustForm({ ...custForm, shop_name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Full Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={custForm.owner_name} 
                    onChange={e => setCustForm({ ...custForm, owner_name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={custForm.phone} 
                    onChange={e => setCustForm({ ...custForm, phone: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={custForm.gst_number} 
                    onChange={e => setCustForm({ ...custForm, gst_number: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Business Address</label>
                  <textarea 
                    rows="3"
                    className="input-field" 
                    value={custForm.address} 
                    onChange={e => setCustForm({ ...custForm, address: e.target.value })} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCustomerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Ledger Drawer Modal */}
      {isHistoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Sales & Payments Ledger: {selectedCustomerName}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Active Sales */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <ShoppingBag size={16} /> Sales & Invoices
                </h4>
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomerHistory.sales?.length > 0 ? (
                        selectedCustomerHistory.sales.map(s => (
                          <tr key={s.id}>
                            <td><b>{s.invoice_number}</b></td>
                            <td>{new Date(s.sale_date).toLocaleDateString('en-IN')}</td>
                            <td>₹{parseFloat(s.grand_total).toFixed(2)}</td>
                            <td>₹{parseFloat(s.pending_amount).toFixed(2)}</td>
                            <td>
                              <span className={`badge ${
                                s.payment_status === 'Paid' ? 'badge-success' : 
                                s.payment_status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'
                              }`}>
                                {s.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                            No invoice records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Logs */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <DollarSign size={16} /> Received Payments Log
                </h4>
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice</th>
                        <th>Amount Paid</th>
                        <th>Method</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomerHistory.payments?.length > 0 ? (
                        selectedCustomerHistory.payments.map((p, i) => (
                          <tr key={i}>
                            <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                            <td><b>{p.invoice_number}</b></td>
                            <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{parseFloat(p.amount_paid).toFixed(2)}</td>
                            <td>{p.payment_method}</td>
                            <td>{p.remarks || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                            No payment transactions recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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

      {/* Delete Security Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Confirm Secure Delete</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsDeleteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDeleteConfirm}>
              <div className="modal-body">
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  You are attempting to delete the customer: <b>{selectedCustomerName}</b>. 
                  This will also cascadingly affect outstanding balances. Enter your login password to continue.
                </p>
                <div className="form-group">
                  <label className="form-label">Administrator Password *</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Enter password to authorize"
                    value={deletePassword} 
                    onChange={e => setDeletePassword(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Authorize Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
