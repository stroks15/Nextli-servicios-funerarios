# NEXTLI Servicios Funerarios

Sitio estático (HTML + JS puro). La carpeta `public/` se publica tal cual en Vercel / GitHub Pages.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `public/index.html` | Estructura y textos de los 5 pasos |
| `public/app.js` | Flujo del cliente, Modo Trabajador, mensajes de WhatsApp, certificado |
| `public/inventory.js` | Catálogo base + inventario editable + login y panel de administración |
| `public/certificate.js` | Dibuja el certificado en canvas (1179×912) y arma el PDF |
| `public/config.js` | WhatsApp, enlace del grupo, firma del médico, hash de la contraseña |
| `public/catalog.css` | Carruseles, tarjetas, barra del trabajador, panel de inventario |
| `public/configurator.css` | Estilos generales del configurador |

## Modo Trabajador
Toca dos veces el logo NEXTLI y después el botón de arriba (en menos de 3 s).

## Panel de inventario
En la barra inferior del Modo Trabajador: **Iniciar sesión** → contraseña → **Inventario**.
Permite cambiar precios, cambiar/subir imágenes y marcar productos como **Agotado/Disponible**.
Los cambios se guardan en el dispositivo (localStorage). Hay respaldo/restauración en la pestaña *Respaldo*.

## Inventario compartido (Supabase)
`config.js` ya apunta al proyecto de Supabase. Con eso, los cambios del panel se comparten con todos los dispositivos
(los clientes ven precios, imágenes y agotados al abrir el sitio). La contraseña se valida en el servidor.
La estructura está en `supabase/inventario.sql` (se ejecuta una sola vez).

Para cambiar la contraseña: consola del navegador → `nextliHash('nueva')`; actualiza `pw_hash` en la tabla
`nextli_inventory_secret` y `ADMIN_PASSWORD_HASH` en `config.js` (respaldo sin conexión).
