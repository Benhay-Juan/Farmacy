// src/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: agregar token a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('farmacy_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: manejar errores 401 (sesión expirada)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('farmacy_token');
      localStorage.removeItem('farmacy_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ── AUTH ──
export const login = (usuario, password) => api.post('/auth/login', { usuario, password });
export const getMe = () => api.get('/auth/me');

// ── DASHBOARD ──
export const getDashboard = () => api.get('/dashboard');

// ── PRODUCTOS ──
export const getProductos = (params) => api.get('/productos', { params });
export const getProducto = (id) => api.get(`/productos/${id}`);
export const createProducto = (data) => api.post('/productos', data);
export const updateProducto = (id, data) => api.put(`/productos/${id}`, data);
export const deleteProducto = (id) => api.delete(`/productos/${id}`);

// ── CATEGORÍAS ──
export const getCategorias = () => api.get('/categorias');
export const createCategoria = (data) => api.post('/categorias', data);

// ── VENTAS ──
export const getVentas = (params) => api.get('/ventas', { params });
export const getVenta = (id) => api.get(`/ventas/${id}`);
export const createVenta = (data) => api.post('/ventas', data);

// ── CLIENTES ──
export const getClientes = (params) => api.get('/clientes', { params });
export const createCliente = (data) => api.post('/clientes', data);
export const updateCliente = (id, data) => api.put(`/clientes/${id}`, data);

// ── PROVEEDORES ──
export const getProveedores = () => api.get('/proveedores');
export const createProveedor = (data) => api.post('/proveedores', data);
export const updateProveedor = (id, data) => api.put(`/proveedores/${id}`, data);

// ── COMPRAS ──
export const getCompras = () => api.get('/compras');
export const createCompra = (data) => api.post('/compras', data);

// ── DEVOLUCIONES ──
export const getDevoluciones = () => api.get('/devoluciones');
export const createDevolucion = (data) => api.post('/devoluciones', data);

// ── CAJA ──
export const getCajaActual = () => api.get('/caja/actual');
export const abrirCaja = (data) => api.post('/caja/abrir', data);
export const cerrarCaja = (data) => api.post('/caja/cerrar', data);
export const getHistorialCaja = () => api.get('/caja/historial');

// ── REPORTES ──
export const getReporteVentas = (params) => api.get('/reportes/ventas', { params });
export const getReporteInventario = () => api.get('/reportes/inventario');

// ── USUARIOS ──
export const getUsuarios = () => api.get('/usuarios');
export const createUsuario = (data) => api.post('/usuarios', data);
export const changePassword = (id, password) => api.put(`/usuarios/${id}/password`, { password });

// ── AUDITORÍA ──
export const getAuditoria = (params) => api.get('/auditoria', { params });

// ── CONFIGURACIÓN ──
export const getConfiguracion = () => api.get('/configuracion');
export const updateConfiguracion = (data) => api.put('/configuracion', data);

export default api;
