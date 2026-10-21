# JAC Seguros — App móvil (Android + iPhone)

App para el equipo de JAC Seguros. Usa **la misma base de datos** que
crm.jacsegurospa.com: lo que se cambia en el teléfono aparece en el CRM web y al revés.

## Qué hace

| Pantalla | Qué ves | Qué puedes cambiar |
|---|---|---|
| Inicio | Pólizas vigentes, las que vencen en 30 días, siniestros abiertos, tareas atrasadas | — |
| Clientes | Buscador por nombre, cédula o celular. Ficha con pólizas, siniestros, vehículos y pagos. Botones para llamar, WhatsApp y correo | Celular, teléfono, correo y dirección |
| Pólizas | Filtros: vencen en 30 días, vigentes, vencidas, todas. Detalle con pagos | — |
| Siniestros | Abiertos / todos, con detalle y seguimiento | Estado y notas de seguimiento (se agregan, nunca se borran) |
| Tareas | Pendientes y cerradas | Crear tareas, marcarlas hechas, en proceso o en seguimiento |
| Ajustes | Estado de seguridad | Activar verificación en dos pasos, cambiar contraseña, cerrar sesión |

La app **no borra** nada. Al editar solo envía los campos que cambiaste, así que
no toca los adjuntos ni el historial que guarda el CRM web.

## Seguridad incluida

1. **Inicio de sesión** con el mismo correo y contraseña del CRM. Tras 3 fallos se
   impone una espera creciente (30 s → 15 min). El mensaje de error no revela si el correo existe.
2. **Verificación en dos pasos (TOTP)** con Google/Microsoft Authenticator. Si está
   activada, no se entra sin el código. Si no se puede comprobar, no se entra.
3. **Huella / Face ID / PIN del teléfono** al abrir la app y al volver después de
   30 s en segundo plano. Si el teléfono no tiene bloqueo de pantalla, la app no abre.
4. **Bloqueo automático** a los 5 min sin uso y **sesión máxima de 12 h** (luego pide contraseña).
5. **Sesión cifrada** en el Keychain (iPhone) o Keystore (Android), solo en ese
   teléfono. Nunca en archivos ni en almacenamiento del navegador.
6. **Sin capturas de pantalla** en Android y contenido oculto en el selector de apps.
7. **Los datos de clientes solo viven en memoria**: no se guardan en el teléfono.
   Al cerrar sesión se borra todo.
8. **Solo HTTPS** y solo certificados del sistema (bloquea proxies que espían tráfico).
9. **Sin copias de seguridad** en la nube ni transferencia a otro teléfono (Android).
10. **Política de contenido (CSP)**: la app solo puede hablar con tu Supabase.
11. Código ofuscado en Android, depuración desactivada, sin mapas de código fuente.

### ⚠️ Lo más importante: proteger la base de datos

La clave de Supabase está en el código del sitio web (y en cualquier app); es
pública por diseño. **Lo que protege los datos son las políticas RLS de la base.**
En la carpeta `supabase/` hay tres scripts:

1. `1-verificar.sql` — solo lectura. Dice qué tablas están expuestas.
2. `2-proteger.sql` — activa RLS en todas las tablas, quita el acceso anónimo y deja
   entrar **solo a los correos de la lista `equipo_autorizado`**. Edita los correos antes de correrlo.
3. `3-revertir.sql` — plan B si algo deja de cargar.

Luego, en el panel de Supabase: desactiva el registro público de usuarios, activa
MFA TOTP y la protección contra contraseñas filtradas.

## Cómo compilar

Requisitos: Node 22, Android Studio (para Android) y una Mac con Xcode (para iPhone).

```bash
cd app-movil
npm ci
cp .env.example .env
npm test            # pruebas
npm run android     # compila y abre Android Studio
npm run ios         # compila y abre Xcode (solo en Mac)
```

En el navegador (`npm run dev`) se puede probar la interfaz; la huella y el
almacén cifrado solo funcionan en el teléfono.

### Compilación automática (Android)

Cada vez que se sube un cambio a `app-movil/`, GitHub Actions genera el APK
(pestaña **Actions → App móvil → Artifacts**). Para que salga firmado y listo para
Google Play, agrega estos secretos en GitHub (Settings → Secrets → Actions):

| Secreto | Valor |
|---|---|
| `ANDROID_KEYSTORE_B64` | El archivo `.keystore` en base64 (`base64 -w0 mi.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del keystore |
| `ANDROID_KEY_ALIAS` | Alias de la llave |
| `ANDROID_KEY_PASSWORD` | Contraseña de la llave |

Crear el keystore (una sola vez, guárdalo en un lugar seguro; si se pierde no se
puede actualizar la app en Google Play):

```bash
keytool -genkey -v -keystore jac-seguros.keystore -alias jac -keyalg RSA -keysize 4096 -validity 10000
```

### Publicar

- **Google Play**: cuenta de desarrollador (USD 25 una vez). Sube el `.aab`. Para
  uso interno del equipo usa la pista "Prueba interna": no queda pública.
- **App Store**: Apple Developer (USD 99/año). Para solo el equipo usa TestFlight
  o distribución privada.

## Estructura

```
src/lib/config.ts      tiempos de seguridad
src/lib/auth.ts        login, dos pasos, contraseña, cierre de sesión
src/lib/bloqueo.ts     huella/Face ID, bloqueo por inactividad, pantalla privada
src/lib/secureStore.ts sesión cifrada en Keychain/Keystore
src/lib/datos.ts       lectura y escritura sobre las tablas del CRM
src/screens/           pantallas
supabase/              scripts de seguridad de la base
```
