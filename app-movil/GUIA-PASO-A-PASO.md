# Guía paso a paso — App JAC Seguros

Sigue los pasos en orden. Cada uno dice cuánto tarda y qué deberías ver al terminar.
No hace falta saber programar.

---

## Paso 1 · Proteger la base de datos (10 minutos) — EL MÁS IMPORTANTE

Hoy la clave de tu CRM está a la vista en el sitio web. Este paso hace que **solo tu
equipo** pueda ver los datos de los clientes, aunque alguien tenga esa clave.

1. Entra a **https://supabase.com/dashboard** con tu cuenta.
2. Abre el proyecto de tu CRM (el que termina en `xiogddofwmwfacmnsojg`).
3. En el menú de la izquierda, haz clic en **SQL Editor** (ícono `>_`).
4. Haz clic en **+ New query**.
5. **Primero, revisar:** abre el archivo
   [`supabase/1-verificar.sql`](supabase/1-verificar.sql) en GitHub, copia todo el texto,
   pégalo en Supabase y pulsa **Run**. Toma una captura del resultado (por si acaso).
6. **Ahora, proteger:** abre [`supabase/2-proteger.sql`](supabase/2-proteger.sql), cópialo y pégalo en una consulta nueva.
7. Busca la línea que dice `>>> CAMBIAR POR LOS CORREOS DEL EQUIPO <<<`. Debajo está tu correo.
   Si alguien más de tu equipo entra al CRM, agrega una línea por persona, así:
   ```sql
     ('jelyancorredora@gmail.com', 'Jelyan'),
     ('asistente@jacsegurospa.com', 'Asistente')
   ```
   (todas las líneas terminan en coma, menos la última).
8. Pulsa **Run**. Debe decir **Success**.
9. **Comprueba:** abre **crm.jacsegurospa.com**, entra y revisa que se vean tus clientes y pólizas.
   - ✅ Si todo carga: listo.
   - ❌ Si algo no carga: en Supabase, pega y corre [`supabase/3-revertir.sql`](supabase/3-revertir.sql)
     y avísame qué pantalla falló.
10. Todavía en Supabase, en el menú izquierdo ve a **Authentication**:
    - **Sign In / Providers → Email**: desactiva **Allow new users to sign up** → Save.
    - **Multi-Factor**: activa **TOTP (App Authenticator)** → Save.
    - **Policies / Passwords** (si aparece): mínimo 12 caracteres y activa
      **Leaked password protection**.

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
     inicies sesión te pedirá ese número. Esto protege también el CRM web.
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

1. Agrega su correo en Supabase (Paso 1, punto 7) y corre de nuevo solo este bloque en el SQL Editor:
   ```sql
   insert into public.equipo_autorizado (email, nombre) values ('correo@ejemplo.com', 'Nombre');
   ```
2. Créale su usuario en Supabase → **Authentication → Users → Add user**
   (con el registro público desactivado, solo tú puedes crear usuarios).
3. Envíale el archivo **JAC-Seguros.apk** y esta guía (Pasos 2 y 3).

**Si alguien deja el equipo o pierde el teléfono:** en Supabase → Authentication → Users,
bórralo o cámbiale la contraseña, y quita su correo de la lista:
```sql
delete from public.equipo_autorizado where email = 'correo@ejemplo.com';
```
Pierde el acceso de inmediato, también en el CRM web.

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
| "No tienes permiso" | Tu correo no está en la lista del Paso 1. Agrégalo. |
| No veo un cambio que hice en la web | Toca ↻ en la app. |
| No veo en la web un cambio que hice en la app | Recarga la página del CRM web. |
| Perdí el teléfono | Supabase → Authentication → Users → cambia tu contraseña. La app pide huella, así que nadie puede abrirla. |
