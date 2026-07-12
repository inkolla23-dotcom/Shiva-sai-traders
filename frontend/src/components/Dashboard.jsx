import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert,
  Clock
} from 'lucide-react';
import { API_BASE } from '../App';

function Dashboard({ token, showToast, setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>
        Loading Dashboard Data...
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: <Package size={22} style={{ color: 'var(--primary)' }} />,
      bg: 'var(--primary-light)',
      tab: 'products'
    },
    {
      title: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: <Users size={22} style={{ color: 'var(--success)' }} />,
      bg: 'var(--success-light)',
      tab: 'customers'
    },
    {
      title: 'Total Sales Invoices',
      value: stats?.totalSales || 0,
      icon: <ShoppingCart size={22} style={{ color: 'var(--warning)' }} />,
      bg: 'var(--warning-light)',
      tab: 'sales'
    },
    {
      title: 'Outstanding Balance',
      value: `₹${(stats?.outstandingPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: <DollarSign size={22} style={{ color: 'var(--danger)' }} />,
      bg: 'var(--danger-light)',
      tab: 'outstanding'
    },
    {
      title: 'Low Stock Products',
      value: stats?.lowStockCount || 0,
      icon: <AlertTriangle size={22} style={{ color: '#ea580c' }} />,
      bg: 'rgba(234, 88, 12, 0.1)',
      tab: 'products'
    },
    {
      title: 'Expiring Products (30 Days)',
      value: stats?.expiringCount || 0,
      icon: <ShieldAlert size={22} style={{ color: '#db2777' }} />,
      bg: 'rgba(219, 39, 119, 0.1)',
      tab: 'expiry'
    },
    {
      title: 'Inventory Value',
      value: `₹${(stats?.inventoryValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: <TrendingUp size={22} style={{ color: '#0d9488' }} />,
      bg: 'rgba(13, 148, 136, 0.1)',
      tab: 'products'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div className="header-toolbar">
        <h2 className="page-title">Shiva Sai Traders Hub</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          Real-time Inventory Monitor
        </div>
      </div>

      {/* Grid Stats */}
      <div className="dashboard-grid">
        {cards.map((c, i) => (
          <div key={i} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab(c.tab)}>
            <div className="stat-header">
              <span className="stat-title">{c.title}</span>
              <div className="stat-icon" style={{ backgroundColor: c.bg }}>
                {c.icon}
              </div>
            </div>
            <div className="stat-value">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Activities Panel */}
      <div className="panel" style={{ flex: 1 }}>
        <div className="panel-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} /> Recent System Activities
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveTab('settings')}>
            View Logs
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Old State</th>
                <th>New State</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                stats.recentActivities.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td><b>{log.user}</b></td>
                    <td>
                      <span className="badge badge-success" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {log.module}
                      </span>
                    </td>
                    <td>{log.action}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.old_value || '-'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.new_value || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No recent activities recorded.
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

export default Dashboard;
