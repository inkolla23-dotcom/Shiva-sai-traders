import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Tag, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  RefreshCw, 
  AlertTriangle, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Sun, 
  Moon,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Store,
  Send
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Customers from './components/Customers';
import Sales from './components/Sales';
import OutstandingPayments from './components/OutstandingPayments';
import Replenishment from './components/Replenishment';
import ExpiryMonitor from './components/ExpiryMonitor';
import Reports from './components/Reports';
import Settings from './components/Settings';
import PublicInvoice from './components/PublicInvoice';
import BusinessDetails from './components/BusinessDetails';
import PaymentRequests from './components/PaymentRequests';

// The backend mounts every route under /api (e.g. /api/auth/login), and every
// component in this app calls `${API_BASE}/something`, so API_BASE itself must
// already include the /api segment and must NOT end with a trailing slash.
// Set VITE_API_BASE in the frontend's environment (e.g. Vercel project settings
// or a local .env file) to point at your deployed backend, for example:
//   VITE_API_BASE=https://your-backend.onrender.com/api
const rawApiBase = import.meta.env.VITE_API_BASE || 'https://shiva-sai-traders-backend.onrender.com/api';
export const API_BASE = rawApiBase.replace(/\/+$/, '');

function App() {
  const [token, setToken] = useState(localStorage.getItem('sst_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('sst_user')) || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('sst_theme') || 'dark');
  const [toasts, setToasts] = useState([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Auth fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sst_theme', theme);
  }, [theme]);

  // Toast helper
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('sst_token', data.token);
      localStorage.setItem('sst_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      showToast('Logged in successfully!');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sst_token');
    localStorage.removeItem('sst_user');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully', 'info');
  };

  // Global search trigger
  useEffect(() => {
    if (!token) return;
    const delayDebounceFn = setTimeout(async () => {
      if (globalSearch.trim().length > 1) {
        try {
          const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(globalSearch)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          setSearchResults(data);
          setIsSearchOpen(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults(null);
        setIsSearchOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [globalSearch, token]);

  // Public Invoice Bypass
  const urlParams = new URLSearchParams(window.location.search);
  const publicInvoiceId = urlParams.get('invoiceId');
  if (publicInvoiceId) {
    return <PublicInvoice invoiceId={publicInvoiceId} />;
  }

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo">SHIVA SAI TRADERS</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Inventory Management System</p>
          </div>
          {authError && (
            <div style={{
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              marginBottom: '20px',
              border: '1px solid var(--danger)'
            }}>
              {authError}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="Enter email" 
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '10px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render proper view based on activeTab
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard token={token} showToast={showToast} setActiveTab={setActiveTab} />;
      case 'products':
        return <Products token={token} showToast={showToast} />;
      case 'brands':
        // Reuse products brand view or dedicated tab
        return <Products token={token} showToast={showToast} initialBrandMode={true} />;
      case 'customers':
        return <Customers token={token} showToast={showToast} />;
      case 'sales':
        return <Sales token={token} showToast={showToast} />;
      case 'outstanding':
        return <OutstandingPayments token={token} showToast={showToast} />;
      case 'payment-requests':
        return <PaymentRequests token={token} showToast={showToast} />;
      case 'replenishment':
        return <Replenishment token={token} showToast={showToast} />;
      case 'expiry':
        return <ExpiryMonitor token={token} showToast={showToast} />;
      case 'reports':
        return <Reports token={token} showToast={showToast} />;
      case 'business':
        return <BusinessDetails token={token} showToast={showToast} />;
      case 'settings':
        return <Settings token={token} showToast={showToast} handleLogout={handleLogout} setUser={setUser} user={user} setToken={setToken} />;
      default:
        return <Dashboard token={token} showToast={showToast} setActiveTab={setActiveTab} />;
    }
  };

  const handleSearchResultClick = (tab, id) => {
    setIsSearchOpen(false);
    setGlobalSearch('');
    setActiveTab(tab);
    // Provide a brief window for tab rendering, then let components focus/highlight it if desired
  };

  return (
    <div className="app-wrapper">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{
            backgroundColor: t.type === 'danger' ? 'var(--danger)' : 
                            t.type === 'warning' ? 'var(--warning)' : 
                            t.type === 'info' ? 'var(--primary)' : 'var(--success)'
          }}>
            {t.type === 'danger' && <XCircle size={18} />}
            {t.type === 'warning' && <AlertCircle size={18} />}
            {t.type === 'info' && <AlertCircle size={18} />}
            {t.type === 'success' && <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <div className="sidebar no-print">
        <div className="sidebar-header">
          <span className="sidebar-logo">SHIVA SAI</span>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary" 
            style={{ padding: '6px', minWidth: 'auto', borderRadius: '50%' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="sidebar-menu">
          <button className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={`sidebar-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <Package size={18} /> Products
          </button>
          <button className={`sidebar-item ${activeTab === 'brands' ? 'active' : ''}`} onClick={() => setActiveTab('brands')}>
            <Tag size={18} /> Brand Management
          </button>
          <button className={`sidebar-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            <Users size={18} /> Customers
          </button>
          <button className={`sidebar-item ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>
            <ShoppingCart size={18} /> Sales & Invoicing
          </button>
          <button className={`sidebar-item ${activeTab === 'outstanding' ? 'active' : ''}`} onClick={() => setActiveTab('outstanding')}>
            <DollarSign size={18} /> Outstanding Payments
          </button>
          <button className={`sidebar-item ${activeTab === 'payment-requests' ? 'active' : ''}`} onClick={() => setActiveTab('payment-requests')}>
            <Send size={18} /> Payment Requests
          </button>
          <button className={`sidebar-item ${activeTab === 'replenishment' ? 'active' : ''}`} onClick={() => setActiveTab('replenishment')}>
            <RefreshCw size={18} /> Restock / Replenish
          </button>
          <button className={`sidebar-item ${activeTab === 'expiry' ? 'active' : ''}`} onClick={() => setActiveTab('expiry')}>
            <AlertTriangle size={18} /> Expiry Monitor
          </button>
          <button className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <FileText size={18} /> Reports
          </button>
          <button className={`sidebar-item ${activeTab === 'business' ? 'active' : ''}`} onClick={() => setActiveTab('business')}>
            <Store size={18} /> Business Details
          </button>
          <button className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={18} /> Settings & Logs
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">Signed in as <b>{user?.email}</b></div>
          <button className="sidebar-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="main-content">
        {/* Header Search bar */}
        <div className="header-toolbar no-print">
          <div className="global-search-container">
            <input 
              type="text" 
              className="input-field" 
              placeholder="Global Search (Products, Brands, Invoices...)" 
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />

            {isSearchOpen && searchResults && (
              <div className="search-dropdown">
                {/* Products */}
                {searchResults.products?.length > 0 && (
                  <div>
                    <div className="search-section-title">Products</div>
                    {searchResults.products.map(p => (
                      <div key={p.id} className="search-result-item" onClick={() => handleSearchResultClick('products', p.id)}>
                        <span>{p.name} ({p.brand_name || 'Generic'})</span>
                        <span style={{ color: 'var(--text-muted)' }}>Stock: {p.current_stock}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Brands */}
                {searchResults.brands?.length > 0 && (
                  <div>
                    <div className="search-section-title">Brands</div>
                    {searchResults.brands.map(b => (
                      <div key={b.id} className="search-result-item" onClick={() => handleSearchResultClick('brands', b.id)}>
                        <span>{b.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Customers */}
                {searchResults.customers?.length > 0 && (
                  <div>
                    <div className="search-section-title">Customers</div>
                    {searchResults.customers.map(c => (
                      <div key={c.id} className="search-result-item" onClick={() => handleSearchResultClick('customers', c.id)}>
                        <span>{c.shop_name} ({c.owner_name})</span>
                        <span style={{ color: 'var(--text-muted)' }}>{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Sales */}
                {searchResults.sales?.length > 0 && (
                  <div>
                    <div className="search-section-title">Sales (Invoices)</div>
                    {searchResults.sales.map(s => (
                      <div key={s.id} className="search-result-item" onClick={() => handleSearchResultClick('sales', s.id)}>
                        <span>{s.invoice_number}</span>
                        <span style={{ color: s.payment_status === 'Paid' ? 'var(--success)' : 'var(--danger)' }}>
                          {s.payment_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {Object.values(searchResults).every(arr => arr.length === 0) && (
                  <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No results found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic page container */}
        <div style={{ flex: 1 }}>
          {renderView()}
        </div>
      </div>
    </div>
  );
}

export default App;
