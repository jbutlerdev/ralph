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
            <div className="p-2 min-w-[180px]">
              <div className="font-semibold text-sm mb-1">{task.id}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {task.title}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                {status === 'in_progress' && <Clock className="h-3 w-3 text-yellow-500" />}
                {status === 'failed' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                {status === 'pending' && <Circle className="h-3 w-3 text-gray-400" />}
                <span className={`text-xs capitalize ${colors.text}`}>
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
          background: 'white',
          border: `2px solid ${status === 'completed' ? '#22c55e' : status === 'in_progress' ? '#eab308' : status === 'failed' ? '#ef4444' : '#9ca3af'}`,
          borderRadius: '8px',
          padding: '0',
          minWidth: '200px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        className: colors.bg,
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
              color: '#9ca3af',
            },
            style: {
              stroke: '#9ca3af',
              strokeWidth: 2,
            },
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

    // Configure layout
    dagreGraph.setGraph({
      rankdir: 'TB', // Top to Bottom
      nodesep: 80, // Horizontal spacing
      ranksep: 120, // Vertical spacing
      edgesep: 40,
    });

    // Add nodes to graph
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 220, height: 100 });
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
    <div className={`w-full h-[600px] relative ${className || ''}`}>
      {/* Controls Bar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={applyDagreLayout}
          title="Auto Layout"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitView}
          title="Fit View"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">Status Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span className="text-xs text-gray-700 dark:text-gray-300">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Failed</span>
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
        className="bg-gray-50 dark:bg-gray-900"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
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
        />
      </ReactFlow>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <p className="text-lg text-gray-600 dark:text-gray-400">No tasks to display</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Add tasks to see the dependency graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DependencyGraph;
