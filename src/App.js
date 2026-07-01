/* App.js - Updated with Dark Mode Toggle */
import MaintenanceOverride from './MaintenanceOverride';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import InstallPrompt from './InstallPrompt';
import Loader from './Loader';
import './App.css';

// ─── Password / verified-accounts localStorage helpers ─────────────────────
// Stores every customer that has successfully unlocked purchases before, so
// switching back to them later doesn't ask for the password again — unless
// the password stored in Firestore no longer matches what's cached here.
const VERIFIED_ACCOUNTS_KEY = 'verifiedAccounts';

function getVerifiedAccounts() {
  try {
    const raw = localStorage.getItem(VERIFIED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVerifiedAccount(customer) {
  const accounts = getVerifiedAccounts();
  accounts[customer.id] = {
    id: customer.id,
    name: customer.name,
    pass: String(customer.userPass ?? ''),
  };
  localStorage.setItem(VERIFIED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function isAccountVerified(customer) {
  if (!customer) return false;
  const accounts = getVerifiedAccounts();
  const entry = accounts[customer.id];
  if (!entry) return false;
  return String(entry.pass) === String(customer.userPass ?? '');
}

// ─── 5-digit password box input ─────────────────────────────────────────────
function DigitBoxes({ digits, onChange, disabled, autoFocusFirst, error }) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocusFirst && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocusFirst]);

  const handleChange = (i, val) => {
    const v = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    onChange(next);
    if (v && i < digits.length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <div className={`digit-box-row${error ? ' digit-box-row--error' : ''}`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          className="digit-box"
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}

// ─── Weather helpers ───────────────────────────────────────────────────────
const LAT = 9.8978;
const LON = 123.8494;
const LOCATION_NAME = 'San Isidro, Calape, Bohol';

const WMO_CODES = {
  0: { label: 'Clear Sky', icon: '☀️' },
  1: { label: 'Mainly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Icy Fog', icon: '🌫️' },
  51: { label: 'Light Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy Drizzle', icon: '🌧️' },
  61: { label: 'Light Rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '🌧️' },
  71: { label: 'Light Snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Heavy Snow', icon: '❄️' },
  80: { label: 'Rain Showers', icon: '🌦️' },
  81: { label: 'Showers', icon: '🌧️' },
  82: { label: 'Heavy Showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { label: 'Thunderstorm + Heavy Hail', icon: '⛈️' },
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' };
}

// ─── Dark Mode Loader — Rotating glow orb ───────────────────────────────────
function DarkLoader() {
  return (
    <div className="dm-loader-wrap">
      <div className="dm-loader">
        <span />
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [customers, setCustomers] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState('morning');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  // Password-gate state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordDigits, setPasswordDigits] = useState(['', '', '', '', '']);
  const [passwordError, setPasswordError] = useState('');

  // Change-password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassDigits, setNewPassDigits] = useState(['', '', '', '', '']);
  const [confirmPassDigits, setConfirmPassDigits] = useState(['', '', '', '', '']);
  const [changePassError, setChangePassError] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Weather state
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [forecast, setForecast] = useState([]);

  // ── Dark mode persistence & body class ──────────────────────────────────
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.body.classList.add('theme-darkmode');
    } else {
      document.body.classList.remove('theme-darkmode');
    }
  }, [darkMode]);

  // ── Theme based on time ──────────────────────────────────────────────────
  useEffect(() => {
    const updateTheme = () => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      const hourDecimal = h + m / 60;
      if (hourDecimal >= 4.0 && hourDecimal < 6.0) setTheme('dawn');
      else if (hourDecimal >= 6.0 && hourDecimal < 8.0) setTheme('sunrise');
      else if (hourDecimal >= 8.0 && hourDecimal < 11.0) setTheme('morning');
      else if (hourDecimal >= 11.0 && hourDecimal < 15.0) setTheme('noon');
      else if (hourDecimal >= 15.0 && hourDecimal < 17.0) setTheme('golden');
      else if (hourDecimal >= 17.0 && hourDecimal < 18.5) setTheme('sunset');
      else if (hourDecimal >= 18.5 && hourDecimal < 20.0) setTheme('dusk');
      else setTheme('night');
    };
    updateTheme();
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!darkMode) {
      document.body.className = `theme-${theme}`;
    } else {
      document.body.className = 'theme-darkmode';
    }
  }, [theme, darkMode]);

  // ── Persist active tab ───────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // ── Load Firebase data ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadCustomers(), loadAllPurchases()]).then(() => {
      setLoading(false);
    });
  }, []);

 // ── Wake up services silently on visit ─────────────────────────────
useEffect(() => {
  const services = [
    'https://debtposinterprise-database-backup.onrender.com/',
    'https://marniestore-messengerbot.onrender.com/'
  ];

  services.forEach(url => {
    fetch(url, { mode: 'no-cors' })
      .catch(() => {
        // Ignore failures — this is just a wake-up ping
      });
  });
}, []);
  // ── Restore selected customer ────────────────────────────────────────────
  useEffect(() => {
    if (customers.length === 0 || allPurchases.length === 0) return;
    const saved = localStorage.getItem('selectedCustomerData');
    if (saved) {
      try {
        const savedCustomer = JSON.parse(saved);
        // Prefer the freshest copy from Firestore (in case userPass changed)
        const fresh = customers.find(c => c.id === savedCustomer.id) || savedCustomer;
        setSelectedCustomer(fresh);
        setSearchTerm(fresh.name);
        setIsUnlocked(isAccountVerified(fresh));
      } catch (e) {}
    }
  }, [customers, allPurchases]);

  const loadCustomers = async () => {
    try {
      const snap = await getDocs(collection(db, 'customers'));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const loadAllPurchases = async () => {
    try {
      const snap = await getDocs(collection(db, 'purchases'));
      const data = snap.docs.map(d => {
        const raw = d.data();
        let product_data = [];
        try {
          product_data = typeof raw.product_data === 'string'
            ? JSON.parse(raw.product_data)
            : (raw.product_data || []);
        } catch {}
        return { id: d.id, ...raw, product_data };
      });
      setAllPurchases(data);
    } catch (e) { console.error(e); }
  };

  // ── Weather fetch ────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
        `&timezone=Asia%2FManila&forecast_days=7`;
      const res = await fetch(url);
      const json = await res.json();
      setWeather(json.current);
      const days = json.daily.time.map((date, i) => ({
        date,
        code: json.daily.weather_code[i],
        max: json.daily.temperature_2m_max[i],
        min: json.daily.temperature_2m_min[i],
        rain: json.daily.precipitation_sum[i],
        wind: json.daily.wind_speed_10m_max[i],
      }));
      setForecast(days);
    } catch (e) {
      setWeatherError('Could not load weather data.');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'weather') fetchWeather();
  }, [activeTab, fetchWeather]);

  // ── Search handlers ──────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const v = e.target.value;
    setSearchTerm(v);
    if (!v.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestions(customers.filter(c => c.name.toLowerCase().includes(v.toLowerCase())).slice(0, 10));
    setShowSuggestions(true);
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.setItem('selectedCustomerData', JSON.stringify(customer));
    // Reset the gate, then check if this customer was already verified before
    setPasswordDigits(['', '', '', '', '']);
    setPasswordError('');
    setIsUnlocked(isAccountVerified(customer));
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.removeItem('selectedCustomerData');
    setIsUnlocked(false);
    setPasswordDigits(['', '', '', '', '']);
    setPasswordError('');
  };

  // ── Password gate: confirm / cancel ─────────────────────────────────────
  const handleConfirmPassword = () => {
    const entered = passwordDigits.join('');
    if (entered.length < 5) {
      setPasswordError('Please enter all 5 digits.');
      return;
    }
    if (String(selectedCustomer.userPass ?? '') === entered) {
      saveVerifiedAccount(selectedCustomer);
      setIsUnlocked(true);
      setPasswordError('');
      setPasswordDigits(['', '', '', '', '']);
    } else {
      setPasswordError("That password doesn't match. Please try again.");
      setPasswordDigits(['', '', '', '', '']);
    }
  };

  const handleCancelPassword = () => {
    handleClearCustomer();
  };

  // ── Change password modal ────────────────────────────────────────────────
  const openChangePassword = () => {
    setNewPassDigits(['', '', '', '', '']);
    setConfirmPassDigits(['', '', '', '', '']);
    setChangePassError('');
    setChangePassSuccess('');
    setShowChangePassword(true);
  };

  const closeChangePassword = () => {
    if (changingPassword) return;
    setShowChangePassword(false);
  };

  const handleChangePassword = async () => {
    const newPass = newPassDigits.join('');
    const confirmPass = confirmPassDigits.join('');

    if (newPass.length < 5 || confirmPass.length < 5) {
      setChangePassError('Please fill in all 5 digits in both fields.');
      return;
    }
    if (newPass !== confirmPass) {
      setChangePassError('Passwords do not match. Please retype to confirm.');
      setConfirmPassDigits(['', '', '', '', '']);
      return;
    }

    setChangingPassword(true);
    setChangePassError('');
    try {
      await updateDoc(doc(db, 'customers', selectedCustomer.id), { userPass: newPass });

      const updatedCustomer = { ...selectedCustomer, userPass: newPass };
      setSelectedCustomer(updatedCustomer);
      setCustomers(prev => prev.map(c => (c.id === updatedCustomer.id ? updatedCustomer : c)));
      localStorage.setItem('selectedCustomerData', JSON.stringify(updatedCustomer));
      saveVerifiedAccount(updatedCustomer);

      setChangePassSuccess('Password updated successfully!');
      setTimeout(() => {
        setShowChangePassword(false);
        setChangePassSuccess('');
      }, 1200);
    } catch (e) {
      console.error(e);
      setChangePassError('Failed to update password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Computed values ──────────────────────────────────────────────────────
  const customerPurchases = selectedCustomer
    ? allPurchases
        .filter(p => p.customer_id === selectedCustomer.id)
        .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
    : [];

  const totalSpent   = customerPurchases.reduce((s, p) => s + (p.total_amount || 0), 0);
  const paidTotal    = customerPurchases.filter(p => p.status === 'paid').reduce((s, p) => s + (p.total_amount || 0), 0);
  const pendingTotal = customerPurchases.filter(p => p.status !== 'paid').reduce((s, p) => s + (p.total_amount || 0), 0);
  const pendingCount = customerPurchases.filter(p => p.status !== 'paid').length;
  const paidCount    = customerPurchases.filter(p => p.status === 'paid').length;
  const avgOrder     = customerPurchases.length ? totalSpent / customerPurchases.length : 0;
  const totalCustomers = customers.length;

  const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateReceipt = (ds) => {
    if (!ds) return 'N/A';
    const d = new Date(ds);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) +
           ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDay = (ds) => {
    const d = new Date(ds);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getThemeName = () => {
    if (darkMode) return 'Dark Mode';
    const themes = {
      dawn: 'Dawn 🌅', sunrise: 'Sunrise ☀️', morning: 'Morning 🌤️',
      noon: 'Noon 🔆', golden: 'Golden Hour ✨', sunset: 'Sunset 🌇',
      dusk: 'Dusk 🌙', night: 'Night ⭐'
    };
    return themes[theme] || 'Morning';
  };

  // SVG Icons
  const NavIcons = {
    dashboard: () => (
      <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5v-7H9v7H4a2 2 0 0 1-2-2z"/>
        <path d="M9 22v-7h6v7"/>
      </svg>
    ),
    weather: () => (
      <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M6.34 17.66l-1.41 1.41M12 20v2M17.66 17.66l1.41 1.41M20 12h2M17.66 6.34l1.41-1.41"/>
        <circle cx="12" cy="12" r="4"/>
      </svg>
    ),
    settings: () => (
      <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H5.78a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82l.03.03A10 10 0 0 0 12 17.66a10 10 0 0 0 6.37-2.63z"/>
        <path d="M12 2v4M12 18v4"/>
      </svg>
    )
  };

  // Loading screen
  if (loading) {
    return (
      <div className="app">
        <div className="glass-container">
          <div className="loader-container">
            {darkMode ? <DarkLoader /> : <Loader size="medium" />}
            <p className="loader-text">Loading Marnie Store...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${darkMode ? ' app--dark' : ''}`}>
      <div className="glass-container">

        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <img src="/logo192.png" alt="Marnie Store" className="header-logo" />
            <div>
              <h1 className="header-title">Marnie Store</h1>
              <p className="header-sub">Purchase Viewer</p>
            </div>
          </div>
          <div className="theme-pill">
            {darkMode
              ? <span className="theme-dot theme-darkmode-dot"></span>
              : <span className={`theme-dot theme-${theme}`}></span>
            }
            <span>{getThemeName()}</span>
          </div>
        </header>

        {/* TAB CONTENT */}
        <div className="tab-content">

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <div className="page">
              <section className="section">
                <h2 className="section-title">Customer Lookup</h2>
                <div className="search-row">
                  <div className="search-wrap">
                    <span className="search-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </span>
                    <input
                      className="search-input"
                      type="text"
                      placeholder="Search by customer name…"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onFocus={() => {
                        if (searchTerm.trim()) {
                          setSuggestions(customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0,10));
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {selectedCustomer && (
                      <button className="clear-x" onClick={handleClearCustomer} title="Clear">✕</button>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="dropdown">
                        {suggestions.map(c => (
                          <div key={c.id} className="dropdown-item" onMouseDown={() => handleSelectCustomer(c)}>
                            <span className="dropdown-name">{c.name}</span>
                            {c.phone && <span className="dropdown-phone">{c.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {selectedCustomer && !isUnlocked ? (
                <section className="section">
                  <div className="password-gate">
                    <div className="password-gate-icon">🔒</div>
                    <h3 className="password-gate-title">
                      Enter first your 5 Digit Password Number for <span>{selectedCustomer.name}</span> to view purchases
                    </h3>
                    <DigitBoxes
                      digits={passwordDigits}
                      onChange={setPasswordDigits}
                      autoFocusFirst={true}
                      error={!!passwordError}
                    />
                    {passwordError && <p className="password-error">{passwordError}</p>}
                    <div className="password-gate-actions">
                      <button className="btn-cancel" onClick={handleCancelPassword}>Cancel</button>
                      <button className="btn-confirm" onClick={handleConfirmPassword}>Confirm</button>
                    </div>
                    <p className="password-gate-notice">
                      If you don't know your password yet, please go to the store and ask for your password. (Pangayua sa tindahan imong 5 digit password.)
                    </p>
                  </div>
                </section>
              ) : selectedCustomer && isUnlocked ? (
                <>
                  <section className="section">
                    <div className="customer-banner">
                      <div className="customer-avatar">{selectedCustomer.name.charAt(0).toUpperCase()}</div>
                      <div className="customer-meta">
                        <h3 className="customer-name">{selectedCustomer.name}</h3>
                        <button className="change-password-btn" onClick={openChangePassword}>
                          🔑 Change Password
                        </button>
                        {selectedCustomer.phone && <p className="customer-detail">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4,verticalAlign:'middle'}}>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.72 16.92z"/>
                          </svg>
                          {selectedCustomer.phone}
                        </p>}
                        {selectedCustomer.email && <p className="customer-detail">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4,verticalAlign:'middle'}}>
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {selectedCustomer.email}
                        </p>}
                        <p className="customer-detail customer-id">ID: {selectedCustomer.id.slice(0,12)}…</p>
                      </div>
                    </div>

                    <div className="metrics-grid">
                      <div className="metric-card metric-card--blue">
                        <div className="metric-label">Total Spent</div>
                        <div className="metric-value">₱{totalSpent.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{customerPurchases.length} orders</div>
                      </div>
                      <div className="metric-card metric-card--green">
                        <div className="metric-label">Paid</div>
                        <div className="metric-value">₱{paidTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{paidCount} orders</div>
                      </div>
                      <div className="metric-card metric-card--amber">
                        <div className="metric-label">Pending</div>
                        <div className="metric-value">₱{pendingTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{pendingCount} orders</div>
                      </div>
                      <div className="metric-card metric-card--purple">
                        <div className="metric-label">Avg. Order</div>
                        <div className="metric-value">₱{avgOrder.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">per transaction</div>
                      </div>
                    </div>
                  </section>

                  <section className="section">
                    <h2 className="section-title">Purchase History <span className="count-pill">{customerPurchases.length}</span></h2>
                    {customerPurchases.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                          </svg>
                        </div>
                        <p>No purchases found for this customer.</p>
                      </div>
                    ) : (
                      <div className="purchase-list">
                        {customerPurchases.map(purchase => (
                          <div key={purchase.id} className="receipt-card">
                            <div className="receipt-header">
                              <div className="receipt-store">
                                <span className="receipt-store-name">MARNIE STORE</span>
                                <span className="receipt-store-id">INV-{purchase.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                              <div className="receipt-date">
                                <div className="receipt-date-label">DATE</div>
                                <div className="receipt-date-value">{formatDateReceipt(purchase.purchase_date)}</div>
                              </div>
                            </div>

                            <div className="receipt-body">
                              <div className="receipt-items-header">
                                <span>ITEM</span>
                                <span className="receipt-item-qty">QTY</span>
                                <span className="receipt-item-price">PRICE</span>
                              </div>
                              {purchase.product_data?.map((item, idx) => (
                                <div key={idx} className="receipt-item">
                                  <span className="receipt-item-name">{item.name}</span>
                                  <span className="receipt-item-qty">{item.quantity}</span>
                                  <span className="receipt-item-price">₱{(item.price || 0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                                </div>
                              ))}
                              <div className="receipt-divider"></div>
                              <div className="receipt-total-row">
                                <span className="receipt-total-label">TOTAL AMOUNT</span>
                                <span className="receipt-total-amount">₱{(purchase.total_amount || 0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                              </div>
                              <div className="receipt-status-row">
                                <span className="receipt-status-label">PAYMENT STATUS</span>
                                <span className={`badge-receipt ${purchase.status === 'paid' ? 'badge-receipt--paid' : 'badge-receipt--pending'}`}>
                                  {purchase.status === 'paid' ? '✓ PAID' : '⏳ PENDING'}
                                </span>
                              </div>
                            </div>

                            <div className="receipt-footer">
                              <span className="receipt-thankyou">Thank you for your purchase!</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="welcome-state">
                  <div className="welcome-icon">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                  <h3>Search a Customer</h3>
                  <p>Enter a name above to view their purchase history and stats.</p>
                </div>
              )}

              {showChangePassword && (
                <div className="modal-overlay" onClick={closeChangePassword}>
                  <div className="modal-card" onClick={e => e.stopPropagation()}>
                    <h3 className="modal-title">Change Password</h3>
                    <p className="modal-sub">Set a new 5-digit password for {selectedCustomer?.name}</p>

                    <label className="modal-label">New Password</label>
                    <DigitBoxes
                      digits={newPassDigits}
                      onChange={setNewPassDigits}
                      disabled={changingPassword}
                      autoFocusFirst={true}
                    />

                    <label className="modal-label">Confirm Password</label>
                    <DigitBoxes
                      digits={confirmPassDigits}
                      onChange={setConfirmPassDigits}
                      disabled={changingPassword}
                      error={!!changePassError}
                    />

                    {changePassError && <p className="password-error">{changePassError}</p>}
                    {changePassSuccess && <p className="password-success">{changePassSuccess}</p>}

                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={closeChangePassword} disabled={changingPassword}>
                        Cancel
                      </button>
                      <button className="btn-confirm" onClick={handleChangePassword} disabled={changingPassword}>
                        {changingPassword ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── WEATHER TAB ── */}
          {activeTab === 'weather' && (
            <div className="page">
              <div className="weather-location-bar">
                <span className="weather-pin">📍</span>
                <span className="weather-location-name">{LOCATION_NAME}</span>
                <button className="weather-refresh-btn" onClick={fetchWeather} title="Refresh">🔄</button>
              </div>

              {weatherLoading ? (
                <div className="loader-container">
                  {darkMode ? <DarkLoader /> : <Loader size="medium" />}
                  <p className="loader-text">Fetching weather data...</p>
                </div>
              ) : weatherError ? (
                <div className="weather-error">
                  <span>⚠️ {weatherError}</span>
                  <button onClick={fetchWeather}>Retry</button>
                </div>
              ) : weather ? (
                <>
                  <div className="weather-hero">
                    <div className="weather-hero-icon">{getWeatherInfo(weather.weather_code).icon}</div>
                    <div className="weather-hero-temp">{Math.round(weather.temperature_2m)}°C</div>
                    <div className="weather-hero-condition">{getWeatherInfo(weather.weather_code).label}</div>
                    <div className="weather-hero-feel">Feels like {Math.round(weather.apparent_temperature)}°C</div>
                  </div>

                  <div className="weather-stats-grid">
                    <div className="weather-stat">
                      <div className="weather-stat-icon">💧</div>
                      <div className="weather-stat-val">{weather.relative_humidity_2m}%</div>
                      <div className="weather-stat-lbl">Humidity</div>
                    </div>
                    <div className="weather-stat">
                      <div className="weather-stat-icon">🌬️</div>
                      <div className="weather-stat-val">{Math.round(weather.wind_speed_10m)} km/h</div>
                      <div className="weather-stat-lbl">Wind</div>
                    </div>
                    <div className="weather-stat">
                      <div className="weather-stat-icon">🌧️</div>
                      <div className="weather-stat-val">{weather.precipitation} mm</div>
                      <div className="weather-stat-lbl">Precip.</div>
                    </div>
                  </div>

                  <section className="section">
                    <h2 className="section-title">7-Day Forecast</h2>
                    <div className="forecast-list">
                      {forecast.map((day, i) => (
                        <div key={i} className={`forecast-row ${i === 0 ? 'forecast-row--today' : ''}`}>
                          <span className="forecast-day">{formatDay(day.date)}</span>
                          <span className="forecast-icon">{getWeatherInfo(day.code).icon}</span>
                          <span className="forecast-condition">{getWeatherInfo(day.code).label}</span>
                          <div className="forecast-temps">
                            <span className="forecast-max">{Math.round(day.max)}°</span>
                            <span className="forecast-min">{Math.round(day.min)}°</span>
                          </div>
                          {day.rain > 0 && <span className="forecast-rain">💧{day.rain}mm</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && (
            <div className="page">

              {/* Dark Mode Toggle */}
              <section className="section">
                <h2 className="section-title">Display</h2>
                <div className="settings-card">
                  <div className="settings-row settings-row--toggle">
                    <div className="settings-toggle-info">
                      <div className="settings-toggle-label">
                        {darkMode ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8,verticalAlign:'middle'}}>
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8,verticalAlign:'middle'}}>
                            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                          </svg>
                        )}
                        {darkMode ? 'Dark Mode' : 'Normal Mode'}
                      </div>
                      <div className="settings-toggle-desc">{darkMode ? 'Nocturne liquid glassmorphism' : 'Time-based scenic themes'}</div>
                    </div>
                    <button
                      className={`dm-toggle ${darkMode ? 'dm-toggle--on' : ''}`}
                      onClick={() => setDarkMode(p => !p)}
                      aria-label="Toggle dark mode"
                    >
                      <span className="dm-toggle-thumb" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">About</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <span className="settings-key">App</span>
                    <span className="settings-val">Marnie Store v1.0.0</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-key">Database</span>
                    <span className="settings-val">Firebase Firestore</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-key">Total Customers</span>
                    <span className="settings-val">{totalCustomers}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-key">Total Orders</span>
                    <span className="settings-val">{allPurchases.length}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-key">Weather Source</span>
                    <span className="settings-val">Open-Meteo (no key)</span>
                  </div>
                </div>
              </section>

              {!darkMode && (
                <section className="section">
                  <h2 className="section-title">Theme Schedule</h2>
                  <div className="settings-card">
                    {[
                     { icon: '🌅', name: 'Dawn', time: '4:00 – 6:00 AM', key: 'dawn' },
{ icon: '☀️', name: 'Sunrise', time: '6:00 – 8:00 AM', key: 'sunrise' },
{ icon: '🌤️', name: 'Morning', time: '8:00 – 11:00 AM', key: 'morning' },
{ icon: '🔆', name: 'Noon', time: '11:00 AM – 3:00 PM', key: 'noon' },
{ icon: '✨', name: 'Golden Hour', time: '3:00 – 5:00 PM', key: 'golden' },
{ icon: '🌇', name: 'Sunset', time: '5:00 – 6:30 PM', key: 'sunset' },
{ icon: '🌙', name: 'Dusk', time: '6:30 – 8:00 PM', key: 'dusk' },
{ icon: '⭐', name: 'Night', time: '8:00 PM – 4:00 AM', key: 'night' },
                    ].map(t => (
                      <div key={t.key} className={`settings-row ${theme === t.key ? 'settings-row--active' : ''}`}>
                        <span className="settings-key">{t.icon} {t.name}</span>
                        <span className="settings-val">{t.time}{theme === t.key ? ' ✓' : ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {[
            { key: 'dashboard', icon: NavIcons.dashboard, label: 'Dashboard' },
            { key: 'weather',   icon: NavIcons.weather, label: 'Weather' },
            { key: 'settings',  icon: NavIcons.settings, label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`nav-btn ${activeTab === tab.key ? 'nav-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon()}
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <InstallPrompt />
            <MaintenanceOverride />
    </div>
  );
}

export default App;
