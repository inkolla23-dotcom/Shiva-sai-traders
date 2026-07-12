import React from 'react';
import { Download, Share2, MessageCircle } from 'lucide-react';

function InvoiceTemplate({ saleData, items = [], templateLogo = null, business = null, captureId = 'invoice-capture-pane', onDownloadPdf, onWhatsApp, onShareLink }) {
  if (!saleData) return null;

  // Standard GST calculation: 9% CGST + 9% SGST
  const cgstVal = parseFloat((saleData.taxable_amount * 0.09).toFixed(2));
  const sgstVal = parseFloat((saleData.taxable_amount * 0.09).toFixed(2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Control Actions (Only visible in App UI preview, hidden in print or PDF) */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '10px' }}>
        {onDownloadPdf && (
          <button className="btn btn-primary" onClick={onDownloadPdf}>
            <Download size={16} /> Download PDF
          </button>
        )}
        {onWhatsApp && (
          <button className="btn btn-secondary" onClick={onWhatsApp} style={{ borderColor: '#22c55e', color: '#22c55e' }}>
            <MessageCircle size={16} /> Share on WhatsApp
          </button>
        )}
        {onShareLink && (
          <button className="btn btn-secondary" onClick={onShareLink}>
            <Share2 size={16} /> Copy Public Link
          </button>
        )}
      </div>

      {/* Printable A4 Container */}
      <div id={captureId} className="invoice-print-area">
        {/* Background template support */}
        {templateLogo ? (
          <div style={{ width: '100%', marginBottom: '20px', textAlign: 'center' }}>
            <img src={templateLogo} alt="Company Template" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="invoice-header-row">
            <div>
              {business?.logo && (
                <img src={business.logo} alt="Shop Logo" style={{ maxHeight: '60px', maxWidth: '220px', objectFit: 'contain', marginBottom: '8px' }} />
              )}
              <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                {business?.shop_name || 'SHIVA SAI TRADERS'}
              </h2>
              <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                {business?.owner_name && <>Proprietor: {business.owner_name}<br /></>}
                GSTIN: {business?.gst_number || 'Not Provided'}<br />
                Phone: {business?.mobile || 'Not Provided'}<br />
                {business?.email && <>Email: {business.email}<br /></>}
              </p>
            </div>
            <div className="invoice-title-block">
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e3a8a' }}>TAX INVOICE</h2>
              <p style={{ fontSize: '13px', color: '#4b5563', marginTop: '6px' }}>
                Invoice No: <b>{saleData.invoice_number}</b><br />
                Date: {new Date(saleData.sale_date).toLocaleDateString('en-IN')}<br />
                Due Date: {saleData.due_date ? new Date(saleData.due_date).toLocaleDateString('en-IN') : 'Immediate'}
              </p>
            </div>
          </div>
        )}

        <hr style={{ border: '0', borderTop: '2px solid #1e3a8a', margin: '20px 0' }} />

        {/* Customer & Billing Row */}
        <div className="invoice-billing-details">
          <div>
            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '8px' }}>Billed To</h4>
            <h3 style={{ fontSize: '15px', fontWeight: '700' }}>{saleData.shop_name}</h3>
            <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px', lineHeight: '1.5' }}>
              Owner: {saleData.owner_name}<br />
              Phone: {saleData.phone}<br />
              GSTIN: {saleData.customer_gst || 'Unregistered'}<br />
              Address: {saleData.customer_address || '-'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '8px' }}>Payment Status</h4>
            <span style={{ 
              display: 'inline-block',
              padding: '6px 12px', 
              fontSize: '12px', 
              fontWeight: '700', 
              borderRadius: '4px',
              backgroundColor: saleData.payment_status === 'Paid' ? '#d1fae5' : saleData.payment_status === 'Partially Paid' ? '#fef3c7' : '#fee2e2',
              color: saleData.payment_status === 'Paid' ? '#065f46' : saleData.payment_status === 'Partially Paid' ? '#92400e' : '#991b1b',
              textTransform: 'uppercase'
            }}>
              {saleData.payment_status}
            </span>
          </div>
        </div>

        {/* Items Table */}
        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>S.No</th>
              <th>Product / Description</th>
              <th>Brand</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Unit Price (₹)</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index}>
                <td>{index + 1}</td>
                <td><b>{item.product_name}</b></td>
                <td>{item.brand_name || 'Generic'}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>{parseFloat(item.price).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{parseFloat(item.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total Calculations */}
        <div className="invoice-summary-row">
          <table className="invoice-summary-table" style={{ fontSize: '13px', lineHeight: '1.8' }}>
            <tbody>
              <tr>
                <td>Subtotal (Taxable Value):</td>
                <td style={{ textAlign: 'right' }}>₹{parseFloat(saleData.taxable_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST (9%):</td>
                <td style={{ textAlign: 'right' }}>₹{cgstVal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST (9%):</td>
                <td style={{ textAlign: 'right' }}>₹{sgstVal.toFixed(2)}</td>
              </tr>
              <tr style={{ borderTop: '2px solid #000000', fontSize: '16px', fontWeight: '800' }}>
                <td style={{ padding: '12px 0 6px 0' }}>Grand Total:</td>
                <td style={{ textAlign: 'right', padding: '12px 0 6px 0', color: '#1e3a8a' }}>₹{parseFloat(saleData.grand_total).toFixed(2)}</td>
              </tr>
              <tr style={{ color: '#059669', fontWeight: '600' }}>
                <td>Amount Received:</td>
                <td style={{ textAlign: 'right' }}>₹{parseFloat(saleData.amount_received).toFixed(2)}</td>
              </tr>
              <tr style={{ color: '#dc2626', fontWeight: '700' }}>
                <td>Pending Amount:</td>
                <td style={{ textAlign: 'right' }}>₹{parseFloat(saleData.pending_amount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #e5e7eb', margin: '40px 0 20px 0' }} />
        
        {/* Footer message */}
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>
          Thank you for your business with {business?.shop_name || 'us'}!
          {business?.email ? ` For queries, contact ${business.email}.` : ''}
        </div>
      </div>
    </div>
  );
}

export default InvoiceTemplate;
