import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  ShieldAlert,
  Archive
} from 'lucide-react';
import { API_BASE } from '../App';

function Reports({ token, showToast }) {
  const [activeReport, setActiveReport] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Sales date filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); // first of current month
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/reports/${activeReport}`;
      if (activeReport === 'sales') {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load report data');
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token, activeReport, startDate, endDate]);

  // Export to CSV helper
  const exportToCsv = () => {
    if (!reportData) return;

    let headers = [];
    let rows = [];
    let filename = `sst_${activeReport}_report.csv`;

    if (activeReport === 'sales') {
      headers = ['Invoice Number', 'Customer Shop', 'Date', 'Taxable Amt', 'GST Amt', 'Grand Total', 'Amt Paid', 'Amt Pending', 'Status'];
      rows = (reportData.data || []).map(s => [
        s.invoice_number,
        s.shop_name,
        new Date(s.sale_date).toLocaleDateString('en-IN'),
        s.taxable_amount,
        s.gst_amount,
        s.grand_total,
        s.amount_received,
        s.pending_amount,
        s.payment_status
      ]);
    } else if (activeReport === 'inventory') {
      headers = ['Product Name', 'Brand', 'Cost Cost', 'Selling Rate', 'Min Stock', 'Current Stock', 'Stock Value'];
      rows = (reportData.data || []).map(p => [
        p.name,
        p.brand_name || 'Generic',
        p.purchase_price,
        p.selling_price,
        p.min_stock,
        p.current_stock,
        (p.current_stock * p.purchase_price).toFixed(2)
      ]);
    } else if (activeReport === 'outstanding') {
      headers = ['Customer Shop', 'Owner Name', 'Phone', 'Invoice', 'Due Date', 'Outstanding Balance'];
      rows = (reportData.data || []).map(o => [
        o.shop_name,
        o.owner_name,
        o.phone,
        o.invoice_number,
        new Date(o.due_date).toLocaleDateString('en-IN'),
        o.pending_amount
      ]);
    } else if (activeReport === 'expiry') {
      headers = ['Product Name', 'Brand', 'Current Stock', 'Expiry Date', 'Days Remaining', 'Status'];
      const expired = (reportData.expired || []).map(p => [
        p.name,
        p.brand_name || 'Generic',
        p.current_stock,
        new Date(p.expiry_date).toLocaleDateString('en-IN'),
        p.days_remaining,
        'EXPIRED'
      ]);
      const expiring = (reportData.expiringSoon || []).map(p => [
        p.name,
        p.brand_name || 'Generic',
        p.current_stock,
        new Date(p.expiry_date).toLocaleDateString('en-IN'),
        p.days_remaining,
        'EXPIRING SOON'
      ]);
      rows = [...expired, ...expiring];
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report CSV downloaded successfully');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header Toolbar */}
      <div className="header-toolbar no-print">
        <h2 className="page-title">Reports Hub</h2>
        <div className="actions-group">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print Report
          </button>
          <button className="btn btn-primary" onClick={exportToCsv} disabled={!reportData}>
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="no-print" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeReport === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('sales')}
        >
          Sales Ledger
        </button>
        <button 
          className={`btn ${activeReport === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('inventory')}
        >
          Inventory Valuation
        </button>
        <button 
          className={`btn ${activeReport === 'outstanding' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('outstanding')}
        >
          Active Receivables
        </button>
        <button 
          className={`btn ${activeReport === 'expiry' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('expiry')}
        >
          Expiry Watchlist
        </button>
      </div>

      {/* Date Filters (Only for Sales Report) */}
      {activeReport === 'sales' && (
        <div className="panel no-print" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Select Date Period:</span>
            <input 
              type="date" 
              className="input-field" 
              style={{ maxWidth: '200px' }}
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input 
              type="date" 
              className="input-field" 
              style={{ maxWidth: '200px' }}
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
          Compiling Report...
        </div>
      ) : reportData ? (
        <>
          {/* Aggregated totals based on report */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {activeReport === 'sales' && (
              <>
                <div className="stat-card">
                  <span className="stat-title">Total Revenue</span>
                  <div className="stat-value">₹{(reportData.summary?.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Total Collected</span>
                  <div className="stat-value" style={{ color: 'var(--success)' }}>₹{(reportData.summary?.totalReceived || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Total GST Collected</span>
                  <div className="stat-value">₹{(reportData.summary?.totalGst || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Sales Invoice Count</span>
                  <div className="stat-value">{reportData.summary?.invoiceCount || 0}</div>
                </div>
              </>
            )}

            {activeReport === 'inventory' && (
              <>
                <div className="stat-card">
                  <span className="stat-title">Total Products Directory</span>
                  <div className="stat-value">{reportData.summary?.totalProducts || 0}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Stock Volume Qty</span>
                  <div className="stat-value">{reportData.summary?.totalStockQty || 0} units</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Inventory Valuation (Cost)</span>
                  <div className="stat-value">₹{(reportData.summary?.totalPurchaseValue || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Low Stock Banners</span>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>{reportData.summary?.lowStockAlerts || 0}</div>
                </div>
              </>
            )}

            {activeReport === 'outstanding' && (
              <>
                <div className="stat-card">
                  <span className="stat-title">Outstanding Balance</span>
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>₹{(reportData.summary?.totalOutstanding || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Active Outstanding Invoices</span>
                  <div className="stat-value">{reportData.summary?.activeAccounts || 0}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Overdue Invoices</span>
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>{reportData.summary?.overdueAccounts || 0}</div>
                </div>
              </>
            )}

            {activeReport === 'expiry' && (
              <>
                <div className="stat-card">
                  <span className="stat-title">Expired Products</span>
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>{reportData.summary?.totalExpired || 0}</div>
                </div>
                <div className="stat-card">
                  <span className="stat-title">Expiring Soon (30 Days)</span>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>{reportData.summary?.totalExpiringSoon || 0}</div>
                </div>
              </>
            )}
          </div>

          {/* Table Data list */}
          <div className="panel">
            <div className="table-container">
              {activeReport === 'sales' && (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Customer Shop</th>
                      <th>Date</th>
                      <th>Taxable Base (₹)</th>
                      <th>GST (18%) (₹)</th>
                      <th>Invoice Total (₹)</th>
                      <th>Amt Received (₹)</th>
                      <th>Amt Pending (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data?.length > 0 ? (
                      reportData.data.map(s => (
                        <tr key={s.id}>
                          <td><b>{s.invoice_number}</b></td>
                          <td>{s.shop_name}</td>
                          <td>{new Date(s.sale_date).toLocaleDateString('en-IN')}</td>
                          <td>₹{parseFloat(s.taxable_amount).toFixed(2)}</td>
                          <td>₹{parseFloat(s.gst_amount).toFixed(2)}</td>
                          <td><b>₹{parseFloat(s.grand_total).toFixed(2)}</b></td>
                          <td style={{ color: 'var(--success)' }}>₹{parseFloat(s.amount_received).toFixed(2)}</td>
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
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No sales recorded in the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeReport === 'inventory' && (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Product Description</th>
                      <th>Brand</th>
                      <th>Cost Cost (₹)</th>
                      <th>Selling Rate (₹)</th>
                      <th>Min Stock</th>
                      <th>Current Stock</th>
                      <th>Inventory Valuation (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data?.length > 0 ? (
                      reportData.data.map(p => (
                        <tr key={p.id}>
                          <td><b>{p.name}</b></td>
                          <td>{p.brand_name || 'Generic'}</td>
                          <td>₹{parseFloat(p.purchase_price).toFixed(2)}</td>
                          <td>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                          <td>{p.min_stock}</td>
                          <td>
                            <span style={{ color: p.current_stock <= p.min_stock ? 'var(--warning)' : 'inherit', fontWeight: p.current_stock <= p.min_stock ? '700' : 'normal' }}>
                              {p.current_stock}
                            </span>
                          </td>
                          <td><b>₹{(p.current_stock * p.purchase_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No products found in the inventory database.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeReport === 'outstanding' && (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Customer / Shop</th>
                      <th>Owner Name</th>
                      <th>Phone</th>
                      <th>Invoice No</th>
                      <th>Due Date</th>
                      <th>Overdue Status</th>
                      <th>Outstanding Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data?.length > 0 ? (
                      reportData.data.map(o => (
                        <tr key={o.id}>
                          <td><b>{o.shop_name}</b></td>
                          <td>{o.owner_name}</td>
                          <td>{o.phone}</td>
                          <td><b>{o.invoice_number}</b></td>
                          <td>{new Date(o.due_date).toLocaleDateString('en-IN')}</td>
                          <td>
                            {o.is_overdue ? (
                              <span className="badge badge-danger">Overdue ({o.days_overdue} days)</span>
                            ) : (
                              <span className="badge badge-warning">Pending</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--danger)', fontWeight: '700' }}>
                            ₹{parseFloat(o.pending_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No outstanding balances reported.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeReport === 'expiry' && (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Product Description</th>
                      <th>Brand</th>
                      <th>Stock Qty</th>
                      <th>Expiry Date</th>
                      <th>Days Remaining</th>
                      <th>Status Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Expired list */}
                    {(reportData.expired || []).map(p => (
                      <tr key={`exp-${p.id}`} style={{ backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                        <td><b>{p.name}</b></td>
                        <td>{p.brand_name || 'Generic'}</td>
                        <td>{p.current_stock}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: '700' }}>{new Date(p.expiry_date).toLocaleDateString('en-IN')}</td>
                        <td>{Math.abs(p.days_remaining)} days ago</td>
                        <td>
                          <span className="badge badge-danger">Expired</span>
                        </td>
                      </tr>
                    ))}
                    {/* Render Expiring list */}
                    {(reportData.expiringSoon || []).map(p => (
                      <tr key={`soon-${p.id}`}>
                        <td><b>{p.name}</b></td>
                        <td>{p.brand_name || 'Generic'}</td>
                        <td>{p.current_stock}</td>
                        <td style={{ color: 'var(--warning)', fontWeight: '600' }}>{new Date(p.expiry_date).toLocaleDateString('en-IN')}</td>
                        <td>{p.days_remaining} days left</td>
                        <td>
                          <span className="badge badge-warning">Expiring Soon</span>
                        </td>
                      </tr>
                    ))}
                    {/* Empty placeholder */}
                    {(!reportData.expired?.length && !reportData.expiringSoon?.length) && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No expired or expiring products monitored.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Select a report tab to load compiled ledger logs.
        </div>
      )}
    </div>
  );
}

export default Reports;
