'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutTemplate
} from 'lucide-react';
import type { RalphTask } from '@/lib/plan-utils';

export interface DependencyGraphProps {
  tasks: RalphTask[];
  planId: string;
  className?: string;
}

// Task status type for visualization (inferred from task context or default to pending)
type TaskStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

/**
 * DependencyGraph Component
 *
 * Displays an interactive dependency graph using React Flow:
 * - Tasks as nodes (color-coded by status)
 * - Dependencies as directed edges
 * - Click node to navigate to task detail
 * - Zoom, pan, and auto-layout controls
 * - Legend showing status colors
 */
export function DependencyGraph({ tasks, planId, className }: DependencyGraphProps) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isAutoLayout, setIsAutoLayout] = useState(false);

  // Get task status (default to pending for now, could be enhanced with actual execution data)
  const getTaskStatus = useCallback((taskId: string): TaskStatus => {
    // For now, all tasks are pending - this would be enhanced with real execution status
    return 'pending';
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: TaskStatus): { bg: string; border: string; text: string } => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-50 dark:bg-green-950',
          border: 'border-green-500',
          text: 'text-green-700 dark:text-green-300',
        };
      case 'in_progress':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950',
          border: 'border-yellow-500',
          text: 'text-yellow-700 dark:text-yellow-300',
        };
      case 'failed':
        return {
          bg: 'bg-red-50 dark:bg-red-950',
          border: 'border-red-500',
          text: 'text-red-700 dark:text-red-300',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900',
          border: 'border-gray-400',
          text: 'text-gray-700 dark:text-gray-300',
        };
    }
  }, []);

  // Generate nodes from tasks
  const initialNodes: Node[] = useMemo(() => {
    return tasks.map((task) => {
      const status = getTaskStatus(task.id);
      const colors = getStatusColor(status);

      return {
        id: task.id,
        type: 'default',
        data: {
          label: (
            <div className="p-2 min-w-[140px] sm:min-w-[180px]">
              <div className="font-semibold text-xs sm:text-sm mb-1">{task.id}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground dark:text-gray-400 line-clamp-2">
                {task.title}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                {status === 'in_progress' && <Clock className="h-3 w-3 text-yellow-500" />}
                {status === 'failed' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                {status === 'pending' && <Circle className="h-3 w-3 text-gray-400" />}
                <span className={`text-[10px] sm:text-xs capitalize ${colors.text}`}>
                  {status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ),
          taskId: task.id,
          status,
        },
        position: { x: 0, y: 0 },
        style: {
          background: 'hsl(var(--card))',
          border: `2px solid ${status === 'completed' ? '#22c55e' : status === 'in_progress' ? '#eab308' : status === 'failed' ? '#ef4444' : '#9ca3af'}`,
          borderRadius: '8px',
          padding: '0',
          minWidth: '160px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        className: `${colors.bg} dark:[&:hover]:shadow-lg transition-shadow`,
      };
    });
  }, [tasks, getTaskStatus, getStatusColor]);

  // Generate edges from dependencies
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    tasks.forEach((task) => {
      task.dependencies.forEach((depId) => {
        // Verify dependency exists
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          edges.push({
            id: `${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: 'smoothstep',
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'hsl(var(--muted-foreground) / 0.5)',
            },
            style: {
              stroke: 'hsl(var(--muted-foreground) / 0.5)',
              strokeWidth: 2,
            },
            className: 'dark:stroke-gray-500/50 transition-colors',
          });
        }
      });
    });

    return edges;
  }, [tasks]);

  // Initialize nodes and edges
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Apply Dagre layout algorithm
  const applyDagreLayout = useCallback(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configure layout - responsive based on viewport
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    dagreGraph.setGraph({
      rankdir: 'TB', // Top to Bottom
      nodesep: isMobile ? 40 : 80, // Horizontal spacing
      ranksep: isMobile ? 80 : 120, // Vertical spacing
      edgesep: isMobile ? 20 : 40,
    });

    // Add nodes to graph
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: isMobile ? 160 : 220, height: isMobile ? 80 : 100 });
    });

    // Add edges to graph
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate positions
    dagre.layout(dagreGraph);

    // Update node positions
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
      };
    });

    setNodes(layoutedNodes);
    setIsAutoLayout(true);
  }, [nodes, edges, setNodes]);

  // Handle new connections (though we don't allow creating new edges)
  const onConnect = useCallback(
    (params: Connection) => {
      // We don't allow creating new edges in this view
      return;
    },
    []
  );

  // Handle node click - navigate to task detail
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const taskId = node.data.taskId;
      router.push(`/plan/${planId}?task=${taskId}`);
    },
    [planId, router]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);

  // Apply layout on mount
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0 && !isAutoLayout) {
      // Small delay to ensure ReactFlow is mounted
      const timer = setTimeout(() => {
        applyDagreLayout();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, isAutoLayout, applyDagreLayout]);

  return (
    <div className={`w-full h-[400px] sm:h-[500px] lg:h-[600px] relative ${className || ''}`} data-testid="dependency-graph">
      {/* Controls Bar */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 flex items-center gap-1 sm:gap-2 bg-card dark:bg-gray-800 rounded-lg shadow-lg p-1 sm:p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={applyDagreLayout}
          title="Auto Layout"
          className="h-7 w-7 sm:h-auto sm:w-auto px-1 sm:px-2"
        >
          <LayoutTemplate className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline ml-1 sm:ml-2">Layout</span>
        </Button>
        <div className="w-px h-4 sm:h-6 bg-border dark:bg-gray-700" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In"
          className="h-7 w-7 sm:h-auto sm:w-auto px-1 sm:px-2"
        >
          <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline ml-1 sm:ml-2">In</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="h-7 w-7 sm:h-auto sm:w-auto px-1 sm:px-2"
        >
          <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline ml-1 sm:ml-2">Out</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitView}
          title="Fit View"
          className="h-7 w-7 sm:h-auto sm:w-auto px-1 sm:px-2"
        >
          <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline ml-1 sm:ml-2">Fit</span>
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 z-10 bg-card dark:bg-gray-800 rounded-lg shadow-lg p-2 sm:p-4 max-w-[150px] sm:max-w-none">
        <h4 className="text-[10px] sm:text-xs font-semibold mb-1.5 sm:mb-2 text-foreground">Status</h4>
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-500" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Done</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-yellow-500" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-gray-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-500" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Failed</span>
          </div>
        </div>
      </div>

      {/* React Flow Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
        className="bg-muted dark:bg-gray-900"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data.status as TaskStatus;
            switch (status) {
              case 'completed':
                return '#22c55e';
              case 'in_progress':
                return '#eab308';
              case 'failed':
                return '#ef4444';
              default:
                return '#9ca3af';
            }
          }}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="hidden sm:block"
        />
      </ReactFlow>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted dark:bg-gray-900">
          <div className="text-center px-4">
            <p className="text-base sm:text-lg text-muted-foreground">No tasks to display</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add tasks to see the dependency graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DependencyGraph;
