import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('purchase');
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [dashboardSuggestions, setDashboardSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dashboardSelectedCustomer, setDashboardSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDashboardSuggestions, setShowDashboardSuggestions] = useState(false);
  const [theme, setTheme] = useState('morning');

  // Load all customers on mount
  useEffect(() => {
    loadCustomers();
    loadAllPurchases();
  }, []);

  // Load saved customer from localStorage for Purchase tab
  useEffect(() => {
    const savedCustomerId = localStorage.getItem('selectedCustomerId');
    const savedCustomerData = localStorage.getItem('selectedCustomerData');
    
    if (savedCustomerId && savedCustomerData) {
      try {
        const customer = JSON.parse(savedCustomerData);
        setSelectedCustomer(customer);
        setSearchTerm(customer.name);
      } catch (e) {
        console.error('Error loading saved customer:', e);
      }
    }
  }, []);

  // Load saved customer from localStorage for Dashboard tab
  useEffect(() => {
    const savedDashboardCustomerId = localStorage.getItem('dashboardSelectedCustomerId');
    const savedDashboardCustomerData = localStorage.getItem('dashboardSelectedCustomerData');
    
    if (savedDashboardCustomerId && savedDashboardCustomerData) {
      try {
        const customer = JSON.parse(savedDashboardCustomerData);
        setDashboardSelectedCustomer(customer);
        setDashboardSearchTerm(customer.name);
      } catch (e) {
        console.error('Error loading saved dashboard customer:', e);
      }
    }
  }, []);

  // Load purchases when selected customer changes (Purchase tab)
  useEffect(() => {
    if (selectedCustomer) {
      loadPurchases(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  // Load purchases when dashboard selected customer changes
  useEffect(() => {
    if (dashboardSelectedCustomer) {
      loadDashboardPurchases(dashboardSelectedCustomer.id);
    }
  }, [dashboardSelectedCustomer]);

  // Apply theme based on time of day
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 8) {
        setTheme('dawn');
      } else if (hour >= 8 && hour < 17) {
        setTheme('morning');
      } else if (hour >= 17 && hour < 19) {
        setTheme('sunset');
      } else {
        setTheme('night');
      }
    };
    
    updateTheme();
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
  }, []);

  // Apply theme class to body
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllPurchases = async () => {
    try {
      const purchasesRef = collection(db, 'purchases');
      const snapshot = await getDocs(purchasesRef);
      const allData = snapshot.docs.map(doc => {
        const data = doc.data();
        let productData = [];
        try {
          productData = typeof data.product_data === 'string' 
            ? JSON.parse(data.product_data) 
            : (data.product_data || []);
        } catch (e) {
          productData = [];
        }
        return {
          id: doc.id,
          ...data,
          product_data: productData
        };
      });
      setAllPurchases(allData);
    } catch (error) {
      console.error('Error loading all purchases:', error);
    }
  };

  const loadPurchases = useCallback(async (customerId) => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const customerPurchases = allPurchases.filter(
        purchase => purchase.customer_id === customerId
      );
      
      setPurchases(customerPurchases.sort((a, b) => 
        new Date(b.purchase_date) - new Date(a.purchase_date)
      ));
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  }, [allPurchases]);

  const loadDashboardPurchases = useCallback(async (customerId) => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const customerPurchases = allPurchases.filter(
        purchase => purchase.customer_id === customerId
      );
      
      // Store in a separate state or reuse purchases state
      // For now, we'll reuse the same purchases state
      setPurchases(customerPurchases.sort((a, b) => 
        new Date(b.purchase_date) - new Date(a.purchase_date)
      ));
    } catch (error) {
      console.error('Error loading dashboard purchases:', error);
    } finally {
      setLoading(false);
    }
  }, [allPurchases]);

  // Handle search for Purchase tab
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 10));
    setShowSuggestions(true);
  };

  // Handle search for Dashboard tab
  const handleDashboardSearchChange = (e) => {
    const value = e.target.value;
    setDashboardSearchTerm(value);
    
    if (value.trim() === '') {
      setDashboardSuggestions([]);
      setShowDashboardSuggestions(false);
      return;
    }
    
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(value.toLowerCase())
    );
    setDashboardSuggestions(filtered.slice(0, 10));
    setShowDashboardSuggestions(true);
  };

  // Handle select customer for Purchase tab
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.setItem('selectedCustomerId', customer.id);
    localStorage.setItem('selectedCustomerData', JSON.stringify(customer));
  };

  // Handle select customer for Dashboard tab
  const handleDashboardSelectCustomer = (customer) => {
    setDashboardSelectedCustomer(customer);
    setDashboardSearchTerm(customer.name);
    setDashboardSuggestions([]);
    setShowDashboardSuggestions(false);
    localStorage.setItem('dashboardSelectedCustomerId', customer.id);
    localStorage.setItem('dashboardSelectedCustomerData', JSON.stringify(customer));
  };

  // Handle clear customer for Purchase tab
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setPurchases([]);
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.removeItem('selectedCustomerId');
    localStorage.removeItem('selectedCustomerData');
  };

  // Handle clear customer for Dashboard tab
  const handleDashboardClearCustomer = () => {
    setDashboardSelectedCustomer(null);
    setDashboardSearchTerm('');
    setPurchases([]);
    setDashboardSuggestions([]);
    setShowDashboardSuggestions(false);
    localStorage.removeItem('dashboardSelectedCustomerId');
    localStorage.removeItem('dashboardSelectedCustomerData');
  };

  const getTotalSpent = () => {
    return purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPendingTotal = () => {
    return purchases
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPaidTotal = () => {
    return purchases
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPendingCount = () => {
    return purchases.filter(p => p.status !== 'paid').length;
  };

  // Dashboard statistics for selected customer
  const getDashboardTotalSpent = () => {
    if (!dashboardSelectedCustomer) return 0;
    const customerPurchases = allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id);
    return customerPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getDashboardPendingTotal = () => {
    if (!dashboardSelectedCustomer) return 0;
    const customerPurchases = allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id);
    return customerPurchases
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getDashboardPaidTotal = () => {
    if (!dashboardSelectedCustomer) return 0;
    const customerPurchases = allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id);
    return customerPurchases
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getDashboardOrderCount = () => {
    if (!dashboardSelectedCustomer) return 0;
    return allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id).length;
  };

  const getDashboardCustomerPurchases = () => {
    if (!dashboardSelectedCustomer) return [];
    return allPurchases
      .filter(p => p.customer_id === dashboardSelectedCustomer.id)
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
  };

  // Overall statistics
  const getTotalCustomers = () => customers.length;
  const getTotalSales = () => allPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const getTotalPending = () => allPurchases.filter(p => p.status !== 'paid').reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const getTotalOrders = () => allPurchases.length;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getThemeName = () => {
    switch(theme) {
      case 'dawn': return 'Sunrise';
      case 'morning': return 'Morning';
      case 'sunset': return 'Sunset';
      case 'night': return 'Night';
      default: return 'Morning';
    }
  };

  // Get recent transactions (last 10)
  const getRecentTransactions = () => {
    return [...allPurchases]
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      .slice(0, 10);
  };

  return (
    <div className="app">
      <div className="glass-container">
        <header className="header">
          <h1>Purchase History</h1>
          <div className="theme-indicator">
            <span className={`theme-dot theme-${theme}`}></span>
            <span>{getThemeName()}</span>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchase')}
          >
            My Purchase
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* My Purchase Tab */}
        {activeTab === 'purchase' && (
          <div className="tab-content">
            <div className="search-section">
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="E search imong ngalan ex: doc2, jr, paul..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchTerm && searchTerm.trim()) {
                      setSuggestions(
                        customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
                      );
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map(customer => (
                      <div
                        key={customer.id}
                        className="suggestion-item"
                        onMouseDown={() => handleSelectCustomer(customer)}
                      >
                        <span className="suggestion-name">{customer.name}</span>
                        {customer.phone && <span className="suggestion-phone">{customer.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedCustomer && (
                <button className="clear-btn" onClick={handleClearCustomer}>
                  Change Customer
                </button>
              )}
            </div>

            {selectedCustomer && (
              <>
                <div className="customer-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Customer</label>
                      <h2>{selectedCustomer.name}</h2>
                      {selectedCustomer.phone && <p>Phone: {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p>Email: {selectedCustomer.email}</p>}
                    </div>
                    <div className="info-item">
                      <label>Total Spent</label>
                      <h2 className="total-amount">₱{getTotalSpent().toFixed(2)}</h2>
                    </div>
                    <div className="info-item">
                      <label>Pending Payments</label>
                      <h2 className="pending-amount">₱{getPendingTotal().toFixed(2)}</h2>
                      <p>{getPendingCount()} order(s)</p>
                    </div>
                    <div className="info-item">
                      <label>Paid Amount</label>
                      <h2>₱{getPaidTotal().toFixed(2)}</h2>
                      <p>{purchases.filter(p => p.status === 'paid').length} paid orders</p>
                    </div>
                  </div>
                </div>

                <div className="purchases-section">
                  <h3>Purchase History ({purchases.length} orders)</h3>
                  {loading ? (
                    <div className="loading">Loading purchases...</div>
                  ) : purchases.length === 0 ? (
                    <div className="empty-state">No purchases found for this customer</div>
                  ) : (
                    <div className="purchases-list">
                      {purchases.map(purchase => (
                        <div key={purchase.id} className="purchase-card">
                          <div className="purchase-header">
                            <span className="purchase-date">{formatDate(purchase.purchase_date)}</span>
                            <span className={`status-badge ${purchase.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                              {purchase.status || 'pending'}
                            </span>
                          </div>
                          <div className="purchase-amount">
                            <span>Total Amount</span>
                            <strong>₱{purchase.total_amount?.toFixed(2) || '0.00'}</strong>
                          </div>
                          {purchase.product_data && purchase.product_data.length > 0 && (
                            <div className="purchase-items">
                              <label>Items Purchased</label>
                              <div className="items-list">
                                {purchase.product_data.map((item, idx) => (
                                  <div key={idx} className="item">
                                    <span>{item.name}</span>
                                    <span>{item.quantity} x ₱{item.price?.toFixed(2)}</span>
                                    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedCustomer && !loading && (
              <div className="welcome-state">
                <div className="welcome-icon">🔍</div>
                <h3>Search for a Customer</h3>
                <p>Enter a customer name above to view their purchase history</p>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab - Customer Specific */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            {/* Customer Search Section */}
            <div className="search-section">
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search customer to view dashboard..."
                  value={dashboardSearchTerm}
                  onChange={handleDashboardSearchChange}
                  onFocus={() => {
                    if (dashboardSearchTerm && dashboardSearchTerm.trim()) {
                      setDashboardSuggestions(
                        customers.filter(c => c.name.toLowerCase().includes(dashboardSearchTerm.toLowerCase())).slice(0, 10)
                      );
                      setShowDashboardSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowDashboardSuggestions(false), 200);
                  }}
                />
                {showDashboardSuggestions && dashboardSuggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {dashboardSuggestions.map(customer => (
                      <div
                        key={customer.id}
                        className="suggestion-item"
                        onMouseDown={() => handleDashboardSelectCustomer(customer)}
                      >
                        <span className="suggestion-name">{customer.name}</span>
                        {customer.phone && <span className="suggestion-phone">{customer.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {dashboardSelectedCustomer && (
                <button className="clear-btn" onClick={handleDashboardClearCustomer}>
                  Change Customer
                </button>
              )}
            </div>

            {/* Customer Dashboard View */}
            {dashboardSelectedCustomer ? (
              <>
                {/* Customer Information Card */}
                <div className="customer-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Customer Details</label>
                      <h2>{dashboardSelectedCustomer.name}</h2>
                      {dashboardSelectedCustomer.phone && <p>📞 {dashboardSelectedCustomer.phone}</p>}
                      {dashboardSelectedCustomer.email && <p>✉️ {dashboardSelectedCustomer.email}</p>}
                      <p>🆔 Customer ID: {dashboardSelectedCustomer.id.slice(0, 8)}...</p>
                    </div>
                    <div className="info-item">
                      <label>Total Spent</label>
                      <h2 className="total-amount">₱{getDashboardTotalSpent().toFixed(2)}</h2>
                    </div>
                    <div className="info-item">
                      <label>Pending Balance</label>
                      <h2 className="pending-amount">₱{getDashboardPendingTotal().toFixed(2)}</h2>
                      <p>{allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id && p.status !== 'paid').length} pending order(s)</p>
                    </div>
                    <div className="info-item">
                      <label>Paid Amount</label>
                      <h2>₱{getDashboardPaidTotal().toFixed(2)}</h2>
                      <p>{allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id && p.status === 'paid').length} paid orders</p>
                    </div>
                  </div>
                </div>

                {/* Statistics Summary */}
                <div className="dashboard-stats">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">📋</div>
                      <div className="stat-info">
                        <label>Total Orders</label>
                        <h2>{getDashboardOrderCount()}</h2>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">✅</div>
                      <div className="stat-info">
                        <label>Completed Orders</label>
                        <h2>{allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id && p.status === 'paid').length}</h2>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⏳</div>
                      <div className="stat-info">
                        <label>Pending Orders</label>
                        <h2 className="pending-amount">{allPurchases.filter(p => p.customer_id === dashboardSelectedCustomer.id && p.status !== 'paid').length}</h2>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⭐</div>
                      <div className="stat-info">
                        <label>Average Order</label>
                        <h2>₱{(getDashboardTotalSpent() / (getDashboardOrderCount() || 1)).toFixed(2)}</h2>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchase History List */}
                <div className="purchases-section">
                  <h3>Purchase History ({getDashboardOrderCount()} orders)</h3>
                  {loading ? (
                    <div className="loading">Loading purchases...</div>
                  ) : getDashboardCustomerPurchases().length === 0 ? (
                    <div className="empty-state">No purchases found for this customer</div>
                  ) : (
                    <div className="purchases-list">
                      {getDashboardCustomerPurchases().map(purchase => (
                        <div key={purchase.id} className="purchase-card">
                          <div className="purchase-header">
                            <span className="purchase-date">{formatDate(purchase.purchase_date)}</span>
                            <span className={`status-badge ${purchase.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                              {purchase.status || 'pending'}
                            </span>
                          </div>
                          <div className="purchase-amount">
                            <span>Total Amount</span>
                            <strong>₱{purchase.total_amount?.toFixed(2) || '0.00'}</strong>
                          </div>
                          {purchase.product_data && purchase.product_data.length > 0 && (
                            <div className="purchase-items">
                              <label>Items Purchased</label>
                              <div className="items-list">
                                {purchase.product_data.map((item, idx) => (
                                  <div key={idx} className="item">
                                    <span>{item.name}</span>
                                    <span>{item.quantity} x ₱{item.price?.toFixed(2)}</span>
                                    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="welcome-state">
                <div className="welcome-icon">📊</div>
                <h3>Select a Customer to View Dashboard</h3>
                <p>Search and select a customer above to see their detailed purchase information, statistics, and order history</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <div className="settings-section">
              <div className="settings-card">
                <h3>About</h3>
                <p><strong>Purchase History Viewer</strong> v1.0.0</p>
                <p>View customer purchase history from Firebase Firestore</p>
                <hr />
                <h4>System Info</h4>
                <p>Firebase Status: Connected</p>
                <p>Database: Firestore</p>
                <p>Customers: {getTotalCustomers()}</p>
                <p>Total Orders: {getTotalOrders()}</p>
                <hr />
                <h4>Theme</h4>
                <p>Current theme: {getThemeName()}</p>
                <p>Themes change automatically based on time of day:</p>
                <ul>
                  <li>🌅 Sunrise (5am - 8am)</li>
                  <li>☀️ Morning (8am - 5pm)</li>
                  <li>🌇 Sunset (5pm - 7pm)</li>
                  <li>🌙 Night (7pm - 5am)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
