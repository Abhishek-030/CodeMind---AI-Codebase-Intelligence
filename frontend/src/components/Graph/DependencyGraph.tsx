import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphEdge } from '../../types';

interface Props {
  data: GraphData | null;
}

interface SimNode extends d3.SimulationNodeDatum, GraphNode {
  x: number;
  y: number;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
}

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6',
  javascript: '#f59e0b',
  typescript: '#06b6d4',
  java: '#f97316',
  go: '#10b981',
  rust: '#ef4444',
  cpp: '#8b5cf6',
  c: '#a855f7',
  default: '#94a3b8',
};

function getLangColor(lang: string): string {
  return LANG_COLORS[lang?.toLowerCase()] ?? LANG_COLORS.default;
}

export default function DependencyGraph({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [search, setSearch] = useState('');
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);

  const buildGraph = useCallback(() => {
    if (!data || !svgRef.current || !wrapperRef.current) return;

    const { width, height } = wrapperRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Filter nodes based on search
    const q = search.toLowerCase();
    const filteredNodes = q
      ? data.nodes.filter(n => n.label.toLowerCase().includes(q))
      : data.nodes;
    const filteredIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = data.edges.filter(
      e => filteredIds.has(e.source as string) && filteredIds.has(e.target as string)
    );

    if (filteredNodes.length === 0) return;

    // Prepare simulation data
    const nodes: SimNode[] = filteredNodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const links: SimEdge[] = filteredEdges
      .map(e => ({
        source: nodeMap.get(e.source as string)!,
        target: nodeMap.get(e.target as string)!,
      }))
      .filter(e => e.source && e.target);

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    const g = svg.append('g');

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(255,255,255,0.15)');

    // Draw edges
    const link = g.append('g').selectAll<SVGLineElement, SimEdge>('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrow)');

    // Node size based on centrality/degree
    const nodeRadius = (n: SimNode) => {
      const base = 6;
      const bonus = Math.min((n.in_degree + n.out_degree) * 1.5, 14);
      return base + bonus;
    };

    // Draw nodes
    const node = g.append('g').selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseenter', (event: MouseEvent, d: SimNode) => {
        const rect = wrapperRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          node: d,
        });
      })
      .on('mouseleave', () => setTooltip(null));

    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', (d: SimNode) => getLangColor(d.language))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d: SimNode) => getLangColor(d.language))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    // Glow for high-centrality nodes
    node.filter((d: SimNode) => d.centrality > 0.1)
      .append('circle')
      .attr('r', (d: SimNode) => nodeRadius(d) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d: SimNode) => getLangColor(d.language))
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3);

    // Labels for larger nodes
    node.filter((d: SimNode) => nodeRadius(d) > 10 || filteredNodes.length < 50)
      .append('text')
      .attr('dy', (d: SimNode) => nodeRadius(d) + 11)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d: SimNode) => d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label);

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(links).id(d => d.id).distance(80).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(d => nodeRadius(d) + 8))
      .on('tick', () => {
        link
          .attr('x1', d => (d.source as SimNode).x)
          .attr('y1', d => (d.source as SimNode).y)
          .attr('x2', d => (d.target as SimNode).x)
          .attr('y2', d => (d.target as SimNode).y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;

    return () => { simulation.stop(); };
  }, [data, search]);

  useEffect(() => {
    const cleanup = buildGraph();
    return cleanup;
  }, [buildGraph]);

  const langCounts = data
    ? Object.entries(
        data.nodes.reduce<Record<string, number>>((acc, n) => {
          const lang = n.language || 'unknown';
          acc[lang] = (acc[lang] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  return (
    <div className="graph-container">
      <div className="graph-toolbar">
        {data && (
          <>
            <div className="graph-stats">
              <span className="graph-stat">
                <span>{data.stats.node_count}</span> nodes
              </span>
              <span className="graph-stat">
                <span>{data.stats.edge_count}</span> edges
              </span>
            </div>
            <input
              className="glass-input"
              style={{ width: 200, fontSize: 12 }}
              placeholder="Filter nodes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="graph-legend">
              {langCounts.map(([lang, count]) => (
                <div key={lang} className="legend-item">
                  <div
                    className="legend-dot"
                    style={{ background: getLangColor(lang) }}
                  />
                  {lang} ({count})
                </div>
              ))}
            </div>
          </>
        )}
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            if (svgRef.current) {
              const svg = d3.select(svgRef.current);
              svg.transition().duration(500).call(
                (d3.zoom<SVGSVGElement, unknown>() as d3.ZoomBehavior<SVGSVGElement, unknown>).transform,
                d3.zoomIdentity
              );
            }
          }}
        >
          ⟲ Reset View
        </button>
      </div>

      <div className="graph-canvas-wrapper" ref={wrapperRef}>
        {!data ? (
          <div className="graph-no-data">
            <div style={{ fontSize: 40 }}>🕸️</div>
            <div>Loading dependency graph...</div>
            <div style={{ fontSize: 12 }}>This may take a moment for large codebases</div>
          </div>
        ) : data.nodes.length === 0 ? (
          <div className="graph-no-data">
            <div style={{ fontSize: 40 }}>📭</div>
            <div>No graph data available</div>
          </div>
        ) : (
          <svg ref={svgRef} className="graph-svg" />
        )}

        {tooltip && (
          <div
            className="graph-tooltip"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              transform: tooltip.x > (wrapperRef.current?.offsetWidth ?? 600) - 260
                ? 'translateX(-100%) translateX(-24px)'
                : 'none',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {tooltip.node.label}
            </div>
            <div style={{ color: getLangColor(tooltip.node.language), fontSize: 11, marginBottom: 4 }}>
              {tooltip.node.language}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>In: <strong style={{ color: 'var(--text-secondary)' }}>{tooltip.node.in_degree}</strong></span>
              <span>Out: <strong style={{ color: 'var(--text-secondary)' }}>{tooltip.node.out_degree}</strong></span>
              <span>Centrality: <strong style={{ color: 'var(--text-secondary)' }}>{tooltip.node.centrality.toFixed(3)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
