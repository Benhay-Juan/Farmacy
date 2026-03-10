// backend/server.js
// Servidor Express con todas las rutas API para el sistema de farmacia

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'farmacy_default_secret';
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/farmacy.db');

// ─── DATABASE ───
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json());

// Servir frontend en producción
app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));

// ─── AUTH MIDDLEWARE ───
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.rol !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
  next();
}

// Helper: registrar auditoría
function logAudit(userId, accion, modulo, detalle) {
  db.prepare('INSERT INTO auditoria (usuario_id, accion, modulo, detalle) VALUES (?, ?, ?, ?)').run(userId, accion, modulo, detalle);
}

// ══════════════════════════════════════════════════
// AUTENTICACIÓN
// ══════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body;
  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND estado = 1').get(usuario);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  db.prepare('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  logAudit(user.id, 'Inicio de sesión', 'Auth', `Login exitoso`);

  const token = jwt.sign({ id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, nombre, usuario, rol, ultimo_acceso FROM usuarios WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ══════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const ventasHoy = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE DATE(fecha) = ? AND estado = 'Completada'").get(today);
  const totalProductos = db.prepare('SELECT COUNT(*) as count FROM productos WHERE estado = 1').get();
  const stockBajo = db.prepare('SELECT * FROM productos WHERE stock <= stock_minimo AND estado = 1').all();
  const porVencer = db.prepare("SELECT * FROM productos WHERE fecha_vencimiento BETWEEN DATE('now') AND DATE('now', '+90 days') AND estado = 1").all();
  const ultimasVentas = db.prepare("SELECT v.*, c.nombre as cliente_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id ORDER BY v.fecha DESC LIMIT 10").all();
  const cajaActual = db.prepare("SELECT * FROM caja_sesiones WHERE estado = 'Abierta' ORDER BY id DESC LIMIT 1").get();

  res.json({ ventasHoy, totalProductos: totalProductos.count, stockBajo, porVencer, ultimasVentas, cajaActual });
});

// ══════════════════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════════════════
app.get('/api/productos', authMiddleware, (req, res) => {
  const { search, categoria, stock_bajo } = req.query;
  let sql = `SELECT p.*, c.nombre as categoria_nombre, pr.nombre as proveedor_nombre
    FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE p.estado = 1`;
  const params = [];

  if (search) { sql += ' AND (p.nombre LIKE ? OR p.codigo_barras LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (categoria) { sql += ' AND p.categoria_id = ?'; params.push(categoria); }
  if (stock_bajo === 'true') { sql += ' AND p.stock <= p.stock_minimo'; }
  sql += ' ORDER BY p.nombre';

  res.json(db.prepare(sql).all(...params));
});

app.get('/api/productos/:id', authMiddleware, (req, res) => {
  const prod = db.prepare(`SELECT p.*, c.nombre as categoria_nombre, pr.nombre as proveedor_nombre
    FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN proveedores pr ON p.proveedor_id = pr.id WHERE p.id = ?`).get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(prod);
});

app.post('/api/productos', authMiddleware, (req, res) => {
  const { nombre, codigo_barras, categoria_id, descripcion, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta } = req.body;
  try {
    const result = db.prepare(`INSERT INTO productos (nombre, codigo_barras, categoria_id, descripcion, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(nombre, codigo_barras, categoria_id, descripcion, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta || 0);
    logAudit(req.user.id, 'Nuevo producto', 'Inventario', `${nombre} - Stock: ${stock}`);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Producto creado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/productos/:id', authMiddleware, (req, res) => {
  const { nombre, codigo_barras, categoria_id, descripcion, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta } = req.body;
  db.prepare(`UPDATE productos SET nombre=?, codigo_barras=?, categoria_id=?, descripcion=?, precio_venta=?, precio_costo=?, stock=?, stock_minimo=?, lote=?, fecha_vencimiento=?, proveedor_id=?, ubicacion=?, requiere_receta=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?`)
    .run(nombre, codigo_barras, categoria_id, descripcion, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta || 0, req.params.id);
  logAudit(req.user.id, 'Editar producto', 'Inventario', `${nombre} (ID: ${req.params.id})`);
  res.json({ message: 'Producto actualizado' });
});

app.delete('/api/productos/:id', authMiddleware, adminOnly, (req, res) => {
  const prod = db.prepare('SELECT nombre FROM productos WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE productos SET estado = 0 WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, 'Eliminar producto', 'Inventario', `${prod?.nombre} (ID: ${req.params.id})`);
  res.json({ message: 'Producto eliminado' });
});

// ══════════════════════════════════════════════════
// CATEGORÍAS
// ══════════════════════════════════════════════════
app.get('/api/categorias', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM categorias WHERE estado = 1 ORDER BY nombre').all());
});

app.post('/api/categorias', authMiddleware, (req, res) => {
  const { nombre, descripcion } = req.body;
  const result = db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)').run(nombre, descripcion);
  res.status(201).json({ id: result.lastInsertRowid });
});

// ══════════════════════════════════════════════════
// VENTAS
// ══════════════════════════════════════════════════
app.get('/api/ventas', authMiddleware, (req, res) => {
  const { fecha_desde, fecha_hasta, metodo_pago, cliente_id } = req.query;
  let sql = "SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE 1=1";
  const params = [];
  if (fecha_desde) { sql += ' AND DATE(v.fecha) >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ' AND DATE(v.fecha) <= ?'; params.push(fecha_hasta); }
  if (metodo_pago) { sql += ' AND v.metodo_pago = ?'; params.push(metodo_pago); }
  if (cliente_id) { sql += ' AND v.cliente_id = ?'; params.push(cliente_id); }
  sql += ' ORDER BY v.fecha DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/ventas/:id', authMiddleware, (req, res) => {
  const venta = db.prepare("SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?").get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  venta.items = db.prepare("SELECT vd.*, p.nombre as producto_nombre FROM venta_detalle vd LEFT JOIN productos p ON vd.producto_id = p.id WHERE vd.venta_id = ?").all(req.params.id);
  res.json(venta);
});

app.post('/api/ventas', authMiddleware, (req, res) => {
  const { cliente_id, items, metodo_pago, monto_recibido, descuento, observaciones } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un producto' });

  const ivaPct = parseFloat(db.prepare("SELECT valor FROM configuracion WHERE clave = 'iva_porcentaje'").get()?.valor || '12');

  const realizarVenta = db.transaction(() => {
    let subtotal = 0;
    // Validar stock
    for (const item of items) {
      const prod = db.prepare('SELECT id, nombre, stock, precio_venta, precio_costo FROM productos WHERE id = ? AND estado = 1').get(item.producto_id);
      if (!prod) throw new Error(`Producto ID ${item.producto_id} no encontrado`);
      if (prod.stock < item.cantidad) throw new Error(`Stock insuficiente para ${prod.nombre} (disponible: ${prod.stock})`);
      subtotal += (item.precio_unitario || prod.precio_venta) * item.cantidad;
    }

    const desc = descuento || 0;
    const impuesto = (subtotal - desc) * (ivaPct / 100);
    const total = subtotal - desc + impuesto;
    const cambio = monto_recibido ? monto_recibido - total : 0;

    const result = db.prepare(`INSERT INTO ventas (cliente_id, usuario_id, subtotal, impuesto, descuento, total, metodo_pago, monto_recibido, cambio, estado, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completada', ?)`).run(cliente_id || 1, req.user.id, subtotal, impuesto, desc, total, metodo_pago || 'Efectivo', monto_recibido || 0, cambio, observaciones);
    const ventaId = result.lastInsertRowid;

    for (const item of items) {
      const prod = db.prepare('SELECT precio_venta, precio_costo FROM productos WHERE id = ?').get(item.producto_id);
      const precio = item.precio_unitario || prod.precio_venta;
      db.prepare('INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, precio_costo, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ventaId, item.producto_id, item.cantidad, precio, prod.precio_costo, precio * item.cantidad);
      db.prepare('UPDATE productos SET stock = stock - ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(item.cantidad, item.producto_id);
    }

    // Actualizar caja si hay una abierta
    const caja = db.prepare("SELECT id FROM caja_sesiones WHERE estado = 'Abierta' ORDER BY id DESC LIMIT 1").get();
    if (caja) {
      const campo = metodo_pago === 'Efectivo' ? 'ventas_efectivo' : metodo_pago?.includes('Tarjeta') ? 'ventas_tarjeta' : 'ventas_transferencia';
      db.prepare(`UPDATE caja_sesiones SET ${campo} = ${campo} + ?, total_ventas = total_ventas + ? WHERE id = ?`).run(total, total, caja.id);
    }

    logAudit(req.user.id, `Nueva venta #${ventaId}`, 'Ventas', `Total: $${total.toFixed(2)} - ${metodo_pago}`);
    return { id: ventaId, total, cambio };
  });

  try {
    const result = realizarVenta();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════
app.get('/api/clientes', authMiddleware, (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM clientes WHERE estado = 1';
  const params = [];
  if (search) { sql += ' AND (nombre LIKE ? OR cedula LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY nombre';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/clientes', authMiddleware, (req, res) => {
  const { nombre, cedula, telefono, email, direccion, tipo } = req.body;
  try {
    const result = db.prepare('INSERT INTO clientes (nombre, cedula, telefono, email, direccion, tipo) VALUES (?, ?, ?, ?, ?, ?)').run(nombre, cedula, telefono, email, direccion, tipo || 'General');
    logAudit(req.user.id, 'Nuevo cliente', 'Clientes', nombre);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/clientes/:id', authMiddleware, (req, res) => {
  const { nombre, cedula, telefono, email, direccion, tipo } = req.body;
  db.prepare('UPDATE clientes SET nombre=?, cedula=?, telefono=?, email=?, direccion=?, tipo=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?').run(nombre, cedula, telefono, email, direccion, tipo, req.params.id);
  res.json({ message: 'Cliente actualizado' });
});

// ══════════════════════════════════════════════════
// PROVEEDORES
// ══════════════════════════════════════════════════
app.get('/api/proveedores', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM proveedores WHERE estado = 1 ORDER BY nombre').all());
});

app.post('/api/proveedores', authMiddleware, (req, res) => {
  const { nombre, ruc, telefono, email, direccion, contacto } = req.body;
  try {
    const result = db.prepare('INSERT INTO proveedores (nombre, ruc, telefono, email, direccion, contacto) VALUES (?, ?, ?, ?, ?, ?)').run(nombre, ruc, telefono, email, direccion, contacto);
    logAudit(req.user.id, 'Nuevo proveedor', 'Proveedores', nombre);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/proveedores/:id', authMiddleware, (req, res) => {
  const { nombre, ruc, telefono, email, direccion, contacto } = req.body;
  db.prepare('UPDATE proveedores SET nombre=?, ruc=?, telefono=?, email=?, direccion=?, contacto=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?').run(nombre, ruc, telefono, email, direccion, contacto, req.params.id);
  res.json({ message: 'Proveedor actualizado' });
});

// ══════════════════════════════════════════════════
// COMPRAS
// ══════════════════════════════════════════════════
app.get('/api/compras', authMiddleware, (req, res) => {
  res.json(db.prepare("SELECT c.*, p.nombre as proveedor_nombre FROM compras c LEFT JOIN proveedores p ON c.proveedor_id = p.id ORDER BY c.fecha DESC").all());
});

app.post('/api/compras', authMiddleware, (req, res) => {
  const { proveedor_id, items, numero_factura, observaciones } = req.body;
  const realizarCompra = db.transaction(() => {
    let subtotal = 0;
    items.forEach(i => { subtotal += i.precio_unitario * i.cantidad; });
    const ivaPct = parseFloat(db.prepare("SELECT valor FROM configuracion WHERE clave = 'iva_porcentaje'").get()?.valor || '12');
    const impuesto = subtotal * (ivaPct / 100);
    const total = subtotal + impuesto;

    const result = db.prepare('INSERT INTO compras (proveedor_id, usuario_id, subtotal, impuesto, total, estado, numero_factura, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(proveedor_id, req.user.id, subtotal, impuesto, total, 'Recibida', numero_factura, observaciones);
    const compraId = result.lastInsertRowid;

    items.forEach(i => {
      db.prepare('INSERT INTO compra_detalle (compra_id, producto_id, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(compraId, i.producto_id, i.cantidad, i.precio_unitario, i.precio_unitario * i.cantidad, i.lote, i.fecha_vencimiento);
      db.prepare('UPDATE productos SET stock = stock + ?, precio_costo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?')
        .run(i.cantidad, i.precio_unitario, i.producto_id);
    });

    logAudit(req.user.id, `Nueva compra #${compraId}`, 'Compras', `Total: $${total.toFixed(2)}`);
    return { id: compraId, total };
  });

  try {
    res.status(201).json(realizarCompra());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// DEVOLUCIONES
// ══════════════════════════════════════════════════
app.get('/api/devoluciones', authMiddleware, (req, res) => {
  res.json(db.prepare("SELECT d.*, p.nombre as producto_nombre FROM devoluciones d LEFT JOIN productos p ON d.producto_id = p.id ORDER BY d.fecha DESC").all());
});

app.post('/api/devoluciones', authMiddleware, (req, res) => {
  const { venta_id, producto_id, cantidad, motivo, monto_reembolso } = req.body;
  const realizarDev = db.transaction(() => {
    const result = db.prepare('INSERT INTO devoluciones (venta_id, producto_id, cantidad, motivo, monto_reembolso, estado, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(venta_id, producto_id, cantidad, motivo, monto_reembolso, 'Aprobada', req.user.id);
    db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(cantidad, producto_id);

    const caja = db.prepare("SELECT id FROM caja_sesiones WHERE estado = 'Abierta' ORDER BY id DESC LIMIT 1").get();
    if (caja) {
      db.prepare('UPDATE caja_sesiones SET total_devoluciones = total_devoluciones + ? WHERE id = ?').run(monto_reembolso, caja.id);
    }

    logAudit(req.user.id, `Devolución #${result.lastInsertRowid}`, 'Devoluciones', `Producto ID: ${producto_id}, Monto: $${monto_reembolso}`);
    return { id: result.lastInsertRowid };
  });

  try {
    res.status(201).json(realizarDev());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// CAJA
// ══════════════════════════════════════════════════
app.get('/api/caja/actual', authMiddleware, (req, res) => {
  const sesion = db.prepare("SELECT cs.*, u.nombre as usuario_nombre FROM caja_sesiones cs LEFT JOIN usuarios u ON cs.usuario_id = u.id WHERE cs.estado = 'Abierta' ORDER BY cs.id DESC LIMIT 1").get();
  res.json(sesion || { estado: 'Cerrada' });
});

app.post('/api/caja/abrir', authMiddleware, (req, res) => {
  const abierta = db.prepare("SELECT id FROM caja_sesiones WHERE estado = 'Abierta'").get();
  if (abierta) return res.status(400).json({ error: 'Ya hay una caja abierta' });
  const { monto_inicial } = req.body;
  const result = db.prepare('INSERT INTO caja_sesiones (usuario_id, monto_inicial) VALUES (?, ?)').run(req.user.id, monto_inicial || 0);
  logAudit(req.user.id, 'Apertura de caja', 'Caja', `Monto inicial: $${(monto_inicial || 0).toFixed(2)}`);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.post('/api/caja/cerrar', authMiddleware, (req, res) => {
  const sesion = db.prepare("SELECT * FROM caja_sesiones WHERE estado = 'Abierta' ORDER BY id DESC LIMIT 1").get();
  if (!sesion) return res.status(400).json({ error: 'No hay caja abierta' });
  const montoFinal = sesion.monto_inicial + sesion.ventas_efectivo - sesion.total_devoluciones;
  db.prepare("UPDATE caja_sesiones SET estado = 'Cerrada', fecha_cierre = CURRENT_TIMESTAMP, monto_final = ?, observaciones = ? WHERE id = ?")
    .run(montoFinal, req.body.observaciones, sesion.id);
  logAudit(req.user.id, 'Cierre de caja', 'Caja', `Monto final: $${montoFinal.toFixed(2)}`);
  res.json({ message: 'Caja cerrada', monto_final: montoFinal });
});

app.get('/api/caja/historial', authMiddleware, (req, res) => {
  res.json(db.prepare("SELECT cs.*, u.nombre as usuario_nombre FROM caja_sesiones cs LEFT JOIN usuarios u ON cs.usuario_id = u.id ORDER BY cs.id DESC LIMIT 30").all());
});

// ══════════════════════════════════════════════════
// REPORTES
// ══════════════════════════════════════════════════
app.get('/api/reportes/ventas', authMiddleware, (req, res) => {
  const { desde, hasta } = req.query;
  let where = "WHERE v.estado = 'Completada'";
  const params = [];
  if (desde) { where += ' AND DATE(v.fecha) >= ?'; params.push(desde); }
  if (hasta) { where += ' AND DATE(v.fecha) <= ?'; params.push(hasta); }

  const resumen = db.prepare(`SELECT COUNT(*) as total_ventas, COALESCE(SUM(v.subtotal),0) as subtotal, COALESCE(SUM(v.impuesto),0) as impuesto, COALESCE(SUM(v.total),0) as total FROM ventas v ${where}`).get(...params);
  const porMetodo = db.prepare(`SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total FROM ventas v ${where} GROUP BY metodo_pago`).all(...params);
  const porDia = db.prepare(`SELECT DATE(v.fecha) as dia, COUNT(*) as ventas, SUM(v.total) as total FROM ventas v ${where} GROUP BY DATE(v.fecha) ORDER BY dia`).all(...params);
  const topProductos = db.prepare(`SELECT p.nombre, SUM(vd.cantidad) as unidades, SUM(vd.subtotal) as revenue FROM venta_detalle vd JOIN productos p ON vd.producto_id = p.id JOIN ventas v ON vd.venta_id = v.id ${where} GROUP BY vd.producto_id ORDER BY unidades DESC LIMIT 10`).all(...params);

  // Ganancia
  const costoTotal = db.prepare(`SELECT COALESCE(SUM(vd.precio_costo * vd.cantidad), 0) as costo FROM venta_detalle vd JOIN ventas v ON vd.venta_id = v.id ${where}`).get(...params);
  const devoluciones = db.prepare(`SELECT COALESCE(SUM(monto_reembolso), 0) as total FROM devoluciones ${desde || hasta ? `WHERE ${desde ? "DATE(fecha) >= '" + desde + "'" : '1=1'} ${hasta ? "AND DATE(fecha) <= '" + hasta + "'" : ''}` : ''}`).get();

  res.json({ resumen, porMetodo, porDia, topProductos, costoTotal: costoTotal.costo, devoluciones: devoluciones.total, ganancia: resumen.total - costoTotal.costo - devoluciones.total });
});

app.get('/api/reportes/inventario', authMiddleware, (req, res) => {
  const valorTotal = db.prepare('SELECT SUM(stock * precio_costo) as valor_costo, SUM(stock * precio_venta) as valor_venta FROM productos WHERE estado = 1').get();
  const porCategoria = db.prepare('SELECT c.nombre, COUNT(p.id) as productos, SUM(p.stock) as unidades FROM productos p JOIN categorias c ON p.categoria_id = c.id WHERE p.estado = 1 GROUP BY c.id').all();
  const stockBajo = db.prepare('SELECT * FROM productos WHERE stock <= stock_minimo AND estado = 1 ORDER BY stock ASC').all();
  const porVencer = db.prepare("SELECT * FROM productos WHERE fecha_vencimiento BETWEEN DATE('now') AND DATE('now', '+90 days') AND estado = 1 ORDER BY fecha_vencimiento ASC").all();

  res.json({ valorTotal, porCategoria, stockBajo, porVencer });
});

// ══════════════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════════════
app.get('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id, nombre, usuario, rol, estado, ultimo_acceso, creado_en FROM usuarios ORDER BY id').all());
});

app.post('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
  const { nombre, usuario, password, rol } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)').run(nombre, usuario, hash, rol || 'Vendedor');
    logAudit(req.user.id, 'Nuevo usuario', 'Usuarios', `${nombre} - Rol: ${rol}`);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id/password', authMiddleware, (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const hash = bcrypt.hashSync(req.body.password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Contraseña actualizada' });
});

// ══════════════════════════════════════════════════
// AUDITORÍA
// ══════════════════════════════════════════════════
app.get('/api/auditoria', authMiddleware, adminOnly, (req, res) => {
  const { desde, hasta, usuario_id, modulo } = req.query;
  let sql = 'SELECT a.*, u.nombre as usuario_nombre FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE 1=1';
  const params = [];
  if (desde) { sql += ' AND DATE(a.fecha) >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND DATE(a.fecha) <= ?'; params.push(hasta); }
  if (usuario_id) { sql += ' AND a.usuario_id = ?'; params.push(usuario_id); }
  if (modulo) { sql += ' AND a.modulo = ?'; params.push(modulo); }
  sql += ' ORDER BY a.fecha DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

// ══════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════
app.get('/api/configuracion', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM configuracion').all();
  const config = {};
  rows.forEach(r => { config[r.clave] = r.valor; });
  res.json(config);
});

app.put('/api/configuracion', authMiddleware, adminOnly, (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  Object.entries(req.body).forEach(([k, v]) => update.run(k, v));
  logAudit(req.user.id, 'Actualizar configuración', 'Config', JSON.stringify(req.body));
  res.json({ message: 'Configuración actualizada' });
});

// ─── CATCH-ALL PARA FRONTEND ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
});

// ─── INICIAR SERVIDOR ───
app.listen(PORT, () => {
  console.log(`\n🏥 FARMACY POS Server`);
  console.log(`   📡 API corriendo en: http://localhost:${PORT}`);
  console.log(`   💾 Base de datos: ${dbPath}`);
  console.log(`   🔑 JWT Secret configurado`);
  console.log(`\n   Listo para recibir conexiones.\n`);
});

module.exports = app;
