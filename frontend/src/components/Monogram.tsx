/**
 * Monograma "RC" da marca, desenhado a partir do SVG oficial (svg-vetor/monograma-*.svg).
 * As linhas usam a cor do texto (`className="text-framboesa"`, por exemplo); o ponto tem cor própria.
 * Em fundo claro o arquivo oficial usa o ponto cacau; em fundo escuro, caramelo.
 */
export function Monogram({
  className = '',
  dotClassName = 'fill-cacau',
}: {
  className?: string;
  dotClassName?: string;
}) {
  // Espessuras do original (1,1 / 2 / 1,5), mas em pixels de tela ("non-scaling-stroke"): sem isso,
  // no tamanho do topo (36 px) as linhas encolheriam junto com o desenho para ~0,3 px e sumiriam.
  // Fica em cada linha porque essa propriedade não passa do grupo para os filhos.
  const line = { vectorEffect: 'non-scaling-stroke' } as const;

  return (
    <svg viewBox="0 0 140 150" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path
          {...line}
          strokeWidth="1.1"
          d="M110 38C98 22 84 16 66 16C36 16 14 44 14 78C14 112 38 140 66 140C90 140 108 128 118 110"
        />
        <path
          {...line}
          strokeWidth="2"
          d="M52 42V112M52 42C66 40 74 40 80 44C94 54 90 72 76 77C70 79 60 79 52 78"
        />
        <path {...line} strokeWidth="1.5" d="M68 78C78 92 90 108 106 126C112 133 124 134 130 126" />
      </g>
      <circle cx="113" cy="34" r="3.8" className={dotClassName} />
    </svg>
  );
}
