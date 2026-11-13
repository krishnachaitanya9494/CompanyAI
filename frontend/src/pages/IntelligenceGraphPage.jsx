/**
 * Phase 1 Recruitment Intelligence Graph Page.
 * Interactive SVG node-link graph connecting Candidates, Skills, Jobs, Clients, and Interviews
 * strictly from SQLite records, with search, filters, zoom/pan, node inspection, and evidence drill-down.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { intelligenceApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';
import { BlurText } from '../components/reactbits/BlurText';
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const NODE_COLORS = {
  client: { fill: '#4F46E5', stroke: '#818CF8', label: 'Client' },
  job: { fill: '#0284C7', stroke: '#38BDF8', label: 'Job' },
  skill: { fill: '#059669', stroke: '#34D399', label: 'Skill' },
  candidate: { fill: '#0F172A', stroke: '#94A3B8', label: 'Candidate' },
  interview: { fill: '#D97706', stroke: '#FBBF24', label: 'Interview' },
};

export const IntelligenceGraphPage = ({ onSelectCandidate, onSelectJob }) => {
  const [graph, setGraph] = useState({ nodes: [], edges: [], stats: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [skillFilter, setSkillFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);

  const loadGraph = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await intelligenceApi.getGraph({
        skill: skillFilter.trim() || undefined,
        client: clientFilter.trim() || undefined,
        limit_candidates: 24,
      });
      setGraph(res || { nodes: [], edges: [], stats: {} });
      setSelectedNodeId(null);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load Recruitment Intelligence Graph.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // Filter nodes & compute deterministic layered SVG coordinates (Client -> Job -> Skill -> Candidate -> Interview).
  const layout = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const visibleNodes = (graph.nodes || []).filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (q && !n.label.toLowerCase().includes(q)) return false;
      return true;
    });

    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = (graph.edges || []).filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    const columns = { client: 90, job: 260, skill: 460, candidate: 670, interview: 860 };
    const buckets = { client: [], job: [], skill: [], candidate: [], interview: [] };
    visibleNodes.forEach((n) => {
      if (buckets[n.type]) buckets[n.type].push(n);
    });

    const positioned = {};
    let maxHeight = 520;
    Object.entries(buckets).forEach(([t, list]) => {
      const gap = Math.max(40, Math.min(72, 460 / Math.max(list.length, 1)));
      const totalH = list.length * gap;
      if (totalH + 80 > maxHeight) maxHeight = totalH + 80;
      const startY = Math.max(50, (maxHeight - totalH) / 2);
      list.forEach((node, idx) => {
        positioned[node.id] = {
          ...node,
          x: columns[t] || 400,
          y: startY + idx * gap,
        };
      });
    });

    return {
      nodes: Object.values(positioned),
      edges: visibleEdges,
      byId: positioned,
      height: maxHeight,
    };
  }, [graph, searchTerm, typeFilter]);

  const selectedNode = selectedNodeId ? layout.byId[selectedNodeId] : null;
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return layout.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode, layout.edges]);

  const connectedEdgeIds = useMemo(
    () => new Set(connectedEdges.map((e) => e.id)),
    [connectedEdges]
  );

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-white tracking-tight flex items-center gap-2.5">
            <BlurText text="Recruitment Intelligence Graph" animateBy="words" delay={45} stepDuration={0.25} />
            <Badge variant="accent" size="xs">SQLite Provenance</Badge>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explore verified relationships across Clients, Jobs, Canonical Skills, Candidates, and Interviews
          </p>
        </div>
        <button
          onClick={loadGraph}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle btn-interactive"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reload Graph</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl card-reflective flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter visible nodes by name..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 focus:outline-none focus:border-accent-500"
          />
        </div>

        <input
          type="text"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          placeholder="Server skill filter (e.g. Java, Oracle)..."
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 focus:outline-none focus:border-accent-500"
        />

        <input
          type="text"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          placeholder="Client filter (e.g. Acme)..."
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 focus:outline-none focus:border-accent-500"
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 font-medium"
        >
          <option value="all">All Node Types</option>
          <option value="client">Clients</option>
          <option value="job">Jobs</option>
          <option value="skill">Skills</option>
          <option value="candidate">Candidates</option>
          <option value="interview">Interviews</option>
        </select>

        <button
          type="button"
          onClick={loadGraph}
          className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-xl shadow-subtle btn-interactive"
        >
          Apply Query
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Canvas + Node & Evidence Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive SVG Graph Canvas */}
        <div className="lg:col-span-8 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl card-reflective overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(NODE_COLORS).map(([k, cfg]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.fill }} />
                  {cfg.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <LatticeLoader label="Building relationship graph" pattern="orbit" grid={3} color="#4F46E5" cellSize={5} fontSize={12} />
            </div>
          ) : layout.nodes.length === 0 ? (
            <div className="h-[420px] flex flex-col items-center justify-center text-xs text-slate-400 p-8 text-center">
              <Network className="w-8 h-8 mb-2 text-slate-300" />
              <p>No graph nodes matched your current filters. Clear filters and click Apply Query.</p>
            </div>
          ) : (
            <div
              className="h-[520px] bg-dot-pattern relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
              onMouseDown={(e) => setDragging({ startX: e.clientX - pan.x, startY: e.clientY - pan.y })}
              onMouseMove={(e) => {
                if (dragging) setPan({ x: e.clientX - dragging.startX, y: e.clientY - dragging.startY });
              }}
              onMouseUp={() => setDragging(null)}
              onMouseLeave={() => setDragging(null)}
            >
              <svg viewBox={`0 0 960 ${layout.height}`} className="w-full h-full">
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {layout.edges.map((edge) => {
                    const src = layout.byId[edge.source];
                    const tgt = layout.byId[edge.target];
                    if (!src || !tgt) return null;
                    const highlighted = connectedEdgeIds.has(edge.id);
                    return (
                      <line
                        key={edge.id}
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke={highlighted ? '#4F46E5' : '#94A3B8'}
                        strokeWidth={highlighted ? 2.2 : 1}
                        strokeOpacity={selectedNode ? (highlighted ? 0.95 : 0.16) : 0.38}
                      />
                    );
                  })}

                  {layout.nodes.map((node) => {
                    const cfg = NODE_COLORS[node.type] || NODE_COLORS.skill;
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          r={isSelected ? 13 : 9}
                          fill={cfg.fill}
                          stroke={isSelected ? '#F59E0B' : cfg.stroke}
                          strokeWidth={isSelected ? 3 : 1.5}
                        />
                        <text
                          x={14}
                          y={4}
                          fontSize="11"
                          fontWeight={isSelected ? '700' : '500'}
                          fill="currentColor"
                          className="text-navy-900 dark:text-slate-100 pointer-events-none"
                        >
                          {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </div>

        {/* Right Side: Node Details & Relationship Evidence Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl card-reflective space-y-3">
            <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-600" />
              <span>Node & Evidence Inspector</span>
            </h3>

            {!selectedNode ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any node on the graph canvas to inspect its SQLite metadata, connected relationships, and drill down to the source record.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 space-y-1">
                  <Badge variant="accent" size="xs">{selectedNode.type.toUpperCase()}</Badge>
                  <div className="font-bold text-sm text-navy-900 dark:text-white mt-1">{selectedNode.label}</div>
                  {selectedNode.meta?.location && (
                    <div className="text-slate-500">Location: {selectedNode.meta.location}</div>
                  )}
                  {selectedNode.meta?.stage && (
                    <div className="text-slate-500">Stage: {selectedNode.meta.stage}</div>
                  )}
                </div>

                {selectedNode.type === 'candidate' && onSelectCandidate && (
                  <button
                    type="button"
                    onClick={() => onSelectCandidate(selectedNode.meta.candidate_id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-navy-900 dark:bg-brand-600 text-white font-semibold text-xs btn-interactive"
                  >
                    <span>Open Candidate Digital Twin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedNode.type === 'job' && onSelectJob && (
                  <button
                    type="button"
                    onClick={() => onSelectJob(selectedNode.meta.job_id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-semibold text-xs btn-interactive"
                  >
                    <span>Inspect Job Description</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Connected Relationships ({connectedEdges.length})
                  </span>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {connectedEdges.map((edge) => (
                      <div key={edge.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-surface-darkBorder space-y-0.5">
                        <div className="font-mono font-bold text-[10px] text-accent-700 dark:text-accent-400">
                          {edge.relationship_type}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">{edge.evidence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-bold text-navy-900 dark:text-white">Graph Telemetry</div>
            <div>Nodes rendered: <span className="font-mono font-semibold">{layout.nodes.length}</span></div>
            <div>Edges rendered: <span className="font-mono font-semibold">{layout.edges.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
