# Guía paso a paso — App JAC Seguros

Sigue los pasos en orden. Cada uno dice cuánto tarda y qué deberías ver al terminar.
No hace falta saber programar.

---

## Paso 1 · Ajustes de seguridad en Supabase (2 minutos)

✅ **Revisado el 21 oct 2026: la base de datos ya está protegida.** Todas las tablas
tienen RLS y solo tu usuario puede leer o escribir. Los adjuntos son privados.
**No hace falta correr `2-proteger.sql`.**

Solo falta esto:

1. Entra a **https://supabase.com/dashboard** y abre el proyecto del CRM.
2. Menú izquierdo → **Authentication**:
   - **Sign In / Providers → Email**: desactiva **Allow new users to sign up** → Save.
   - **Multi-Factor**: confirma que **TOTP (App Authenticator)** esté activado → Save.

Para volver a revisar en el futuro, corre [`supabase/1-verificar.sql`](supabase/1-verificar.sql)
(solo lee, no cambia nada).

---

## Paso 2 · Instalar la app en un teléfono Android (5 minutos)

1. En el teléfono o computadora, entra a **github.com** con tu cuenta.
2. Ve a tu repositorio **jac-seguros-crm** → pestaña **Actions**.
3. Haz clic en la ejecución más reciente que diga **App móvil** con ✅ verde.
4. Baja hasta **Artifacts** y descarga **JAC-Seguros-android** (es un .zip).
5. Abre el .zip: adentro está **JAC-Seguros.apk**. Pásalo al teléfono (WhatsApp a ti
   misma, Google Drive o cable).
6. En el teléfono toca el archivo **JAC-Seguros.apk**.
   - Si pide permiso para **instalar apps de origen desconocido**, acéptalo solo para
     esa vez (Chrome / Archivos / Drive, según desde dónde lo abriste).
7. Toca **Instalar**. Si aparece **Play Protect**, elige **Instalar de todos modos**
   (pasa porque la app no viene de la tienda; es tu app).
8. Aparece el ícono **JAC Seguros**. ✅

> El teléfono **debe tener bloqueo de pantalla** (PIN, huella o rostro). Sin eso la app no abre:
> es una medida de seguridad.

---

## Paso 3 · Primer uso (3 minutos)

1. Abre la app y entra con **el mismo correo y contraseña del CRM**.
2. Ve a **Más → Ajustes y seguridad**:
   - **Activar verificación en dos pasos**: instala *Google Authenticator* o
     *Microsoft Authenticator* en el teléfono, escanea el código que muestra la app (o
     copia la clave) y escribe el número de 6 dígitos. A partir de ahí, cada vez que
     inicies sesión en la app te pedirá ese número. (El CRM web todavía no lo pide.)
   - **Activar avisos diarios**: acepta las notificaciones. Cada día a las 8:00 te
     dice cuántas pólizas vencen, tareas del día y prospectos por llamar.
3. Cierra la app y vuelve a abrirla: te pedirá huella o Face ID. ✅

---

## Paso 4 · Llave oficial de Android (5 minutos, recomendado)

Sin este paso la app funciona, pero cada vez que quieras instalar una versión nueva
tendrás que **desinstalar la anterior**. Con la llave oficial se actualiza encima, y
es la que necesitarás para publicarla en Google Play.

1. Abre el archivo **LLAVE-ANDROID-JAC-PRIVADO.txt** que te mandé en el chat.
   **Guárdalo en un lugar privado** (por ejemplo una carpeta privada de Google Drive).
2. En GitHub: repositorio **jac-seguros-crm** → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**.
3. Crea el primer secreto:
   - Name: `ANDROID_KEYSTORE_PASSWORD`
   - Secret: la contraseña que está en el archivo.
   - **Add secret**.
4. Crea el segundo:
   - Name: `ANDROID_KEYSTORE_B64`
   - Secret: el bloque largo de letras del archivo (cópialo completo).
   - **Add secret**.
5. Ve a **Actions**, abre la última ejecución de **App móvil** y pulsa
   **Re-run all jobs**. Cuando termine, descarga el APK como en el Paso 2.
6. Desinstala la versión que tenías e instala esta. Desde ahora las nuevas versiones se instalan encima. ✅

---

## Paso 5 · Darle la app a tu equipo

Hoy las reglas de la base dejan entrar **solo a tu usuario**. Para sumar a alguien:

1. Créale su usuario en Supabase → **Authentication → Users → Add user**.
2. Pide que te preparen el cambio de reglas con su correo (es el script
   [`supabase/2-proteger.sql`](supabase/2-proteger.sql) con los correos del equipo).
   **No lo corras sin revisarlo antes**: cambia quién puede ver los datos.
3. Envíale el archivo **JAC-Seguros.apk** y esta guía (Pasos 2 y 3).

**Si pierdes el teléfono:** en Supabase → Authentication → Users, cambia tu contraseña.
La app pide huella o PIN para abrirse, así que nadie más puede usarla.

---

## Paso 6 · iPhone (cuando lo necesites)

Apple no permite instalar apps fuera de su sistema. Hace falta:

1. Una cuenta **Apple Developer** (USD 99 al año): https://developer.apple.com/programs/enroll
   — inscríbete como organización si JAC Seguros tiene RUC (pide número D-U-N-S, es gratis).
2. Cuando la tengas, avísame: dejo la publicación automática a **TestFlight** (la app
   oficial de Apple para repartir apps al equipo sin que salgan en la tienda pública).

El proyecto de iPhone ya está listo y GitHub comprueba en cada cambio que compila.

---

## Paso 7 · Publicar en Google Play (opcional)

Solo si quieres instalarla desde la tienda en vez de con el archivo:

1. Crea una cuenta en https://play.google.com/console (USD 25, un solo pago).
2. **Crear app** → nombre "JAC Seguros", idioma español.
3. **Pruebas → Prueba interna** → sube el archivo **JAC-Seguros-GooglePlay.aab** (viene
   en el mismo .zip del Paso 2, ya con la llave oficial del Paso 4).
4. Agrega los correos Gmail de tu equipo como testers. Ellos instalan desde Play Store y
   reciben las actualizaciones solos. No queda pública.

---

## Preguntas rápidas

| Pasa esto | Haz esto |
|---|---|
| "Correo o contraseña incorrectos" | Usa los mismos datos del CRM web. Tras 3 fallos hay que esperar unos segundos. |
| "Tu teléfono no tiene bloqueo de pantalla" | Ajustes del teléfono → Seguridad → configura PIN o huella. |
| "No se pudo conectar con el CRM" | Revisa internet y toca el botón ↻ arriba a la derecha. |
| "No tienes permiso" | Ese usuario no está autorizado en la base (ver Paso 5). |
| No veo un cambio que hice en la web | Toca ↻ en la app. |
| No veo en la web un cambio que hice en la app | Recarga la página del CRM web. |
| Perdí el teléfono | Supabase → Authentication → Users → cambia tu contraseña. La app pide huella o PIN, así que nadie puede abrirla. |
