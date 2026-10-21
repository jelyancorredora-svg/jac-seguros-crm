/* Logo de JAC Seguros, copiado del CRM web (crm.jacsegurospa.com). */
export function Logo({ ancho = 210 }: { ancho?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width={ancho} role="img" aria-label="JAC Seguros">
      <line x1="6" y1="14" x2="254" y2="14" stroke="#9B9589" strokeWidth="3" />
      <line x1="6" y1="76" x2="254" y2="76" stroke="#9B9589" strokeWidth="3" />
      <text x="130" y="59" textAnchor="middle" fontFamily="Georgia, Gelasio, 'Times New Roman', serif"
        fontWeight="700" fontSize="44" fill="#0F172A" letterSpacing="6">JAC</text>
      <text x="130" y="73" textAnchor="middle" fontFamily="Outfit, Montserrat, Arial, sans-serif"
        fontWeight="400" fontSize="13" fill="#1D4ED8" letterSpacing="9">SEGUROS</text>
    </svg>
  );
}
