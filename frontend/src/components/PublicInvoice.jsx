import React, { useState, useEffect } from 'react';
import { API_BASE } from '../App';
import InvoiceTemplate from './InvoiceTemplate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function PublicInvoice({ invoiceId }) {
  const [saleData, setSaleData] = useState(null);
  const [items, setItems] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales/${invoiceId}`);
      if (!res.ok) throw new Error('Invoice not found or deleted');
      const data = await res.json();
      setSaleData(data.sale);
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusiness = async () => {
    try {
      const res = await fetch(`${API_BASE}/business`);
      if (res.ok) {
        const data = await res.json();
        setBusiness(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
      fetchBusiness();
    }
  }, [invoiceId]);

  const downloadPdf = () => {
    const element = document.getElementById('invoice-capture-pane');
    if (!element) return;

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

      pdf.save(`invoice_${saleData?.invoice_number || 'public'}.pdf`);
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#6b7280' }}>
        Loading Invoice Details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', gap: '16px' }}>
        <h2 style={{ color: '#ef4444' }}>Access Error</h2>
        <p style={{ color: '#4b5563' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Branding header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a8a' }}>
            {business?.shop_name || 'SHIVA SAI TRADERS'}
          </span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Public Billing View</span>
        </div>

        {/* Invoice template view block */}
        <InvoiceTemplate 
          saleData={saleData} 
          items={items} 
          business={business}
          onDownloadPdf={downloadPdf} 
        />
      </div>
    </div>
  );
}

export default PublicInvoice;
