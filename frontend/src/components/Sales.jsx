import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  X, 
  ShoppingCart, 
  PlusCircle, 
  MinusCircle, 
  FileText,
  Download,
  MessageCircle
} from 'lucide-react';
import { API_BASE } from '../App';
import InvoiceTemplate from './InvoiceTemplate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function Sales({ token, showToast }) {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [business, setBusiness] = useState(null);

  // Hidden off-screen render used to generate a PDF directly from the table row
  // (without needing to open the invoice preview modal first)
  const [pdfSale, setPdfSale] = useState(null);
  const [pdfItems, setPdfItems] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal Switchers
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Active Sale details
  const [activeSale, setActiveSale] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  
  // Delete action target
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteInvoiceNumber, setDeleteInvoiceNumber] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // Checkout Wizard state
  const [checkoutCustomer, setCheckoutCustomer] = useState('');
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkoutDueDate, setCheckoutDueDate] = useState('');
  const [checkoutRemarks, setCheckoutRemarks] = useState('');
  const [checkoutReceived, setCheckoutReceived] = useState('0');
  const [checkoutItems, setCheckoutItems] = useState([]); // Array of { product_id, name, quantity, price, stock }

  // Current item builder fields
  const [currentItemId, setCurrentItemId] = useState('');
  const [currentItemQty, setCurrentItemQty] = useState('1');
  const [currentItemPrice, setCurrentItemPrice] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/sales?search=${encodeURIComponent(searchTerm)}`;
      if (filterCustomer) url += `&customerId=${filterCustomer}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch sales records');
      const data = await res.json();
      setSales(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpers = async () => {
    try {
      // Fetch customers
      const resCust = await fetch(`${API_BASE}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const custData = await resCust.json();
      setCustomers(custData);

      // Fetch products
      const resProd = await fetch(`${API_BASE}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const prodData = await resProd.json();
      setProducts(prodData);

      // Fetch business details (used dynamically on every invoice/PDF/WhatsApp message)
      const resBiz = await fetch(`${API_BASE}/business`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resBiz.ok) {
        const bizData = await resBiz.json();
        setBusiness(bizData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchHelpers();
  }, [token, searchTerm, filterCustomer, startDate, endDate]);

  // Sync pricing pre-fill on product selection
  useEffect(() => {
    if (currentItemId) {
      const prod = products.find(p => p.id === parseInt(currentItemId));
      if (prod) {
        setCurrentItemPrice(prod.selling_price);
      }
    } else {
      setCurrentItemPrice('');
    }
  }, [currentItemId, products]);

  const handleOpenRecord = () => {
    setCheckoutCustomer('');
    setCheckoutDate(new Date().toISOString().split('T')[0]);
    setCheckoutDueDate('');
    setCheckoutRemarks('');
    setCheckoutReceived('0');
    setCheckoutItems([]);
    setCurrentItemId('');
    setCurrentItemQty('1');
    setCurrentItemPrice('');
    setIsRecordModalOpen(true);
  };

  // Add Item to Checkout List
  const handleAddItem = () => {
    if (!currentItemId || parseInt(currentItemQty) <= 0 || parseFloat(currentItemPrice) < 0) {
      showToast('Please select a product, and enter positive quantities/pricing', 'warning');
      return;
    }

    const prodId = parseInt(currentItemId);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    // Check inventory stock limits
    const existing = checkoutItems.find(item => item.product_id === prodId);
    const totalQty = parseInt(currentItemQty) + (existing ? existing.quantity : 0);

    if (prod.current_stock < totalQty) {
      showToast(`Only ${prod.current_stock} units left in stock. Cannot add more.`, 'danger');
      return;
    }

    if (existing) {
      setCheckoutItems(checkoutItems.map(item => 
        item.product_id === prodId ? { ...item, quantity: totalQty, price: parseFloat(currentItemPrice) } : item
      ));
    } else {
      setCheckoutItems([...checkoutItems, {
        product_id: prodId,
        name: prod.name,
        quantity: parseInt(currentItemQty),
        price: parseFloat(currentItemPrice),
        stock: prod.current_stock
      }]);
    }

    setCurrentItemId('');
    setCurrentItemQty('1');
    setCurrentItemPrice('');
  };

  const handleRemoveCheckoutItem = (prodId) => {
    setCheckoutItems(checkoutItems.filter(item => item.product_id !== prodId));
  };

  // Live total calculations
  const calculateCheckoutTotals = () => {
    const taxable = checkoutItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const gst = parseFloat((taxable * 0.18).toFixed(2));
    const grand = parseFloat((taxable + gst).toFixed(2));
    const pending = parseFloat((grand - parseFloat(checkoutReceived || 0)).toFixed(2));
    return { taxable, gst, grand, pending };
  };

  // Submit sale record
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!checkoutCustomer || checkoutItems.length === 0) {
      showToast('Select a customer and add at least one product', 'warning');
      return;
    }

    const totals = calculateCheckoutTotals();
    if (totals.pending < 0) {
      showToast('Amount received cannot exceed the grand total', 'warning');
      return;
    }

    const payload = {
      customer_id: parseInt(checkoutCustomer),
      sale_date: checkoutDate,
      remarks: checkoutRemarks,
      amount_received: parseFloat(checkoutReceived) || 0,
      due_date: checkoutDueDate || null,
      items: checkoutItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }))
    };

    try {
      const res = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record sale');

      showToast(`Sale recorded successfully! Invoice: ${data.invoice_number}`);
      setIsRecordModalOpen(false);
      fetchSales();
      fetchHelpers(); // Update available stocks in product dropdown list
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // View Invoice detail
  const handleViewInvoice = async (saleId) => {
    try {
      const res = await fetch(`${API_BASE}/sales/${saleId}`);
      if (!res.ok) throw new Error('Invoice fetching failed');
      const data = await res.json();
      setActiveSale(data.sale);
      setActiveItems(data.items);
      setIsInvoiceModalOpen(true);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // PDF direct download generator (used inside the invoice preview modal)
  const downloadPdf = () => {
    const element = document.getElementById('invoice-capture-pane');
    if (!element) return;

    showToast('Preparing your PDF download...', 'info');

    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`invoice_${activeSale?.invoice_number || 'sst'}.pdf`);
      showToast('PDF downloaded successfully');
    });
  };

  // Direct "Download PDF" from the Sales Log table row -- fetches the full invoice
  // (items included) then renders it off-screen so it can be captured, without
  // requiring the user to open the invoice preview modal first.
  const handleDirectDownloadPdf = async (saleId, invoiceNumber) => {
    try {
      showToast('Preparing your PDF download...', 'info');
      const res = await fetch(`${API_BASE}/sales/${saleId}`);
      if (!res.ok) throw new Error('Failed to fetch invoice data');
      const data = await res.json();
      setPdfSale(data.sale);
      setPdfItems(data.items);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Once the hidden invoice renders with the fetched sale data, capture and save it as a PDF
  useEffect(() => {
    if (!pdfSale) return;

    const timer = setTimeout(() => {
      const element = document.getElementById('invoice-capture-pane-hidden');
      if (!element) {
        setPdfSale(null);
        setPdfItems([]);
        return;
      }

      html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`invoice_${pdfSale.invoice_number || 'sst'}.pdf`);
        showToast('PDF downloaded successfully');
        setPdfSale(null);
        setPdfItems([]);
      }).catch(() => {
        showToast('PDF generation failed', 'danger');
        setPdfSale(null);
        setPdfItems([]);
      });
    }, 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSale]);

  // Builds and opens the WhatsApp message for a given sale record (works from
  // either the table row directly, or from the invoice preview modal)
  const sendWhatsAppForSale = (sale) => {
    if (!sale) return;
    const phone = sale.phone || '';
    const publicLink = `${window.location.origin}/?invoiceId=${sale.id}`;
    const upiLine = business?.upi_id ? `\n💳 *Pay using UPI:* ${business.upi_id}` : '';

    const message = `Hello, this is an invoice update from *${business?.shop_name || 'Shiva Sai Traders'}*.

📄 *Invoice No:* ${sale.invoice_number}
💰 *Total Amount:* ₹${parseFloat(sale.grand_total).toFixed(2)}
✅ *Received Amount:* ₹${parseFloat(sale.amount_received).toFixed(2)}
⚠️ *Outstanding Amount:* ₹${parseFloat(sale.pending_amount).toFixed(2)}
📅 *Due Date:* ${sale.due_date ? new Date(sale.due_date).toLocaleDateString('en-IN') : 'Immediate'}${upiLine}

🔗 *View Invoice Online:* ${publicLink}`;

    const url = `https://api.whatsapp.com/send?phone=91${phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // WhatsApp Messaging share trigger (invoice preview modal)
  const sendWhatsApp = () => {
    sendWhatsAppForSale(activeSale);
  };

  // Copy public link helper
  const copyPublicLink = () => {
    if (!activeSale) return;
    const publicLink = `${window.location.origin}/?invoiceId=${activeSale.id}`;
    navigator.clipboard.writeText(publicLink).then(() => {
      showToast('Public Link copied to clipboard!');
    }).catch(err => {
      showToast('Failed to copy link', 'danger');
    });
  };

  // Triggers password protected delete
  const triggerDelete = (id, invoiceNum) => {
    setDeleteTargetId(id);
    setDeleteInvoiceNumber(invoiceNum);
    setDeletePassword('');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (!deletePassword) return;

    try {
      const res = await fetch(`${API_BASE}/sales/${deleteTargetId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: deletePassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authorization failed');

      showToast(`Invoice ${deleteInvoiceNumber} deleted, stocks reverted`);
      setIsDeleteModalOpen(false);
      fetchSales();
      fetchHelpers(); // Update stock availability lists
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Render checkout wizard totals panel
  const wizardTotals = calculateCheckoutTotals();

  // Load template graphic from settings
  const templateLogo = localStorage.getItem('sst_invoice_template');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* View Header */}
      <div className="header-toolbar">
        <h2 className="page-title">Sales & Billing</h2>
        <button className="btn btn-primary" onClick={handleOpenRecord}>
          <ShoppingCart size={16} /> Record New Sale
        </button>
      </div>

      {/* Filter panel */}
      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Invoice or Shop Name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
          </div>

          <select className="input-field" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name}</option>)}
          </select>

          <input 
            type="date" 
            className="input-field" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            placeholder="From Date"
          />

          <input 
            type="date" 
            className="input-field" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            placeholder="To Date"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Customer / Shop</th>
                <th>Sale Date</th>
                <th>Grand Total</th>
                <th>Amount Paid</th>
                <th>Balance Outstanding</th>
                <th>Payment Status</th>
                <th style={{ width: '170px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading transactions log...
                  </td>
                </tr>
              ) : sales.length > 0 ? (
                sales.map(s => (
                  <tr key={s.id}>
                    <td><b>{s.invoice_number}</b></td>
                    <td>{s.shop_name}</td>
                    <td>{new Date(s.sale_date).toLocaleDateString('en-IN')}</td>
                    <td>₹{parseFloat(s.grand_total).toFixed(2)}</td>
                    <td style={{ color: 'var(--success)', fontWeight: '500' }}>₹{parseFloat(s.amount_received).toFixed(2)}</td>
                    <td style={{ color: s.pending_amount > 0 ? 'var(--danger)' : 'inherit' }}>
                      ₹{parseFloat(s.pending_amount).toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge ${
                        s.payment_status === 'Paid' ? 'badge-success' : 
                        s.payment_status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto', color: 'var(--primary)' }}
                        title="View Invoice"
                        onClick={() => handleViewInvoice(s.id)}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto' }}
                        title="Download PDF"
                        onClick={() => handleDirectDownloadPdf(s.id, s.invoice_number)}
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto', borderColor: '#22c55e', color: '#22c55e' }}
                        title="Share on WhatsApp"
                        onClick={() => sendWhatsAppForSale(s)}
                      >
                        <MessageCircle size={16} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                        title="Delete Invoice"
                        onClick={() => triggerDelete(s.id, s.invoice_number)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No sales invoices recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================== CHECKOUT WIZARD MODAL =================== */}
      {isRecordModalOpen && (
        <div className="modal-overlay" style={{ zIndex: '999' }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3>Record Wholesale Transaction</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsRecordModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRecordSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Left Form Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Select Customer Shop *</label>
                    <select 
                      className="input-field" 
                      value={checkoutCustomer} 
                      onChange={e => setCheckoutCustomer(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name} ({c.owner_name})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Billing Date *</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={checkoutDate}
                        onChange={e => setCheckoutDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Due Date</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={checkoutDueDate}
                        onChange={e => setCheckoutDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Add Item Widget */}
                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Add Billing Item</h4>
                    
                    <div className="form-group">
                      <select 
                        className="input-field" 
                        value={currentItemId}
                        onChange={e => setCurrentItemId(e.target.value)}
                      >
                        <option value="">-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                            {p.name} (Stock: {p.current_stock} | ₹{p.selling_price})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Billing Quantity</label>
                        <input 
                          type="number" 
                          className="input-field"
                          value={currentItemQty}
                          onChange={e => setCurrentItemQty(e.target.value)}
                          min="1"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Selling Rate (₹)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="input-field"
                          value={currentItemPrice}
                          onChange={e => setCurrentItemPrice(e.target.value)}
                        />
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ width: '100%', marginTop: '12px' }}
                      onClick={handleAddItem}
                    >
                      Add to Invoice List
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Remarks / Sales Notes</label>
                    <textarea 
                      rows="2"
                      className="input-field" 
                      value={checkoutRemarks}
                      onChange={e => setCheckoutRemarks(e.target.value)}
                    />
                  </div>
                </div>

                {/* Right Items & Total List Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                  <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Billing Itemized Summary</h4>
                  
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {checkoutItems.length > 0 ? (
                      checkoutItems.map(item => (
                        <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '700' }}>{item.name}</span>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Qty: {item.quantity} × ₹{item.price.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>₹{(item.quantity * item.price).toFixed(2)}</span>
                            <button type="button" onClick={() => handleRemoveCheckoutItem(item.product_id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No items added yet.
                      </div>
                    )}
                  </div>

                  {/* Calculations Details Card */}
                  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span>Subtotal (Before Tax):</span>
                      <span>₹{wizardTotals.taxable.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span>GST (CGST 9% + SGST 9%):</span>
                      <span>₹{wizardTotals.gst.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', marginBottom: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                      <span>Grand Total:</span>
                      <span>₹{wizardTotals.grand.toFixed(2)}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Immediate Payment (₹)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="input-field" 
                          value={checkoutReceived}
                          onChange={e => setCheckoutReceived(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Pending Balance (₹)</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={wizardTotals.pending.toFixed(2)}
                          disabled
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={checkoutItems.length === 0}>
                  Generate Invoice & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================== VIEW INVOICE MODAL =================== */}
      {isInvoiceModalOpen && activeSale && (
        <div className="modal-overlay" style={{ zIndex: '1010' }}>
          <div className="modal-content" style={{ maxWidth: '880px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Invoice Details Preview</h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setIsInvoiceModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <InvoiceTemplate 
              saleData={activeSale} 
              items={activeItems} 
              templateLogo={templateLogo}
              business={business}
              onDownloadPdf={downloadPdf} 
              onWhatsApp={sendWhatsApp}
              onShareLink={copyPublicLink}
            />

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden off-screen render used only to capture a PDF directly from the table row */}
      {pdfSale && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }}>
          <InvoiceTemplate 
            saleData={pdfSale} 
            items={pdfItems} 
            templateLogo={templateLogo}
            business={business}
            captureId="invoice-capture-pane-hidden"
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
                  You are attempting to delete the invoice: <b>{deleteInvoiceNumber}</b>. 
                  This will restore product stocks and clear outstanding payments. Enter your login password to continue.
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

export default Sales;
