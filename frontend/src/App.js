// src/App.js
// Aplicación principal del Sistema de Gestión de Farmacia
import React, { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import './App.css';

// ═══════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(usuario, password);
      localStorage.setItem('farmacy_token', res.data.token);
      localStorage.setItem('farmacy_user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">💊</div>
          <h1>FARMACY</h1>
          <p>Sistema de Gestión de Farmacia</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert-bar danger">{error}</div>}
          <div className="form-group">
            <label>Usuario</label>
            <input className="form-input" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ingrese su usuario" required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ingrese su contraseña" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 12, color: '#888', textAlign: 'center' }}>
          Usuario por defecto: <strong>admin</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD / INICIO
// ═══════════════════════════════════════════════════
function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.getDashboard().then(r => setData(r.data)).catch(console.error);
  }, []);

  if (!data) return <div className="loading">Cargando dashboard...</div>;

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Ventas de Hoy" value={`$${data.ventasHoy?.total?.toFixed(2) || '0.00'}`} icon="💰" color="green" />
        <StatCard label="Transacciones Hoy" value={data.ventasHoy?.count || 0} icon="🛒" color="blue" />
        <StatCard label="Total Productos" value={data.totalProductos} icon="📦" color="amber" />
        <StatCard label="Stock Bajo" value={data.stockBajo?.length || 0} icon="⚠️" color="red" />
      </div>

      {data.stockBajo?.length > 0 && (
        <div className="alert-bar warning">⚠️ <strong>{data.stockBajo.length} producto(s)</strong> con stock bajo: {data.stockBajo.map(p => p.nombre).join(', ')}</div>
      )}
      {data.porVencer?.length > 0 && (
        <div className="alert-bar danger">⏰ <strong>{data.porVencer.length} producto(s)</strong> próximos a vencer</div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Últimas Ventas</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th></tr></thead>
              <tbody>
                {data.ultimasVentas?.map(v => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{new Date(v.fecha).toLocaleString('es')}</td>
                    <td>{v.cliente_nombre}</td>
                    <td className="mono-bold">${v.total.toFixed(2)}</td>
                    <td><span className={`badge ${v.metodo_pago === 'Efectivo' ? 'badge-green' : 'badge-blue'}`}>{v.metodo_pago}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Productos con Stock Bajo</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead>
              <tbody>
                {data.stockBajo?.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#999' }}>✅ Todo en orden</td></tr>
                ) : data.stockBajo?.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td className="mono-bold" style={{ color: '#c0392b' }}>{p.stock}</td>
                    <td>{p.stock_minimo}</td>
                    <td><span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-amber'}`}>{p.stock === 0 ? 'Agotado' : 'Bajo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}><span style={{ fontSize: 20 }}>{icon}</span></div>
      <div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// INVENTARIO
// ═══════════════════════════════════════════════════
function Inventario() {
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const loadData = useCallback(async () => {
    const [prods, cats, provs] = await Promise.all([api.getProductos({ search }), api.getCategorias(), api.getProveedores()]);
    setProductos(prods.data);
    setCategorias(cats.data);
    setProveedores(provs.data);
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setForm({ nombre: '', codigo_barras: '', categoria_id: '', precio_venta: '', precio_costo: '', stock: '', stock_minimo: '10', lote: '', fecha_vencimiento: '', proveedor_id: '', ubicacion: '', requiere_receta: false });
    setModal('add');
  };
  const openEdit = (p) => { setForm({ ...p, requiere_receta: !!p.requiere_receta }); setModal('edit'); };

  const save = async () => {
    try {
      const data = { ...form, precio_venta: parseFloat(form.precio_venta), precio_costo: parseFloat(form.precio_costo), stock: parseInt(form.stock), stock_minimo: parseInt(form.stock_minimo), requiere_receta: form.requiere_receta ? 1 : 0 };
      if (modal === 'add') await api.createProducto(data);
      else await api.updateProducto(form.id, data);
      setModal(null);
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Error al guardar'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este producto?')) {
      await api.deleteProducto(id);
      loadData();
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Buscar producto o código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Nuevo Producto</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Mín</th><th>Lote</th><th>Vencimiento</th><th>Ubicación</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong>{p.requiere_receta ? ' 💊' : ''}</td>
                  <td>{p.categoria_nombre}</td>
                  <td className="mono">${p.precio_venta.toFixed(2)}</td>
                  <td className="mono">${p.precio_costo.toFixed(2)}</td>
                  <td><span className={`badge ${p.stock <= p.stock_minimo ? (p.stock === 0 ? 'badge-red' : 'badge-amber') : 'badge-green'}`}>{p.stock}</span></td>
                  <td>{p.stock_minimo}</td>
                  <td style={{ fontSize: 12 }}>{p.lote}</td>
                  <td>{p.fecha_vencimiento}</td>
                  <td>{p.ubicacion}</td>
                  <td>
                    <button className="btn-icon" onClick={() => openEdit(p)} title="Editar">✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p.id)} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Nuevo Producto' : 'Editar Producto'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label>Nombre *</label><input className="form-input" value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="form-group"><label>Código de Barras</label><input className="form-input" value={form.codigo_barras || ''} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Categoría</label><select className="form-input" value={form.categoria_id || ''} onChange={e => setForm({ ...form, categoria_id: e.target.value })}><option value="">Seleccionar...</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="form-group"><label>Proveedor</label><select className="form-input" value={form.proveedor_id || ''} onChange={e => setForm({ ...form, proveedor_id: e.target.value })}><option value="">Seleccionar...</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Precio Venta ($) *</label><input type="number" step="0.01" className="form-input" value={form.precio_venta || ''} onChange={e => setForm({ ...form, precio_venta: e.target.value })} /></div>
            <div className="form-group"><label>Precio Costo ($) *</label><input type="number" step="0.01" className="form-input" value={form.precio_costo || ''} onChange={e => setForm({ ...form, precio_costo: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Stock *</label><input type="number" className="form-input" value={form.stock || ''} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
            <div className="form-group"><label>Stock Mínimo</label><input type="number" className="form-input" value={form.stock_minimo || ''} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Lote</label><input className="form-input" value={form.lote || ''} onChange={e => setForm({ ...form, lote: e.target.value })} /></div>
            <div className="form-group"><label>Fecha Vencimiento</label><input type="date" className="form-input" value={form.fecha_vencimiento || ''} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Ubicación</label><input className="form-input" value={form.ubicacion || ''} onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Ej: A-01" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requiere_receta || false} onChange={e => setForm({ ...form, requiere_receta: e.target.checked })} /> Requiere receta médica
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PUNTO DE VENTA
// ═══════════════════════════════════════════════════
function PuntoDeVenta() {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [clienteId, setClienteId] = useState(1);
  const [pago, setPago] = useState('Efectivo');
  const [config, setConfig] = useState({});

  useEffect(() => {
    Promise.all([api.getProductos(), api.getClientes(), api.getConfiguracion()])
      .then(([prods, clis, conf]) => { setProductos(prods.data); setClientes(clis.data); setConfig(conf.data); });
  }, []);

  const filtered = productos.filter(p => p.stock > 0 && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo_barras?.includes(search)));
  const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const ivaPct = parseFloat(config.iva_porcentaje || 12);
  const impuesto = subtotal * (ivaPct / 100);
  const total = subtotal + impuesto;

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.producto_id === p.id);
      if (ex) {
        if (ex.cantidad >= p.stock) return prev;
        return prev.map(i => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio_venta, cantidad: 1, maxStock: p.stock }];
    });
  };

  const updateQty = (prodId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.producto_id !== prodId) return i;
      const nq = i.cantidad + delta;
      if (nq <= 0) return null;
      if (nq > i.maxStock) return i;
      return { ...i, cantidad: nq };
    }).filter(Boolean));
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    try {
      const res = await api.createVenta({
        cliente_id: clienteId,
        items: cart.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio })),
        metodo_pago: pago,
      });
      alert(`✅ Venta #${res.data.id} completada!\nTotal: $${res.data.total.toFixed(2)}`);
      setCart([]);
      const prods = await api.getProductos();
      setProductos(prods.data);
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Error al procesar la venta'));
    }
  };

  return (
    <div className="pos-layout">
      <div className="pos-products">
        <div className="search-box" style={{ marginBottom: 12 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Buscar producto o escanear código..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="product-grid">
          {filtered.map(p => (
            <div key={p.id} className={`product-card ${p.stock <= p.stock_minimo ? 'low-stock' : ''}`} onClick={() => addToCart(p)}>
              <h4>{p.nombre}</h4>
              <div className="price">${p.precio_venta.toFixed(2)}</div>
              <div className="stock-info">Stock: {p.stock} | {p.categoria_nombre || 'General'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card pos-cart">
        <div className="card-header"><h3>🛒 Carrito de Venta</h3></div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>Cliente</label>
            <select className="form-input" value={clienteId} onChange={e => setClienteId(parseInt(e.target.value))}>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Método de Pago</label>
            <select className="form-input" value={pago} onChange={e => setPago(e.target.value)}>
              <option>Efectivo</option><option>Tarjeta de crédito</option><option>Tarjeta de débito</option><option>Transferencia</option>
            </select>
          </div>
        </div>
        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Selecciona productos para agregar al carrito</div>
          ) : cart.map(i => (
            <div className="cart-item" key={i.producto_id}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{i.nombre}</div>
                <div style={{ fontSize: 12, color: '#999' }}>${i.precio.toFixed(2)} c/u</div>
              </div>
              <div className="cart-item-qty">
                <button onClick={() => updateQty(i.producto_id, -1)}>−</button>
                <span>{i.cantidad}</span>
                <button onClick={() => updateQty(i.producto_id, 1)}>+</button>
              </div>
              <div className="mono-bold" style={{ width: 65, textAlign: 'right' }}>${(i.precio * i.cantidad).toFixed(2)}</div>
              <button className="btn-icon danger" onClick={() => setCart(prev => prev.filter(x => x.producto_id !== i.producto_id))}>✕</button>
            </div>
          ))}
        </div>
        <div className="pos-cart-total">
          <div className="total-line"><span>Subtotal</span><span className="mono">${subtotal.toFixed(2)}</span></div>
          <div className="total-line"><span>IVA ({ivaPct}%)</span><span className="mono">${impuesto.toFixed(2)}</span></div>
          <div className="total-line total-final"><span>TOTAL</span><span className="mono">${total.toFixed(2)}</span></div>
          <button className="btn btn-primary btn-full" onClick={completeSale} disabled={cart.length === 0}>💳 Completar Venta</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// HISTORIAL DE VENTAS
// ═══════════════════════════════════════════════════
function HistorialVentas() {
  const [ventas, setVentas] = useState([]);
  const [filtro, setFiltro] = useState({});
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.getVentas(filtro).then(r => setVentas(r.data));
  }, [filtro]);

  const verDetalle = async (id) => {
    const res = await api.getVenta(id);
    setDetail(res.data);
  };

  return (
    <div>
      <div className="toolbar">
        <input type="date" className="form-input" style={{ width: 160 }} onChange={e => setFiltro({ ...filtro, fecha_desde: e.target.value })} />
        <input type="date" className="form-input" style={{ width: 160 }} onChange={e => setFiltro({ ...filtro, fecha_hasta: e.target.value })} />
        <select className="form-input" style={{ width: 180 }} onChange={e => setFiltro({ ...filtro, metodo_pago: e.target.value })}>
          <option value="">Todos los métodos</option><option>Efectivo</option><option>Tarjeta de crédito</option><option>Tarjeta de débito</option><option>Transferencia</option>
        </select>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Método</th><th>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{new Date(v.fecha).toLocaleString('es')}</td>
                  <td>{v.cliente_nombre}</td>
                  <td>{v.vendedor_nombre}</td>
                  <td><span className={`badge ${v.metodo_pago === 'Efectivo' ? 'badge-green' : 'badge-blue'}`}>{v.metodo_pago}</span></td>
                  <td className="mono-bold">${v.total.toFixed(2)}</td>
                  <td><span className="badge badge-green">{v.estado}</span></td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => verDetalle(v.id)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <Modal title={`Venta #${detail.id}`} onClose={() => setDetail(null)}>
          <p style={{ fontSize: 13, marginBottom: 12 }}><strong>Fecha:</strong> {new Date(detail.fecha).toLocaleString('es')} &nbsp;|&nbsp; <strong>Cliente:</strong> {detail.cliente_nombre} &nbsp;|&nbsp; <strong>Vendedor:</strong> {detail.vendedor_nombre}</p>
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              {detail.items?.map((i, idx) => <tr key={idx}><td>{i.producto_nombre}</td><td>{i.cantidad}</td><td className="mono">${i.precio_unitario.toFixed(2)}</td><td className="mono-bold">${i.subtotal.toFixed(2)}</td></tr>)}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 12, borderTop: '2px solid var(--primary)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Subtotal: ${detail.subtotal.toFixed(2)}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>IVA: ${detail.impuesto.toFixed(2)}</div>
            <div className="mono-bold" style={{ fontSize: 20, color: 'var(--primary)' }}>Total: ${detail.total.toFixed(2)}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SIMPLE CRUD PAGES (Clientes, Proveedores, etc.)
// ═══════════════════════════════════════════════════
function CrudPage({ title, fetchFn, columns, addTitle, addFields }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { fetchFn(search ? { search } : {}).then(r => setItems(r.data)); }, [search, fetchFn]);

  return (
    <div>
      <div className="toolbar">
        <div className="search-box"><span className="search-icon">🔍</span><input className="form-input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        {addTitle && <button className="btn btn-primary" onClick={() => { setForm({}); setModal(true); }}>+ {addTitle}</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{items.map(item => <tr key={item.id}>{columns.map(c => <td key={c.key}>{c.render ? c.render(item) : item[c.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
      {modal && addFields && (
        <Modal title={addTitle} onClose={() => setModal(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={() => { setModal(false); }}>Guardar</button></>}>
          {addFields.map(f => (
            <div className="form-group" key={f.key}><label>{f.label}</label><input className="form-input" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /></div>
          ))}
        </Modal>
      )}
    </div>
  );
}

function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', email: '', direccion: '', tipo: 'General' });

  const load = useCallback(() => { api.getClientes({ search }).then(r => setClientes(r.data)); }, [search]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    await api.createCliente(form);
    setModal(false);
    setForm({ nombre: '', cedula: '', telefono: '', email: '', direccion: '', tipo: 'General' });
    load();
  };

  return (
    <div>
      <div className="toolbar">
        <div className="search-box"><span className="search-icon">🔍</span><input className="form-input" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo Cliente</button>
      </div>
      <div className="card"><div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Cédula</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Tipo</th></tr></thead>
          <tbody>{clientes.map(c => <tr key={c.id}><td><strong>{c.nombre}</strong></td><td>{c.cedula}</td><td>{c.telefono}</td><td>{c.email}</td><td>{c.direccion}</td><td><span className={`badge ${c.tipo === 'Frecuente' ? 'badge-blue' : c.tipo === 'Mayorista' ? 'badge-amber' : 'badge-green'}`}>{c.tipo}</span></td></tr>)}</tbody>
        </table>
      </div></div>
      {modal && (
        <Modal title="Nuevo Cliente" onClose={() => setModal(false)} footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
          <div className="form-row"><div className="form-group"><label>Nombre *</label><input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div><div className="form-group"><label>Cédula/RUC</label><input className="form-input" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} /></div></div>
          <div className="form-row"><div className="form-group"><label>Teléfono</label><input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div><div className="form-group"><label>Email</label><input className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div></div>
          <div className="form-row"><div className="form-group"><label>Dirección</label><input className="form-input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} /></div><div className="form-group"><label>Tipo</label><select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option>General</option><option>Frecuente</option><option>Mayorista</option></select></div></div>
        </Modal>
      )}
    </div>
  );
}

function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', ruc: '', telefono: '', email: '', direccion: '', contacto: '' });

  const load = () => { api.getProveedores().then(r => setProveedores(r.data)); };
  useEffect(() => { load(); }, []);

  const save = async () => { await api.createProveedor(form); setModal(false); load(); };

  return (
    <div>
      <div className="toolbar"><div style={{ flex: 1 }} /><button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo Proveedor</button></div>
      <div className="card"><div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>RUC</th><th>Teléfono</th><th>Email</th><th>Contacto</th><th>Dirección</th></tr></thead>
          <tbody>{proveedores.map(p => <tr key={p.id}><td><strong>{p.nombre}</strong></td><td>{p.ruc}</td><td>{p.telefono}</td><td>{p.email}</td><td>{p.contacto}</td><td>{p.direccion}</td></tr>)}</tbody>
        </table>
      </div></div>
      {modal && (
        <Modal title="Nuevo Proveedor" onClose={() => setModal(false)} footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
          <div className="form-row"><div className="form-group"><label>Nombre *</label><input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div><div className="form-group"><label>RUC</label><input className="form-input" value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} /></div></div>
          <div className="form-row"><div className="form-group"><label>Teléfono</label><input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div><div className="form-group"><label>Email</label><input className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div></div>
          <div className="form-row"><div className="form-group"><label>Contacto</label><input className="form-input" value={form.contacto} onChange={e => setForm({ ...form, contacto: e.target.value })} /></div><div className="form-group"><label>Dirección</label><input className="form-input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} /></div></div>
        </Modal>
      )}
    </div>
  );
}

function ComprasPage() {
  const [compras, setCompras] = useState([]);
  useEffect(() => { api.getCompras().then(r => setCompras(r.data)); }, []);
  return (
    <div><div className="card"><div className="card-header"><h3>Historial de Compras</h3></div><div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Total</th><th>Factura</th><th>Estado</th></tr></thead>
        <tbody>{compras.map(c => <tr key={c.id}><td>{c.id}</td><td>{new Date(c.fecha).toLocaleDateString('es')}</td><td>{c.proveedor_nombre}</td><td className="mono-bold">${c.total.toFixed(2)}</td><td>{c.numero_factura || '—'}</td><td><span className="badge badge-green">{c.estado}</span></td></tr>)}</tbody>
      </table>
    </div></div></div>
  );
}

function DevolucionesPage() {
  const [devs, setDevs] = useState([]);
  useEffect(() => { api.getDevoluciones().then(r => setDevs(r.data)); }, []);
  return (
    <div><div className="card"><div className="card-header"><h3>Historial de Devoluciones</h3></div><div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Venta</th><th>Producto</th><th>Cant.</th><th>Motivo</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>{devs.map(d => <tr key={d.id}><td>{d.id}</td><td>{new Date(d.fecha).toLocaleDateString('es')}</td><td>#{d.venta_id}</td><td>{d.producto_nombre}</td><td>{d.cantidad}</td><td>{d.motivo}</td><td className="mono-bold">${d.monto_reembolso.toFixed(2)}</td><td><span className="badge badge-amber">{d.estado}</span></td></tr>)}</tbody>
      </table>
    </div></div></div>
  );
}

function ReportesPage() {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState({});
  useEffect(() => { api.getReporteVentas(filtro).then(r => setData(r.data)); }, [filtro]);

  if (!data) return <div className="loading">Cargando reportes...</div>;
  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>Reportes Financieros</h3></div>
        <div className="card-body">
          <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Visualiza e inspecciona los reportes de ingresos.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" className="form-input" onChange={e => setFiltro({ ...filtro, desde: e.target.value })} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" className="form-input" onChange={e => setFiltro({ ...filtro, hasta: e.target.value })} /></div>
          </div>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Ingresos Totales" value={`$${data.resumen?.total?.toFixed(2) || '0.00'}`} icon="📈" color="green" />
        <StatCard label="Devoluciones" value={`$${data.devoluciones?.toFixed(2) || '0.00'}`} icon="↩️" color="red" />
        <StatCard label="Costo Productos" value={`$${data.costoTotal?.toFixed(2) || '0.00'}`} icon="📦" color="amber" />
        <StatCard label="Ganancia Neta" value={`$${data.ganancia?.toFixed(2) || '0.00'}`} icon="💰" color="blue" />
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Ventas por Método de Pago</h3></div>
          <div className="table-wrap"><table><thead><tr><th>Método</th><th>Cantidad</th><th>Total</th></tr></thead>
            <tbody>{data.porMetodo?.map((m, i) => <tr key={i}><td>{m.metodo_pago}</td><td>{m.cantidad}</td><td className="mono-bold">${m.total.toFixed(2)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Top 10 Productos</h3></div>
          <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Revenue</th></tr></thead>
            <tbody>{data.topProductos?.map((p, i) => <tr key={i}><td>{p.nombre}</td><td>{p.unidades}</td><td className="mono-bold">${p.revenue.toFixed(2)}</td></tr>)}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}

function CajaPage() {
  const [caja, setCaja] = useState(null);
  useEffect(() => { api.getCajaActual().then(r => setCaja(r.data)); }, []);
  if (!caja) return <div className="loading">Cargando caja...</div>;
  const neto = (caja.monto_inicial || 0) + (caja.ventas_efectivo || 0) - (caja.total_devoluciones || 0);
  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Monto Inicial" value={`$${(caja.monto_inicial || 0).toFixed(2)}`} icon="🏦" color="green" />
        <StatCard label="Total Ventas" value={`$${(caja.total_ventas || 0).toFixed(2)}`} icon="📈" color="blue" />
        <StatCard label="Ventas Efectivo" value={`$${(caja.ventas_efectivo || 0).toFixed(2)}`} icon="💵" color="amber" />
        <StatCard label="Devoluciones" value={`$${(caja.total_devoluciones || 0).toFixed(2)}`} icon="↩️" color="red" />
      </div>
      <div className="card">
        <div className="card-header"><h3>Resumen de Caja</h3></div>
        <div className="card-body">
          <div className="grid-2">
            <div><p><strong>Estado:</strong> <span className="badge badge-green">{caja.estado || 'Cerrada'}</span></p><p><strong>Apertura:</strong> {caja.fecha_apertura ? new Date(caja.fecha_apertura).toLocaleString('es') : '—'}</p></div>
            <div><p><strong>Tarjetas:</strong> ${(caja.ventas_tarjeta || 0).toFixed(2)}</p><p><strong>Transferencias:</strong> ${(caja.ventas_transferencia || 0).toFixed(2)}</p></div>
          </div>
          <div style={{ borderTop: '2px solid var(--primary)', marginTop: 16, paddingTop: 16, textAlign: 'right' }}>
            <span className="mono-bold" style={{ fontSize: 22, color: 'var(--primary)' }}>Efectivo en Caja: ${neto.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => { api.getUsuarios().then(r => setUsuarios(r.data)).catch(() => {}); }, []);
  return (
    <div><div className="card"><div className="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último Acceso</th></tr></thead>
        <tbody>{usuarios.map(u => <tr key={u.id}><td><strong>{u.nombre}</strong></td><td>{u.usuario}</td><td><span className={`badge ${u.rol === 'Administrador' ? 'badge-blue' : 'badge-green'}`}>{u.rol}</span></td><td><span className="badge badge-green">{u.estado ? 'Activo' : 'Inactivo'}</span></td><td>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es') : '—'}</td></tr>)}</tbody>
      </table>
    </div></div></div>
  );
}

function ConfiguracionPage() {
  const [config, setConfig] = useState({});
  useEffect(() => { api.getConfiguracion().then(r => setConfig(r.data)); }, []);
  const save = async () => { await api.updateConfiguracion(config); alert('✅ Configuración guardada'); };
  return (
    <div><div className="card">
      <div className="card-header"><h3>Configuración del Sistema</h3></div>
      <div className="card-body">
        <div className="form-row"><div className="form-group"><label>Nombre del Negocio</label><input className="form-input" value={config.nombre_negocio || ''} onChange={e => setConfig({ ...config, nombre_negocio: e.target.value })} /></div><div className="form-group"><label>RUC</label><input className="form-input" value={config.ruc || ''} onChange={e => setConfig({ ...config, ruc: e.target.value })} /></div></div>
        <div className="form-row"><div className="form-group"><label>Dirección</label><input className="form-input" value={config.direccion || ''} onChange={e => setConfig({ ...config, direccion: e.target.value })} /></div><div className="form-group"><label>Teléfono</label><input className="form-input" value={config.telefono || ''} onChange={e => setConfig({ ...config, telefono: e.target.value })} /></div></div>
        <div className="form-row"><div className="form-group"><label>IVA (%)</label><input type="number" className="form-input" value={config.iva_porcentaje || ''} onChange={e => setConfig({ ...config, iva_porcentaje: e.target.value })} /></div><div className="form-group"><label>Moneda</label><select className="form-input" value={config.moneda || 'USD'} onChange={e => setConfig({ ...config, moneda: e.target.value })}><option>USD</option><option>EUR</option></select></div></div>
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={save}>Guardar Cambios</button>
      </div>
    </div></div>
  );
}

function AuditoriaPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.getAuditoria({}).then(r => setLogs(r.data)).catch(() => {}); }, []);
  return (
    <div><div className="card"><div className="card-header"><h3>Registro de Auditoría</h3></div><div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Módulo</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>{logs.map(a => <tr key={a.id}><td>{a.id}</td><td>{new Date(a.fecha).toLocaleString('es')}</td><td>{a.usuario_nombre}</td><td><span className="badge badge-blue">{a.modulo}</span></td><td><strong>{a.accion}</strong></td><td style={{ fontSize: 12, color: '#666' }}>{a.detalle}</td></tr>)}</tbody>
      </table>
    </div></div></div>
  );
}

// ═══════════════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════════════
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3><button className="btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
const menuItems = [
  { key: 'inicio', label: 'Inicio', icon: '🏠' },
  { key: 'inventario', label: 'Inventario', icon: '📦' },
  { key: 'ventas', label: 'Ventas', icon: '🛒' },
  { key: 'historial', label: 'Historial Ventas', icon: '📋' },
  { key: 'caja', label: 'Caja', icon: '💰' },
  { key: 'clientes', label: 'Clientes', icon: '👥' },
  { key: 'proveedores', label: 'Proveedores', icon: '🚚' },
  { key: 'compras', label: 'Compras', icon: '📄' },
  { key: 'devoluciones', label: 'Devoluciones', icon: '↩️' },
  { key: 'reportes', label: 'Reportes', icon: '📊' },
  { key: 'usuarios', label: 'Usuarios', icon: '👤' },
  { key: 'configuracion', label: 'Configuración', icon: '⚙️' },
  { key: 'auditoria', label: 'Auditoría', icon: '✅' },
];

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('farmacy_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [page, setPage] = useState('inicio');
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('farmacy_token');
    localStorage.removeItem('farmacy_user');
    setUser(null);
  };

  if (!user) return <LoginScreen onLogin={setUser} />;

  const renderPage = () => {
    switch (page) {
      case 'inicio': return <Dashboard />;
      case 'inventario': return <Inventario />;
      case 'ventas': return <PuntoDeVenta />;
      case 'historial': return <HistorialVentas />;
      case 'caja': return <CajaPage />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'compras': return <ComprasPage />;
      case 'devoluciones': return <DevolucionesPage />;
      case 'reportes': return <ReportesPage />;
      case 'usuarios': return <UsuariosPage />;
      case 'configuracion': return <ConfiguracionPage />;
      case 'auditoria': return <AuditoriaPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <button className="toggle" onClick={() => setCollapsed(!collapsed)}>☰</button>
          {!collapsed && <h1>FARMACY</h1>}
        </div>
        <div className="sidebar-user">
          <div className="avatar">{user.nombre?.[0] || 'A'}</div>
          {!collapsed && <div><strong>{user.nombre}</strong><span>{user.rol}</span></div>}
        </div>
        <nav className="sidebar-nav">
          {menuItems.map(m => (
            <div key={m.key} className={`nav-item ${page === m.key ? 'active' : ''}`} onClick={() => setPage(m.key)}>
              <span className="nav-icon">{m.icon}</span>
              {!collapsed && <span className="nav-label">{m.label}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            {!collapsed && <span className="nav-label">Cerrar Sesión</span>}
          </div>
        </div>
      </div>
      <div className="main">
        <div className="topbar">
          <h2>{menuItems.find(m => m.key === page)?.label || 'Inicio'}</h2>
          <div className="topbar-right">
            <span>{new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  );
}
