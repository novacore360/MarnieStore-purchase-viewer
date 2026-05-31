import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import InstallPrompt from './InstallPrompt';
import './App.css';

const LAT = 9.8978;
const LON = 123.8494;
const LOCATION_NAME = 'San Isidro, Calape, Bohol';

const WMO_CODES = {
  0:  { label: 'Clear Sky',            icon: '☀️' },
  1:  { label: 'Mainly Clear',         icon: '🌤️' },
  2:  { label: 'Partly Cloudy',        icon: '⛅' },
  3:  { label: 'Overcast',             icon: '☁️' },
  45: { label: 'Foggy',               icon: '🌫️' },
  48: { label: 'Icy Fog',             icon: '🌫️' },
  51: { label: 'Light Drizzle',       icon: '🌦️' },
  53: { label: 'Drizzle',             icon: '🌦️' },
  55: { label: 'Heavy Drizzle',       icon: '🌧️' },
  61: { label: 'Light Rain',          icon: '🌧️' },
  63: { label: 'Rain',                icon: '🌧️' },
  65: { label: 'Heavy Rain',          icon: '🌧️' },
  71: { label: 'Light Snow',          icon: '🌨️' },
  73: { label: 'Snow',                icon: '❄️' },
  75: { label: 'Heavy Snow',          icon: '❄️' },
  80: { label: 'Rain Showers',        icon: '🌦️' },
  81: { label: 'Showers',             icon: '🌧️' },
  82: { label: 'Heavy Showers',       icon: '⛈️' },
  95: { label: 'Thunderstorm',        icon: '⛈️' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { label: 'Severe Thunderstorm', icon: '⛈️' },
};

const getWeatherInfo = (code) => WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' };

export default function App() {
  const [activeTab, setActiveTab]           = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [customers, setCustomers]           = useState([]);
  const [allPurchases, setAllPurchases]     = useState([]);
  const [searchTerm, setSearchTerm]         = useState('');
  const [suggestions, setSuggestions]       = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dataLoading, setDataLoading]       = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme]                   = useState('morning');

  const [weather, setWeather]               = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError]     = useState(null);
  const [forecast, setForecast]             = useState([]);

  /* ── theme ── */
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      if (h >= 5 && h < 8)       setTheme('dawn');
      else if (h >= 8 && h < 17) setTheme('morning');
      else if (h >= 17 && h < 19) setTheme('sunset');
      else                        setTheme('night');
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { document.body.className = `theme-${theme}`; }, [theme]);
  useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);

  /* ── load firebase ── */
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setDataLoading(true);
    try {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'purchases')),
      ]);
      const cList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pList = pSnap.docs.map(d => {
        const raw = d.data();
        let product_data = [];
        try { product_data = typeof raw.product_data === 'string' ? JSON.parse(raw.product_data) : (raw.product_data || []); } catch {}
        return { id: d.id, ...raw, product_data };
      });
      setCustomers(cList);
      setAllPurchases(pList);

      /* restore saved customer after both lists are ready */
      const saved = localStorage.getItem('selectedCustomerData');
      if (saved) {
        try { const c = JSON.parse(saved); setSelectedCustomer(c); setSearchTerm(c.name); } catch {}
      }
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  /* ── weather ── */
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true); setWeatherError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
        `&timezone=Asia%2FManila&forecast_days=7`;
      const json = await fetch(url).then(r => r.json());
      setWeather(json.current);
      setForecast(json.daily.time.map((date, i) => ({
        date, code: json.daily.weather_code[i],
        max: json.daily.temperature_2m_max[i], min: json.daily.temperature_2m_min[i],
        rain: json.daily.precipitation_sum[i], wind: json.daily.wind_speed_10m_max[i],
      })));
    } catch { setWeatherError('Could not load weather data.'); }
    finally { setWeatherLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === 'weather') fetchWeather(); }, [activeTab, fetchWeather]);

  /* ── search ── */
  const handleSearchChange = (e) => {
    const v = e.target.value; setSearchTerm(v);
    if (!v.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestions(customers.filter(c => c.name.toLowerCase().includes(v.toLowerCase())).slice(0, 10));
    setShowSuggestions(true);
  };

  const handleSelect = (c) => {
    setSelectedCustomer(c); setSearchTerm(c.name);
    setSuggestions([]); setShowSuggestions(false);
    localStorage.setItem('selectedCustomerData', JSON.stringify(c));
  };

  const handleClear = () => {
    setSelectedCustomer(null); setSearchTerm('');
    setSuggestions([]); setShowSuggestions(false);
    localStorage.removeItem('selectedCustomerData');
  };

  /* ── computed ── */
  const cp        = selectedCustomer ? allPurchases.filter(p => p.customer_id === selectedCustomer.id).sort((a,b) => new Date(b.purchase_date) - new Date(a.purchase_date)) : [];
  const totalSpent  = cp.reduce((s,p) => s+(p.total_amount||0), 0);
  const paidTotal   = cp.filter(p=>p.status==='paid').reduce((s,p)=>s+(p.total_amount||0),0);
  const pendingTotal= cp.filter(p=>p.status!=='paid').reduce((s,p)=>s+(p.total_amount||0),0);
  const pendingCount= cp.filter(p=>p.status!=='paid').length;
  const paidCount   = cp.filter(p=>p.status==='paid').length;
  const avgOrder    = cp.length ? totalSpent/cp.length : 0;

  const formatDate = (ds) => ds ? new Date(ds).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'N/A';
  const formatDay  = (ds) => {
    const d = new Date(ds), today = new Date(), tmrw = new Date(today);
    tmrw.setDate(today.getDate()+1);
    if (d.toDateString()===today.toDateString()) return 'Today';
    if (d.toDateString()===tmrw.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  };
  const themeName = { dawn:'Sunrise', morning:'Morning', sunset:'Sunset', night:'Night' }[theme] || 'Morning';

  const TABS = [
    { key:'dashboard', icon:'📊', label:'Dashboard' },
    { key:'weather',   icon:'🌤️', label:'Weather' },
    { key:'settings',  icon:'⚙️',  label:'Settings' },
  ];

  return (
    <div className="app">
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
            <span className={`theme-dot theme-${theme}`} />
            <span>{themeName}</span>
          </div>
        </header>

        {/* CONTENT */}
        <div className="tab-content">

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div className="page">

              {/* Customer Search */}
              <section className="section">
                <h2 className="section-title">Customer Lookup</h2>
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search customer name…"
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
                  {selectedCustomer && <button className="clear-x" onClick={handleClear} title="Clear">✕</button>}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="dropdown">
                      {suggestions.map(c => (
                        <div key={c.id} className="dropdown-item" onMouseDown={() => handleSelect(c)}>
                          <span className="dropdown-name">{c.name}</span>
                          {c.phone && <span className="dropdown-phone">{c.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Customer Overview — replaces Store Overview */}
              {selectedCustomer ? (
                <>
                  <section className="section">
                    <h2 className="section-title">Customer Overview</h2>

                    {/* Identity card */}
                    <div className="customer-banner">
                      <div className="customer-avatar">{selectedCustomer.name.charAt(0).toUpperCase()}</div>
                      <div className="customer-meta">
                        <h3 className="customer-name">{selectedCustomer.name}</h3>
                        {selectedCustomer.phone && <p className="customer-detail">📞 {selectedCustomer.phone}</p>}
                        {selectedCustomer.email && <p className="customer-detail">✉️ {selectedCustomer.email}</p>}
                        <p className="customer-detail muted">ID: {selectedCustomer.id.slice(0,12)}…</p>
                      </div>
                    </div>

                    {/* 4 metric cards */}
                    <div className="metrics-grid">
                      <div className="metric-card metric-card--blue">
                        <div className="metric-icon">💸</div>
                        <div className="metric-label">Total Spent</div>
                        <div className="metric-value">₱{totalSpent.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{cp.length} orders</div>
                      </div>
                      <div className="metric-card metric-card--green">
                        <div className="metric-icon">✅</div>
                        <div className="metric-label">Paid</div>
                        <div className="metric-value">₱{paidTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{paidCount} orders</div>
                      </div>
                      <div className="metric-card metric-card--amber">
                        <div className="metric-icon">⏳</div>
                        <div className="metric-label">Pending</div>
                        <div className="metric-value">₱{pendingTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">{pendingCount} orders</div>
                      </div>
                      <div className="metric-card metric-card--purple">
                        <div className="metric-icon">📈</div>
                        <div className="metric-label">Avg. Order</div>
                        <div className="metric-value">₱{avgOrder.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
                        <div className="metric-sub">per transaction</div>
                      </div>
                    </div>
                  </section>

                  {/* Purchase History */}
                  <section className="section">
                    <h2 className="section-title">
                      Purchase History <span className="count-pill">{cp.length}</span>
                    </h2>
                    {dataLoading ? (
                      <div className="spinner-wrap"><div className="spinner" /></div>
                    ) : cp.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <p>No purchases found for this customer.</p>
                      </div>
                    ) : (
                      <div className="purchase-list">
                        {cp.map(purchase => (
                          <div key={purchase.id} className="purchase-card">
                            <div className="purchase-card-header">
                              <span className="purchase-date">{formatDate(purchase.purchase_date)}</span>
                              <span className={`badge ${purchase.status === 'paid' ? 'badge--green' : 'badge--amber'}`}>
                                {purchase.status || 'pending'}
                              </span>
                            </div>
                            <div className="purchase-amount-row">
                              <span className="purchase-amount-label">Total Amount</span>
                              <strong className="purchase-amount-val">₱{(purchase.total_amount||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</strong>
                            </div>
                            {purchase.product_data?.length > 0 && (
                              <div className="items-section">
                                <div className="items-label">Items</div>
                                {purchase.product_data.map((item, idx) => (
                                  <div key={idx} className="item-row">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-qty">{item.quantity}×</span>
                                    <span className="item-price">₱{(item.price||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                                    <span className="item-subtotal">₱{((item.price||0)*(item.quantity||1)).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="welcome-state">
                  <div className="welcome-icon">🔍</div>
                  <h3>Search a Customer</h3>
                  <p>Enter a name above to view their purchase history and overview.</p>
                </div>
              )}
            </div>
          )}

          {/* ── WEATHER ── */}
          {activeTab === 'weather' && (
            <div className="page">
              <div className="weather-location-bar">
                <span className="weather-pin">📍</span>
                <span className="weather-location-name">{LOCATION_NAME}</span>
                <button className="weather-refresh-btn" onClick={fetchWeather} title="Refresh">🔄</button>
              </div>

              {weatherLoading && <div className="spinner-wrap large"><div className="spinner" /></div>}

              {weatherError && !weatherLoading && (
                <div className="weather-error">
                  <span>⚠️ {weatherError}</span>
                  <button onClick={fetchWeather}>Retry</button>
                </div>
              )}

              {weather && !weatherLoading && (
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
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="page">
              <section className="section">
                <h2 className="section-title">About</h2>
                <div className="settings-card">
                  {[
                    ['App',            'Marnie Store v1.0.0'],
                    ['Database',       'Firebase Firestore'],
                    ['Total Customers', String(customers.length)],
                    ['Total Orders',    String(allPurchases.length)],
                    ['Weather Source', 'Open-Meteo (no key)'],
                  ].map(([k,v]) => (
                    <div key={k} className="settings-row">
                      <span className="settings-key">{k}</span>
                      <span className="settings-val">{v}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">Theme Schedule</h2>
                <div className="settings-card">
                  {[
                    { icon:'🌅', name:'Sunrise', time:'5:00 – 8:00 AM',    key:'dawn'    },
                    { icon:'☀️', name:'Morning', time:'8:00 AM – 5:00 PM', key:'morning' },
                    { icon:'🌇', name:'Sunset',  time:'5:00 – 7:00 PM',   key:'sunset'  },
                    { icon:'🌙', name:'Night',   time:'7:00 PM – 5:00 AM', key:'night'   },
                  ].map(t => (
                    <div key={t.key} className={`settings-row${theme===t.key?' settings-row--active':''}`}>
                      <span className="settings-key">{t.icon} {t.name}</span>
                      <span className="settings-val">{t.time}{theme===t.key?' ✓':''}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`nav-btn${activeTab===tab.key?' nav-btn--active':''}`}
              onClick={() => setActiveTab(tab.key)}
              aria-label={tab.label}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
              {activeTab === tab.key && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
      </div>

      <InstallPrompt />
    </div>
  );
}
export default App;
