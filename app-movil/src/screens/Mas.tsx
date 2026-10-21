import { Icono, type NombreIcono } from '../components/Icono';
import { prospectoAbierto, siniestroAbierto, type Cartera } from '../lib/datos';
import type { Abrir, Vista } from '../App';

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function Mas({ cartera, abrir }: { cartera: Cartera; abrir: Abrir }) {
  const opciones: Array<[Vista, NombreIcono, string, string]> = [
    [{ tipo: 'siniestros' }, 'siniestros', 'Siniestros', cuantos(cartera.siniestros.filter(siniestroAbierto).length, 'abierto', 'abiertos')],
    [{ tipo: 'prospectos' }, 'embudo', 'Prospectos', cuantos(cartera.prospectos.filter(prospectoAbierto).length, 'en curso', 'en curso')],
    [{ tipo: 'ajustes' }, 'ajustes', 'Ajustes y seguridad', 'Avisos, dos pasos, contraseña, cerrar sesión'],
  ];
  return (
    <div className="lista menu">
      {opciones.map(([v, i, t, sub]) => (
        <button key={t} className="fila" type="button" onClick={() => abrir(v)}>
          <div className="avatar"><Icono nombre={i} /></div>
          <div className="fila-cuerpo">
            <div className="fila-titulo">{t}</div>
            <div className="fila-sub">{sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
