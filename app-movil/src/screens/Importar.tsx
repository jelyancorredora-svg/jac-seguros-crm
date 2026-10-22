import { useRef, useState } from 'react';
import { Vacio } from '../components/Piezas';
import { ErrorDatos } from '../lib/datos';
import { ejecutar, leerPaquete, planificar, type Paquete, type Paso } from '../lib/importar';
import type { Ctx } from './Modulos';

const NOMBRE: Record<string, string> = { clientes: 'Cliente', polizas: 'Póliza', vehiculos: 'Vehículo' };

export function Importar({ ctx }: { ctx: Ctx }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [plan, setPlan] = useState<Paso[] | null>(null);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState('');
  const [resultado, setResultado] = useState<string[] | null>(null);

  async function abrir(f: File | undefined) {
    setError(''); setResultado(null); setPlan(null);
    if (!f) return;
    if (f.size > 40 * 1024 * 1024) return setError('El archivo es demasiado grande.');
    try {
      const p = leerPaquete(await f.text());
      setPaquete(p);
      setPlan(planificar(p, ctx.cartera));
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo leer el archivo.');
    }
    if (entrada.current) entrada.current.value = '';
  }

  async function importar() {
    if (!plan) return;
    setError('');
    try {
      const r = await ejecutar(plan, ctx.cartera, ctx.poner, setProgreso);
      setResultado(r);
      setPlan(null);
      ctx.avisar('✓ Importación terminada');
    } catch (e) {
      setError((e instanceof ErrorDatos ? e.message : 'Se detuvo la importación.') + ' Lo que ya se guardó queda guardado; puedes volver a importar el mismo archivo y continuará sin duplicar.');
    } finally {
      setProgreso('');
    }
  }

  return (
    <>
      <div className="nota">
        Carga un paquete de importación (archivo <b>.json</b>) preparado a partir de tus documentos. Busca a cada cliente por
        cédula, cada póliza por número y cada vehículo por placa. Si ya existen, <b>solo completa lo que está vacío</b> y
        agrega los archivos que falten. Nada se guarda hasta que lo apruebes.
      </div>
      <input ref={entrada} type="file" hidden onChange={(e) => abrir(e.target.files?.[0])} />
      <button className="boton mas-abajo" type="button" disabled={!!progreso} onClick={() => entrada.current?.click()}>📂 Elegir archivo de importación</button>
      {error && <div className="error">{error}</div>}

      {plan && (
        <>
          {paquete?.descripcion && <p className="contador">{paquete.descripcion}</p>}
          <h3 className="seccion">Resumen antes de guardar</h3>
          {plan.length ? plan.map((p, i) => (
            <div key={i} className="tarjeta">
              <div className="ag-meta-cab">
                <b>{NOMBRE[p.modulo]}: {p.etiqueta}</b>
                <span className={`etiqueta ${p.existente ? 'e-info' : 'e-ok'}`}>{p.existente ? 'Ya existe' : 'Nuevo'}</span>
              </div>
              <p className="contador">
                {p.existente
                  ? Object.keys(p.campos).length ? `Se completan ${Object.keys(p.campos).length} campos vacíos: ${Object.keys(p.campos).join(', ')}` : 'No hay campos que completar.'
                  : `Se crea con ${Object.keys(p.campos).length} campos.`}
              </p>
              {p.archivos.length > 0 && <p className="contador">📎 Se suben: {p.archivos.map((a) => a.nombre).join(', ')}</p>}
              {p.omitidos.length > 0 && <p className="contador">Se omiten: {p.omitidos.join(', ')}</p>}
            </div>
          )) : <Vacio>El paquete está vacío.</Vacio>}
          <div className="botonera">
            <button className="boton" type="button" disabled={!!progreso || !plan.length} onClick={importar}>
              {progreso ? `Guardando… ${progreso}` : '✅ Aprobar e importar'}
            </button>
            <button className="boton secundario" type="button" disabled={!!progreso} onClick={() => setPlan(null)}>Cancelar</button>
          </div>
        </>
      )}

      {resultado && (
        <>
          <h3 className="seccion">Resultado</h3>
          <div className="tarjeta">{resultado.map((r, i) => <div key={i} className="contador">{r}</div>)}</div>
        </>
      )}
    </>
  );
}
