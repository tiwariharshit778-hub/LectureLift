import { useMemo, useRef, useState } from 'react';
import { Minus, Network, Plus, RotateCcw } from 'lucide-react';
import type { MindMapNode, MindMapRecord } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/skeletons';
import { cn } from '@/lib/utils';

interface LayoutNode {
	path: string;
	topic: string;
	x: number;
	y: number;
	hasChildren: boolean;
	collapsed: boolean;
	depth: number;
}

interface LayoutLink {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const NODE_W = 170;
const NODE_H = 46;
const GAP_X = 220;
const GAP_Y = 64;

function layout(root: MindMapNode, collapsed: Set<string>) {
	const nodes: LayoutNode[] = [];
	const links: LayoutLink[] = [];
	let row = 0;

	const walk = (node: MindMapNode, depth: number, path: string): number => {
		const children = Array.isArray(node.children) ? node.children : [];
		const isCollapsed = collapsed.has(path);
		const expandable = children.length > 0 && depth < 4;
		let y: number;

		if (!expandable || isCollapsed) {
			y = row * GAP_Y;
			row += 1;
		} else {
			const childYs = children.map((child, i) => walk(child, depth + 1, `${path}-${i}`));
			y = (childYs[0] + childYs[childYs.length - 1]) / 2;
			children.forEach((_, i) => {
				links.push({
					x1: depth * GAP_X + NODE_W,
					y1: y + NODE_H / 2,
					x2: (depth + 1) * GAP_X,
					y2: childYs[i] + NODE_H / 2,
				});
			});
		}

		nodes.push({
			path,
			topic: node.topic,
			x: depth * GAP_X,
			y,
			hasChildren: expandable,
			collapsed: isCollapsed,
			depth,
		});
		return y;
	};

	walk(root, 0, '0');
	return { nodes, links, height: row * GAP_Y };
}

export function MindMapTab({ mindMap }: { mindMap: MindMapRecord | null }) {
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [view, setView] = useState({ x: 30, y: 30, k: 1 });
	const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

	const root = mindMap?.structure && typeof mindMap.structure === 'object' ? mindMap.structure : null;
	const { nodes, links, height } = useMemo(
		() => (root ? layout(root, collapsed) : { nodes: [], links: [], height: 0 }),
		[root, collapsed],
	);

	if (!root) {
		return (
			<EmptyState
				icon={Network}
				title="No mind map available"
				body="A mind map could not be generated for this lecture. Try reprocessing it."
			/>
		);
	}

	const toggle = (path: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	};

	const zoom = (factor: number) =>
		setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.3, v.k * factor)) }));

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<p className="text-xs font-semibold text-muted-foreground">
					Drag to pan · scroll to zoom · click a node to expand or collapse
				</p>
				<div className="flex gap-1.5">
					<button onClick={() => zoom(1.2)} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 hover:bg-secondary">
						<Plus className="h-4 w-4" />
					</button>
					<button onClick={() => zoom(1 / 1.2)} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 hover:bg-secondary">
						<Minus className="h-4 w-4" />
					</button>
					<button onClick={() => setView({ x: 30, y: 30, k: 1 })} aria-label="Reset view" className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 hover:bg-secondary">
						<RotateCcw className="h-4 w-4" />
					</button>
				</div>
			</div>

			<div
				className="notebook-card relative h-[60vh] cursor-grab touch-none overflow-hidden active:cursor-grabbing"
				onPointerDown={(e) => {
					(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
					drag.current = { startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y };
				}}
				onPointerMove={(e) => {
					// Capture into a local instead of re-reading drag.current inside the
					// setView updater: React can invoke that updater after this handler
					// returns, and a pointerup in between resets drag.current to null —
					// the updater would then dereference null (a non-null assertion
					// silences TypeScript here but does nothing at runtime). A plain
					// local variable is a stable snapshot the updater closes over, so
					// it can't be affected by drag.current changing later.
					const start = drag.current;
					if (!start) return;
					setView((v) => ({
						...v,
						x: start.baseX + (e.clientX - start.startX),
						y: start.baseY + (e.clientY - start.startY),
					}));
				}}
				onPointerUp={() => {
					drag.current = null;
				}}
				onWheel={(e) => zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08)}
			>
				<div
					className="absolute left-0 top-0 origin-top-left"
					style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
				>
					<svg
						className="absolute left-0 top-0 overflow-visible"
						width={GAP_X * 5}
						height={Math.max(height, 200)}
					>
						{links.map((link, i) => (
							<path
								key={i}
								d={`M ${link.x1} ${link.y1} C ${link.x1 + 60} ${link.y1}, ${link.x2 - 60} ${link.y2}, ${link.x2} ${link.y2}`}
								fill="none"
								stroke="#1E1E24"
								strokeOpacity="0.25"
								strokeWidth="2"
							/>
						))}
					</svg>
					{nodes.map((node) => (
						<button
							key={node.path}
							onClick={() => node.hasChildren && toggle(node.path)}
							className={cn(
								'absolute flex items-center justify-center rounded-xl border px-3 text-center text-xs font-bold leading-tight transition-colors',
								node.depth === 0
									? 'border-foreground bg-foreground text-background shadow-[0_3px_0_0_rgba(30,30,36,0.3)]'
									: 'border-foreground/20 bg-card hover:bg-secondary',
							)}
							style={{
								left: node.x,
								top: node.y,
								width: NODE_W,
								minHeight: NODE_H,
								padding: '8px 12px',
							}}
						>
							<span className="line-clamp-2">{node.topic}</span>
							{node.hasChildren ? (
								<span
									className={cn(
										'absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-extrabold',
										node.depth === 0 ? 'border-foreground bg-background text-foreground' : 'border-foreground/30 bg-foreground text-background',
									)}
								>
									{node.collapsed ? '+' : '−'}
								</span>
							) : null}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
