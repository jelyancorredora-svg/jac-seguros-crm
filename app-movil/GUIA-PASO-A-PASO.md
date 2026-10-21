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

## Paso 2 · Instalar en tu iPhone con tu Mac (gratis, 30–60 minutos la primera vez)

Esta forma es gratis, pero **la app dura 7 días** en el iPhone. Luego se repiten
los puntos 9 y 10 (2 minutos). Para que dure un año y llegue sola, ver el Paso 4.

**Necesitas:** tu Mac, tu iPhone y el cable para conectarlos.

### En la Mac (solo la primera vez)

1. Abre la **App Store** de la Mac, busca **Xcode** e instálalo (es gratis; pesa mucho y
   tarda un rato). Ábrelo una vez y acepta lo que te pida.
2. Entra a **https://nodejs.org/es/download**, descarga el instalador para macOS
   (versión **LTS**) e instálalo como cualquier programa.
3. Descarga el código de la app:
   **https://github.com/jelyancorredora-svg/jac-seguros-crm/archive/refs/heads/claude/app-movil.zip**
   Se descarga un .zip; ábrelo con doble clic. Queda una carpeta
   `jac-seguros-crm-claude-app-movil` en **Descargas**.
4. Abre la app **Terminal** (Cmd + Espacio, escribe *Terminal*, Enter).
5. Copia y pega esta línea en Terminal y pulsa **Enter**:
   ```
   bash ~/Downloads/jac-seguros-crm-claude-app-movil/app-movil/instalar-iphone.command
   ```
   (Si tu Mac está en español y la carpeta se llama *Descargas*, igual funciona: es la misma.)
   Espera a que diga **✅ Listo**. Se abre Xcode solo.

### En Xcode

6. Menú **Xcode → Settings… → Accounts** → botón **+** → **Apple ID** → entra con tu
   Apple ID (el mismo del iPhone). Cierra esa ventana.
7. A la izquierda haz clic en **App** (el ícono azul de arriba). En el centro elige la
   pestaña **Signing & Capabilities**:
   - Marca **Automatically manage signing**.
   - En **Team** elige tu nombre (*Personal Team*).
   - Si sale un error rojo sobre el *Bundle Identifier*, cámbialo a
     `com.jacsegurospa.app.` + tus iniciales (ej. `com.jacsegurospa.app.jc`).

### En el iPhone

8. Conecta el iPhone a la Mac con el cable. Si pregunta **¿Confiar en esta computadora?**, toca **Confiar**.
9. Activa el **Modo desarrollador**: Ajustes → **Privacidad y seguridad** → **Modo de
   desarrollador** (abajo del todo) → activar → el iPhone se reinicia → confirma **Activar**.
   (Si no aparece la opción, haz primero el punto 10 y vuelve aquí.)
10. En Xcode, arriba en el centro, elige tu iPhone en la lista de dispositivos y pulsa
    el botón **▶** (Play). La primera vez tarda unos minutos.
11. Si en el iPhone sale **"Desarrollador no confiable"**: Ajustes → **General** →
    **VPN y gestión de dispositivos** → toca tu Apple ID → **Confiar**.
12. Abre **JAC Seguros** en el iPhone. ✅

**Cuando pasen los 7 días** y la app no abra: conecta el iPhone, abre Xcode
(Archivo → Abrir recientes → App) y pulsa **▶** otra vez.

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
3. Cierra la app y vuelve a abrirla: te pedirá Face ID. ✅

---

## Paso 4 · Que la app dure un año y llegue sola (USD 99/año, recomendado)

Con una cuenta de Apple Developer ya no necesitas cable ni Xcode: instalas la app
desde **TestFlight** (app oficial de Apple) y las actualizaciones llegan solas.
También sirve para darle la app a tu equipo sin publicarla en la App Store.

1. Entra a **https://developer.apple.com/programs/enroll** con tu Apple ID.
2. Inscríbete:
   - **Como persona (Individual):** lo más rápido (1–2 días). Pagas con tarjeta.
   - **Como empresa (Organization):** sale el nombre "JAC Seguros" en vez del tuyo, pero
     pide número **D-U-N-S** (gratis, tarda 1–2 semanas).
3. Cuando Apple te confirme por correo, **avísame**. Te diré exactamente qué crear en
   App Store Connect (una "llave de API", 5 minutos) y dejo GitHub subiendo la app a
   TestFlight automáticamente.

---

## Paso 5 · Darle la app a tu equipo

Hoy las reglas de la base dejan entrar **solo a tu usuario**. Para sumar a alguien:

1. Créale su usuario en Supabase → **Authentication → Users → Add user**.
2. Pide que te preparen el cambio de reglas con su correo (es el script
   [`supabase/2-proteger.sql`](supabase/2-proteger.sql) con los correos del equipo).
   **No lo corras sin revisarlo antes**: cambia quién puede ver los datos.
3. Invítala por TestFlight (Paso 4) o, si tiene Android, mándale el APK (Anexo).

**Si pierdes el teléfono:** en Supabase → Authentication → Users, cambia tu contraseña.
La app pide Face ID o código para abrirse, así que nadie más puede usarla.

---

## Anexo · Android (por si alguien del equipo tiene Android)

### Instalar en Android

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

### Llave oficial de Android

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
   **Re-run all jobs**. Cuando termine, descarga el APK como arriba.
6. Desinstala la versión que tenías e instala esta. Desde ahora las nuevas versiones se instalan encima. ✅

---

### Publicar en Google Play (opcional)

Solo si quieres instalarla desde la tienda en vez de con el archivo:

1. Crea una cuenta en https://play.google.com/console (USD 25, un solo pago).
2. **Crear app** → nombre "JAC Seguros", idioma español.
3. **Pruebas → Prueba interna** → sube el archivo **JAC-Seguros-GooglePlay.aab** (viene
   en el mismo .zip, ya con la llave oficial).
4. Agrega los correos Gmail de tu equipo como testers. Ellos instalan desde Play Store y
   reciben las actualizaciones solos. No queda pública.

---

---

## Preguntas rápidas

| Pasa esto | Haz esto |
|---|---|
| "Correo o contraseña incorrectos" | Usa los mismos datos del CRM web. Tras 3 fallos hay que esperar unos segundos. |
| "Tu teléfono no tiene bloqueo de pantalla" | Ajustes → Face ID y código → activa un código. |
| "No se pudo conectar con el CRM" | Revisa internet y toca el botón ↻ arriba a la derecha. |
| "No tienes permiso" | Ese usuario no está autorizado en la base (ver Paso 5). |
| No veo un cambio que hice en la web | Toca ↻ en la app. |
| No veo en la web un cambio que hice en la app | Recarga la página del CRM web. |
| Perdí el teléfono | Supabase → Authentication → Users → cambia tu contraseña. La app pide Face ID o código, así que nadie puede abrirla. |
| La app dejó de abrir (camino gratis) | Pasaron los 7 días: conecta el iPhone y pulsa ▶ en Xcode. |
| Terminal dice "No such file or directory" | El .zip no está descomprimido en Descargas. Ábrelo con doble clic y repite el punto 5. |
