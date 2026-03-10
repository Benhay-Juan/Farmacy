// database/init.js
// Inicializa la base de datos SQLite con todas las tablas

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/farmacy.db');
const db = new Database(dbPath);

// Habilitar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔧 Creando tablas de la base de datos...\n');

db.exec(`
  -- ═══════════════════════════════════════════════
  -- TABLA: CATEGORÍAS DE PRODUCTOS
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    estado INTEGER DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: PROVEEDORES
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ruc TEXT UNIQUE,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    contacto TEXT,
    estado INTEGER DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: PRODUCTOS
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    codigo_barras TEXT UNIQUE,
    categoria_id INTEGER,
    descripcion TEXT,
    precio_venta REAL NOT NULL DEFAULT 0,
    precio_costo REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 10,
    lote TEXT,
    fecha_vencimiento DATE,
    proveedor_id INTEGER,
    ubicacion TEXT,
    requiere_receta INTEGER DEFAULT 0,
    estado INTEGER DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: CLIENTES
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    tipo TEXT DEFAULT 'General',
    estado INTEGER DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: USUARIOS
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'Vendedor',
    estado INTEGER DEFAULT 1,
    ultimo_acceso DATETIME,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: VENTAS (CABECERA)
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    cliente_id INTEGER DEFAULT 1,
    usuario_id INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    impuesto REAL NOT NULL DEFAULT 0,
    descuento REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'Efectivo',
    monto_recibido REAL DEFAULT 0,
    cambio REAL DEFAULT 0,
    estado TEXT DEFAULT 'Completada',
    observaciones TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: DETALLE DE VENTAS
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS venta_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    precio_costo REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: COMPRAS (CABECERA)
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    proveedor_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    impuesto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    estado TEXT DEFAULT 'Recibida',
    numero_factura TEXT,
    observaciones TEXT,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: DETALLE DE COMPRAS
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS compra_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    lote TEXT,
    fecha_vencimiento DATE,
    FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: DEVOLUCIONES
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS devoluciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    venta_id INTEGER,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo TEXT,
    monto_reembolso REAL NOT NULL DEFAULT 0,
    estado TEXT DEFAULT 'Pendiente',
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: CAJA (SESIONES)
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS caja_sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,
    usuario_id INTEGER NOT NULL,
    monto_inicial REAL NOT NULL DEFAULT 0,
    ventas_efectivo REAL DEFAULT 0,
    ventas_tarjeta REAL DEFAULT 0,
    ventas_transferencia REAL DEFAULT 0,
    total_ventas REAL DEFAULT 0,
    total_devoluciones REAL DEFAULT 0,
    monto_final REAL DEFAULT 0,
    estado TEXT DEFAULT 'Abierta',
    observaciones TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: MOVIMIENTOS DE CAJA
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS caja_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sesion_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    referencia_id INTEGER,
    referencia_tipo TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sesion_id) REFERENCES caja_sesiones(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: AUDITORÍA
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    modulo TEXT NOT NULL,
    detalle TEXT,
    ip TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- ═══════════════════════════════════════════════
  -- TABLA: CONFIGURACIÓN
  -- ═══════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT,
    descripcion TEXT
  );

  -- ═══════════════════════════════════════════════
  -- ÍNDICES PARA RENDIMIENTO
  -- ═══════════════════════════════════════════════
  CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
  CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo_barras);
  CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
  CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id);
  CREATE INDEX IF NOT EXISTS idx_productos_vencimiento ON productos(fecha_vencimiento);
  CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
  CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
  CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id);
  CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
  CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);
`);

console.log('✅ Todas las tablas creadas correctamente.');
console.log('📦 Base de datos ubicada en:', dbPath);

db.close();
console.log('\n🎉 Inicialización completa. Ejecute "npm run db:seed" para datos de ejemplo.');
