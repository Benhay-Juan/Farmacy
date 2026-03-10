// database/seed.js
// Inserta datos de ejemplo en la base de datos

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/farmacy.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log('🌱 Insertando datos de ejemplo...\n');

// ─── CONFIGURACIÓN ───
const configInsert = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor, descripcion) VALUES (?, ?, ?)');
const configs = [
  ['nombre_negocio', 'FARMACY', 'Nombre del establecimiento'],
  ['ruc', '0990000001001', 'RUC del negocio'],
  ['direccion', 'Av. Principal 456, Planta Baja', 'Dirección física'],
  ['telefono', '042000000', 'Teléfono principal'],
  ['email', 'info@farmacy.com', 'Email de contacto'],
  ['iva_porcentaje', '12', 'Porcentaje de IVA'],
  ['moneda', 'USD', 'Moneda del sistema'],
  ['ticket_header', 'FARMACY - Tu salud es nuestra prioridad', 'Encabezado de ticket'],
  ['ticket_footer', 'Gracias por su compra - Vuelva pronto', 'Pie de ticket'],
];
configs.forEach(c => configInsert.run(...c));
console.log('  ✅ Configuración insertada');

// ─── CATEGORÍAS ───
const catInsert = db.prepare('INSERT OR IGNORE INTO categorias (nombre, descripcion) VALUES (?, ?)');
const categorias = [
  ['Analgésicos', 'Medicamentos para el dolor'],
  ['Antibióticos', 'Medicamentos antibacterianos'],
  ['Gastrointestinales', 'Medicamentos para el aparato digestivo'],
  ['Antialérgicos', 'Medicamentos para alergias'],
  ['Antidiabéticos', 'Medicamentos para diabetes'],
  ['Antihipertensivos', 'Medicamentos para presión arterial'],
  ['Vitaminas y Suplementos', 'Vitaminas y suplementos nutricionales'],
  ['Dermatológicos', 'Medicamentos para la piel'],
  ['Antiinflamatorios', 'Medicamentos antiinflamatorios'],
  ['Respiratorios', 'Medicamentos para vías respiratorias'],
  ['Oftálmicos', 'Medicamentos para los ojos'],
  ['Higiene Personal', 'Productos de higiene y cuidado personal'],
];
categorias.forEach(c => catInsert.run(...c));
console.log('  ✅ Categorías insertadas');

// ─── PROVEEDORES ───
const provInsert = db.prepare('INSERT OR IGNORE INTO proveedores (nombre, ruc, telefono, email, direccion, contacto) VALUES (?, ?, ?, ?, ?, ?)');
const proveedores = [
  ['DistFarma S.A.', '0991234567001', '042345678', 'ventas@distfarma.com', 'Zona Industrial Norte, Galpón 5', 'Juan Pérez'],
  ['MediSupply Ecuador', '0992345678001', '042456789', 'info@medisupply.com', 'Av. de las Américas Km 2.5', 'Ana Rodríguez'],
  ['PharmaGlobal Corp.', '0993456789001', '042567890', 'compras@pharmaglobal.com', 'Cdla. Kennedy Norte, Mz 45', 'Pedro Martínez'],
  ['BioFarma del Pacífico', '0994567890001', '042678901', 'pedidos@biofarma.ec', 'Av. Juan Tanca Marengo Km 4', 'Lucía Fernández'],
  ['Droguería Nacional', '0995678901001', '042789012', 'ventas@drogueria.com', 'Centro Comercial Las Palmas, Local 12', 'Roberto Sánchez'],
];
proveedores.forEach(p => provInsert.run(...p));
console.log('  ✅ Proveedores insertados');

// ─── PRODUCTOS ───
const prodInsert = db.prepare(`
  INSERT OR IGNORE INTO productos (nombre, codigo_barras, categoria_id, precio_venta, precio_costo, stock, stock_minimo, lote, fecha_vencimiento, proveedor_id, ubicacion, requiere_receta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const productos = [
  ['Paracetamol 500mg x 20', '7861001100011', 1, 3.50, 1.80, 150, 20, 'L-2026-001', '2027-06-15', 1, 'A-01', 0],
  ['Amoxicilina 500mg x 21', '7861001100028', 2, 8.00, 4.50, 80, 15, 'L-2026-002', '2027-03-20', 2, 'A-02', 1],
  ['Omeprazol 20mg x 14', '7861001100035', 3, 5.50, 2.80, 120, 25, 'L-2026-003', '2027-09-10', 1, 'B-01', 0],
  ['Loratadina 10mg x 10', '7861001100042', 4, 4.00, 2.00, 90, 15, 'L-2026-004', '2027-12-01', 3, 'B-02', 0],
  ['Ibuprofeno 400mg x 20', '7861001100059', 1, 4.50, 2.20, 200, 30, 'L-2026-005', '2027-08-25', 2, 'A-03', 0],
  ['Metformina 850mg x 30', '7861001100066', 5, 6.00, 3.00, 5, 20, 'L-2026-006', '2026-05-10', 3, 'C-01', 1],
  ['Losartán 50mg x 30', '7861001100073', 6, 7.50, 3.80, 60, 10, 'L-2026-007', '2027-11-30', 1, 'C-02', 1],
  ['Cetirizina 10mg x 10', '7861001100080', 4, 3.80, 1.90, 110, 20, 'L-2026-008', '2027-07-15', 2, 'B-03', 0],
  ['Vitamina C 500mg x 100', '7861001100097', 7, 12.00, 6.50, 45, 10, 'L-2026-009', '2028-01-20', 4, 'D-01', 0],
  ['Diclofenaco Gel 60g', '7861001100103', 9, 6.80, 3.40, 35, 10, 'L-2026-010', '2027-10-15', 5, 'D-02', 0],
  ['Azitromicina 500mg x 3', '7861001100110', 2, 9.50, 5.20, 40, 10, 'L-2026-011', '2027-04-30', 1, 'A-04', 1],
  ['Ranitidina 150mg x 20', '7861001100127', 3, 4.20, 2.10, 95, 15, 'L-2026-012', '2027-08-10', 2, 'B-04', 0],
  ['Clotrimazol Crema 20g', '7861001100134', 8, 5.00, 2.50, 55, 10, 'L-2026-013', '2027-12-20', 3, 'D-03', 0],
  ['Salbutamol Inhalador', '7861001100141', 10, 15.00, 8.00, 25, 8, 'L-2026-014', '2027-06-30', 4, 'E-01', 1],
  ['Lágrimas Artificiales 15ml', '7861001100158', 11, 8.50, 4.50, 30, 10, 'L-2026-015', '2027-09-25', 5, 'E-02', 0],
  ['Alcohol Antiséptico 500ml', '7861001100165', 12, 3.00, 1.20, 200, 30, 'L-2026-016', '2028-06-01', 1, 'F-01', 0],
  ['Algodón 100g', '7861001100172', 12, 2.50, 1.00, 180, 25, 'L-2026-017', '2029-01-01', 2, 'F-02', 0],
  ['Complejo B x 30', '7861001100189', 7, 7.00, 3.50, 70, 15, 'L-2026-018', '2028-03-15', 3, 'D-04', 0],
  ['Enalapril 10mg x 30', '7861001100196', 6, 5.80, 2.90, 85, 15, 'L-2026-019', '2027-11-10', 4, 'C-03', 1],
  ['Glibenclamida 5mg x 30', '7861001100202', 5, 4.50, 2.30, 50, 10, 'L-2026-020', '2027-07-20', 5, 'C-04', 1],
];
productos.forEach(p => prodInsert.run(...p));
console.log('  ✅ Productos insertados');

// ─── CLIENTES ───
const cliInsert = db.prepare('INSERT OR IGNORE INTO clientes (nombre, cedula, telefono, email, direccion, tipo) VALUES (?, ?, ?, ?, ?, ?)');
const clientes = [
  ['Consumidor Final', '9999999999', '---', '---', '---', 'General'],
  ['María García', '0912345678', '0991234567', 'maria@email.com', 'Av. Principal 123', 'Frecuente'],
  ['Carlos López', '0923456789', '0982345678', 'carlos@email.com', 'Calle 10 de Agosto 456', 'Frecuente'],
  ['Ana Morales', '0934567890', '0973456789', 'ana.m@email.com', 'Urdesa Central Mz 5', 'General'],
  ['Roberto Díaz', '0945678901', '0964567890', 'roberto.d@email.com', 'Sauces 6 Mz 100', 'Mayorista'],
];
clientes.forEach(c => cliInsert.run(...c));
console.log('  ✅ Clientes insertados');

// ─── USUARIOS ───
const userInsert = db.prepare('INSERT OR IGNORE INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)');
const hashAdmin = bcrypt.hashSync('admin123', 10);
const hashVendedor = bcrypt.hashSync('vendedor123', 10);
const hashFarmaceutico = bcrypt.hashSync('farma123', 10);
userInsert.run('Administrador', 'admin', hashAdmin, 'Administrador');
userInsert.run('María Vendedora', 'maria_v', hashVendedor, 'Vendedor');
userInsert.run('Dr. Luis Farmacéutico', 'luis_f', hashFarmaceutico, 'Farmacéutico');
console.log('  ✅ Usuarios insertados');
console.log('     👤 admin / admin123 (Administrador)');
console.log('     👤 maria_v / vendedor123 (Vendedor)');
console.log('     👤 luis_f / farma123 (Farmacéutico)');

// ─── VENTAS DE EJEMPLO ───
const ventaInsert = db.prepare('INSERT INTO ventas (fecha, cliente_id, usuario_id, subtotal, impuesto, total, metodo_pago, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const detalleInsert = db.prepare('INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, precio_costo, subtotal) VALUES (?, ?, ?, ?, ?, ?)');

const ventasDemo = [
  { fecha: '2026-03-07 08:30:00', cliente: 1, usuario: 1, subtotal: 11.50, iva: 1.38, total: 12.88, pago: 'Tarjeta de crédito', items: [[1, 2, 3.50, 1.80], [5, 1, 4.50, 2.20]] },
  { fecha: '2026-03-07 09:15:00', cliente: 1, usuario: 1, subtotal: 16.50, iva: 1.98, total: 18.48, pago: 'Efectivo', items: [[3, 3, 5.50, 2.80]] },
  { fecha: '2026-03-07 10:00:00', cliente: 2, usuario: 1, subtotal: 11.60, iva: 1.39, total: 12.99, pago: 'Efectivo', items: [[4, 1, 4.00, 2.00], [8, 2, 3.80, 1.90]] },
  { fecha: '2026-03-07 11:30:00', cliente: 3, usuario: 1, subtotal: 16.00, iva: 1.92, total: 17.92, pago: 'Efectivo', items: [[2, 2, 8.00, 4.50]] },
  { fecha: '2026-03-07 14:00:00', cliente: 1, usuario: 2, subtotal: 15.00, iva: 1.80, total: 16.80, pago: 'Efectivo', items: [[9, 1, 12.00, 6.50], [16, 1, 3.00, 1.20]] },
];

ventasDemo.forEach(v => {
  const result = ventaInsert.run(v.fecha, v.cliente, v.usuario, v.subtotal, v.iva, v.total, v.pago, 'Completada');
  const ventaId = result.lastInsertRowid;
  v.items.forEach(([prodId, cant, precio, costo]) => {
    detalleInsert.run(ventaId, prodId, cant, precio, costo, precio * cant);
  });
});
console.log('  ✅ Ventas de ejemplo insertadas');

// ─── CAJA DE EJEMPLO ───
db.prepare(`INSERT INTO caja_sesiones (fecha_apertura, usuario_id, monto_inicial, ventas_efectivo, ventas_tarjeta, total_ventas, estado)
  VALUES ('2026-03-07 07:00:00', 1, 100.00, 49.27, 12.88, 79.07, 'Abierta')`).run();
console.log('  ✅ Sesión de caja insertada');

// ─── AUDITORÍA DE EJEMPLO ───
const audInsert = db.prepare('INSERT INTO auditoria (fecha, usuario_id, accion, modulo, detalle) VALUES (?, ?, ?, ?, ?)');
const auditorias = [
  ['2026-03-07 07:00:00', 1, 'Apertura de caja', 'Caja', 'Monto inicial: $100.00'],
  ['2026-03-07 07:01:00', 1, 'Inicio de sesión', 'Auth', 'Login exitoso - IP: 127.0.0.1'],
  ['2026-03-07 08:30:00', 1, 'Nueva venta #1', 'Ventas', 'Total: $12.88 - Tarjeta de crédito'],
  ['2026-03-07 09:15:00', 1, 'Nueva venta #2', 'Ventas', 'Total: $18.48 - Efectivo'],
  ['2026-03-07 10:00:00', 1, 'Nueva venta #3', 'Ventas', 'Total: $12.99 - Efectivo'],
  ['2026-03-07 11:30:00', 1, 'Nueva venta #4', 'Ventas', 'Total: $17.92 - Efectivo'],
  ['2026-03-07 14:00:00', 2, 'Nueva venta #5', 'Ventas', 'Total: $16.80 - Efectivo'],
];
auditorias.forEach(a => audInsert.run(...a));
console.log('  ✅ Registros de auditoría insertados');

db.close();
console.log('\n🎉 Datos de ejemplo insertados correctamente.');
console.log('📋 Puede iniciar el sistema con: npm start');
