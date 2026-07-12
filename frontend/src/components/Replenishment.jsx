import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Calendar, ShieldAlert } from 'lucide-react';
import { API_BASE } from '../App';

function Replenishment({ token, showToast }) {
  const [replenishList, setReplenishList] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [productId, setProductId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [quantityAdded, setQuantityAdded] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().split('T')[0]);

  const fetchReplenishHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/replenish`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch replenishment history');
      const data = await res.json();
      setReplenishList(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReplenishHistory();
    fetchProducts();
  }, [token]);

  // Sync price pre-fill on product selection
  useEffect(() => {
    if (productId) {
      const prod = products.find(p => p.id === parseInt(productId));
      if (prod) {
        setPurchasePrice(prod.purchase_price);
      }
    } else {
      setPurchasePrice('');
    }
  }, [productId, products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !purchasePrice || !quantityAdded || parseInt(quantityAdded) <= 0) {
      showToast('Please fill all required fields correctly', 'warning');
      return;
    }

    const payload = {
      product_id: parseInt(productId),
      purchase_price: parseFloat(purchasePrice),
      quantity_added: parseInt(quantityAdded),
      expiry_date: expiryDate || null,
      date_added: dateAdded
    };

    try {
      const res = await fetch(`${API_BASE}/replenish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Replenishment failed');

      showToast('Stock replenished and logged successfully!');
      
      // Clear form
      setProductId('');
      setPurchasePrice('');
      setQuantityAdded('');
      setExpiryDate('');
      setDateAdded(new Date().toISOString().split('T')[0]);

      // Refresh list
      fetchReplenishHistory();
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Restock Form Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} style={{ color: 'var(--primary)' }} /> Restock Inventory
          </h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Select Product *</label>
            <select 
              className="input-field" 
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required
            >
              <option value="">-- Choose Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Purchase Unit Cost (₹) *</label>
            <input 
              type="number" 
              step="0.01" 
              className="input-field"
              placeholder="0.00"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quantity Added *</label>
            <input 
              type="number" 
              className="input-field"
              placeholder="Enter units added"
              value={quantityAdded}
              onChange={e => setQuantityAdded(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Batch Expiry Date</label>
            <input 
              type="date" 
              className="input-field"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Restocking Date *</label>
            <input 
              type="date" 
              className="input-field"
              value={dateAdded}
              onChange={e => setDateAdded(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Add Inventory Units
          </button>
        </form>
      </div>

      {/* History timeline log panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Replenishment Timeline Logs</h3>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date Logged</th>
                <th>Product Description</th>
                <th>Brand</th>
                <th>Units Restocked</th>
                <th>Cost Price</th>
                <th>Batch Expiry</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading stock records...
                  </td>
                </tr>
              ) : replenishList.length > 0 ? (
                replenishList.map(ir => (
                  <tr key={ir.id}>
                    <td>{new Date(ir.date_added).toLocaleDateString('en-IN')}</td>
                    <td><b>{ir.product_name}</b></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {ir.brand_name || 'Generic'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--success)', fontWeight: '700' }}>+{ir.quantity_added} units</td>
                    <td>₹{parseFloat(ir.purchase_price).toFixed(2)}</td>
                    <td>
                      {ir.expiry_date ? new Date(ir.expiry_date).toLocaleDateString('en-IN') : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No replenishment entries recorded.
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

export default Replenishment;
