import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  History, 
  AlertTriangle, 
  Calendar,
  X,
  Package,
  Eye
} from 'lucide-react';
import { API_BASE } from '../App';

function Products({ token, showToast, initialBrandMode = false }) {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandMode, setBrandMode] = useState(initialBrandMode);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Target item for actions
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [selectedProductHistory, setSelectedProductHistory] = useState([]);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteTargetType, setDeleteTargetType] = useState('product'); // 'product' or 'brand'
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Product Form fields
  const [prodForm, setProdForm] = useState({
    name: '',
    brand_id: '',
    brand_name: '', // for custom typing
    purchase_price: '',
    selling_price: '',
    min_stock: '5',
    current_stock: '0',
    mfg_date: '',
    expiry_date: '',
    expected_sales_completion_date: ''
  });
  const [isCustomBrand, setIsCustomBrand] = useState(false);

  // Brand Form fields
  const [brandNameInput, setBrandNameInput] = useState('');

  const fetchBrands = async () => {
    try {
      const res = await fetch(`${API_BASE}/brands`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch brands');
      const data = await res.json();
      setBrands(data);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/products?search=${encodeURIComponent(searchTerm)}`;
      if (filterBrand) url += `&brandId=${filterBrand}`;
      if (filterStock) url += `&stockStatus=${filterStock}`;
      if (filterExpiry) url += `&expiryStatus=${filterExpiry}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [token]);

  useEffect(() => {
    fetchProducts();
  }, [token, searchTerm, filterBrand, filterStock, filterExpiry]);

  // Sync initial brand state mode parameter
  useEffect(() => {
    setBrandMode(initialBrandMode);
  }, [initialBrandMode]);

  // Form helpers
  const handleOpenProductAdd = () => {
    setEditingProduct(null);
    setProdForm({
      name: '',
      brand_id: '',
      brand_name: '',
      purchase_price: '',
      selling_price: '',
      min_stock: '5',
      current_stock: '0',
      mfg_date: '',
      expiry_date: '',
      expected_sales_completion_date: ''
    });
    setIsCustomBrand(false);
    setIsProductModalOpen(true);
  };

  const handleOpenProductEdit = (product) => {
    setEditingProduct(product);
    setProdForm({
      name: product.name,
      brand_id: product.brand_id || '',
      brand_name: '',
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      min_stock: product.min_stock,
      current_stock: product.current_stock,
      mfg_date: product.mfg_date ? product.mfg_date.split('T')[0] : '',
      expiry_date: product.expiry_date ? product.expiry_date.split('T')[0] : '',
      expected_sales_completion_date: product.expected_sales_completion_date ? product.expected_sales_completion_date.split('T')[0] : ''
    });
    setIsCustomBrand(false);
    setIsProductModalOpen(true);
  };

  // Submit product add/edit
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.purchase_price || !prodForm.selling_price) {
      showToast('Please fill all required fields', 'warning');
      return;
    }

    const payload = {
      ...prodForm,
      purchase_price: parseFloat(prodForm.purchase_price),
      selling_price: parseFloat(prodForm.selling_price),
      min_stock: parseInt(prodForm.min_stock) || 0,
      current_stock: parseInt(prodForm.current_stock) || 0,
      brand_id: isCustomBrand ? null : prodForm.brand_id
    };

    try {
      const url = editingProduct ? `${API_BASE}/products/${editingProduct.id}` : `${API_BASE}/products`;
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');

      showToast(editingProduct ? 'Product updated successfully' : 'Product created successfully');
      setIsProductModalOpen(false);
      fetchProducts();
      fetchBrands();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Submit Brand creation
  const handleBrandSubmit = async (e) => {
    e.preventDefault();
    if (!brandNameInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/brands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: brandNameInput })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add brand');

      showToast('Brand added successfully');
      setBrandNameInput('');
      setIsBrandModalOpen(false);
      fetchBrands();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // View Product timeline history
  const handleViewHistory = async (product) => {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    try {
      const res = await fetch(`${API_BASE}/products/${product.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setSelectedProductHistory(data);
      setIsHistoryModalOpen(true);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Delete Action Trigger
  const triggerDelete = (type, id, name) => {
    setDeleteTargetType(type);
    setDeleteTargetId(id);
    setSelectedProductName(name);
    setDeletePassword('');
    setIsDeleteModalOpen(true);
  };

  // Process password protected delete
  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;

    try {
      const url = deleteTargetType === 'product' ? 
        `${API_BASE}/products/${deleteTargetId}/delete` : 
        `${API_BASE}/brands/${deleteTargetId}/delete`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: deletePassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      showToast(`${deleteTargetType === 'product' ? 'Product' : 'Brand'} deleted successfully`);
      setIsDeleteModalOpen(false);
      setDeletePassword('');
      fetchProducts();
      fetchBrands();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Top Header */}
      <div className="header-toolbar">
        <h2 className="page-title">{brandMode ? 'Brand Directory' : 'Product Inventory'}</h2>
        <div className="actions-group">
          {brandMode ? (
            <>
              <button className="btn btn-secondary" onClick={() => setBrandMode(false)}>
                Back to Products
              </button>
              <button className="btn btn-primary" onClick={() => setIsBrandModalOpen(true)}>
                <Plus size={16} /> Add Brand
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setBrandMode(true)}>
                Manage Brands
              </button>
              <button className="btn btn-primary" onClick={handleOpenProductAdd}>
                <Plus size={16} /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {brandMode ? (
        /* =================== BRAND LIST VIEW =================== */
        <div className="panel">
          <div className="panel-header">
            <h3>Registered Wholesale Brands</h3>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Brand Name</th>
                  <th>Created At</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.length > 0 ? (
                  brands.map(b => (
                    <tr key={b.id}>
                      <td><b>{b.name}</b></td>
                      <td>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                          onClick={() => triggerDelete('brand', b.id, b.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No brands found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =================== PRODUCT LIST VIEW =================== */
        <>
          {/* Filters Bar */}
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search Products..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
              </div>

              <select className="input-field" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select className="input-field" value={filterStock} onChange={e => setFilterStock(e.target.value)}>
                <option value="">All Stocks</option>
                <option value="ok">In Stock</option>
                <option value="low">Low Stock Alerts</option>
                <option value="out">Out of Stock</option>
              </select>

              <select className="input-field" value={filterExpiry} onChange={e => setFilterExpiry(e.target.value)}>
                <option value="">All Expiry Status</option>
                <option value="good">Safe Expiry (&gt; 30 Days)</option>
                <option value="expiring">Expiring Soon (&lt; 30 Days)</option>
                <option value="expired">Expired Products</option>
              </select>
            </div>
          </div>

          {/* Products Table */}
          <div className="panel">
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Brand</th>
                    <th>Purchase Price</th>
                    <th>Selling Price</th>
                    <th>Current Stock</th>
                    <th>Min Stock</th>
                    <th>Expiry Date</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Fetching product records...
                      </td>
                    </tr>
                  ) : products.length > 0 ? (
                    products.map(p => {
                      const isLowStock = p.current_stock <= p.min_stock;
                      const isExpired = p.expiry_date && new Date(p.expiry_date) < new Date();
                      
                      return (
                        <tr key={p.id}>
                          <td><b>{p.name}</b></td>
                          <td>
                            <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              {p.brand_name || 'Generic'}
                            </span>
                          </td>
                          <td>₹{parseFloat(p.purchase_price).toFixed(2)}</td>
                          <td>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                          <td>
                            <span style={{ 
                              color: p.current_stock === 0 ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'inherit',
                              fontWeight: isLowStock ? '700' : '500'
                            }}>
                              {p.current_stock}
                            </span>
                            {isLowStock && p.current_stock > 0 && <AlertTriangle size={14} style={{ marginLeft: '6px', color: 'var(--warning)', verticalAlign: 'middle' }} />}
                            {p.current_stock === 0 && <AlertTriangle size={14} style={{ marginLeft: '6px', color: 'var(--danger)', verticalAlign: 'middle' }} />}
                          </td>
                          <td>{p.min_stock}</td>
                          <td>
                            <span style={{ color: isExpired ? 'var(--danger)' : 'inherit', fontWeight: isExpired ? '600' : 'normal' }}>
                              {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-IN') : 'N/A'}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', minWidth: 'auto' }}
                              title="View History Timeline"
                              onClick={() => handleViewHistory(p)}
                            >
                              <History size={16} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', minWidth: 'auto', color: 'var(--primary)' }}
                              onClick={() => handleOpenProductEdit(p)}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                              onClick={() => triggerDelete('product', p.id, p.name)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No product matches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================== MODAL DIALOGS =================== */}

      {/* Product Form Modal */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product Details' : 'Add New Product'}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsProductModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Product Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={prodForm.name} 
                    onChange={e => setProdForm({ ...prodForm, name: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label">Brand</label>
                    <label className="form-label" style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setIsCustomBrand(!isCustomBrand)}>
                      {isCustomBrand ? 'Select Existing Brand' : '+ Type New Brand'}
                    </label>
                  </div>
                  {isCustomBrand ? (
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Type brand name manually"
                      value={prodForm.brand_name}
                      onChange={e => setProdForm({ ...prodForm, brand_name: e.target.value })}
                    />
                  ) : (
                    <select 
                      className="input-field" 
                      value={prodForm.brand_id} 
                      onChange={e => setProdForm({ ...prodForm, brand_id: e.target.value })}
                    >
                      <option value="">Generic / No Brand</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    value={prodForm.purchase_price} 
                    onChange={e => setProdForm({ ...prodForm, purchase_price: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    value={prodForm.selling_price} 
                    onChange={e => setProdForm({ ...prodForm, selling_price: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Min Stock Threshold *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={prodForm.min_stock} 
                    onChange={e => setProdForm({ ...prodForm, min_stock: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Stock *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={prodForm.current_stock} 
                    onChange={e => setProdForm({ ...prodForm, current_stock: e.target.value })}
                    disabled={!!editingProduct} // Only restock via replenishment once created
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mfg Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={prodForm.mfg_date} 
                    onChange={e => setProdForm({ ...prodForm, mfg_date: e.target.value })} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={prodForm.expiry_date} 
                    onChange={e => setProdForm({ ...prodForm, expiry_date: e.target.value })} 
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Expected Sales Completion Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={prodForm.expected_sales_completion_date} 
                    onChange={e => setProdForm({ ...prodForm, expected_sales_completion_date: e.target.value })} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Creation Modal */}
      {isBrandModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Brand Profile</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsBrandModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleBrandSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Brand Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter unique brand name" 
                    value={brandNameInput} 
                    onChange={e => setBrandNameInput(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBrandModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product History Timeline Modal */}
      {isHistoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Stock Timeline: {selectedProductName}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {selectedProductHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedProductHistory.map((h, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '12px', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: 'var(--bg-primary)',
                      borderLeft: `4px solid ${h.type === 'Replenishment' ? 'var(--success)' : 'var(--primary)'}`
                    }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>
                          {h.type} {h.invoice_number ? `(${h.invoice_number})` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(h.date).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', color: h.type === 'Replenishment' ? 'var(--success)' : 'inherit' }}>
                          {h.type === 'Replenishment' ? '+' : '-'}{h.quantity} Qty
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Rate: ₹{parseFloat(h.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No transaction log history recorded.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Delete Security Modal */}
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
                  You are attempting to delete the {deleteTargetType}: <b>{selectedProductName}</b>. 
                  This action is irreversible. Enter your login password to continue.
                </p>
                <div className="form-group">
                  <label className="form-label">Administrator Password *</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Enter password to authenticate"
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

export default Products;
