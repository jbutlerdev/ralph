'use client';

import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import type { RalphTask } from '@/lib/ralph/types';

interface DependencyGraphProps {
  tasks: RalphTask[];
  onNodeClick?: (taskId: string) => void;
}

// Status color mapping
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Implemented':
    case 'Verified':
      return '#22c55e'; // green-500
    case 'In Progress':
      return '#eab308'; // yellow-500
    case 'Needs Re-Work':
      return '#ef4444'; // red-500
    case 'To Do':
    default:
      return '#6b7280'; // gray-500
  }
};

const getStatusBgColor = (status: string): string => {
  switch (status) {
    case 'Implemented':
    case 'Verified':
      return '#dcfce7'; // green-100
    case 'In Progress':
      return '#fef9c3'; // yellow-100
    case 'Needs Re-Work':
      return '#fee2e2'; // red-100
    case 'To Do':
    default:
      return '#f3f4f6'; // gray-100
  }
};

// Custom node component
const TaskNode: React.FC<{ data: { task: RalphTask; onNodeClick: (taskId: string) => void } }> = ({ data }) => {
  const { task, onNodeClick } = data;
  const borderColor = getStatusColor(task.status);
  const bgColor = getStatusBgColor(task.status);

  return (
    <div
      onClick={() => onNodeClick(task.id)}
      className="px-4 py-2 rounded-lg shadow-md cursor-pointer transition-all hover:shadow-lg min-w-[150px]"
      style={{
        border: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
      }}
    >
      <div className="font-semibold text-sm text-gray-800">{task.title}</div>
      <div className="text-xs text-gray-600 mt-1">{task.id}</div>
      <div className="flex items-center gap-1 mt-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: borderColor }}
        />
        <span className="text-xs text-gray-500">{task.status}</span>
      </div>
    </div>
  );
};

const nodeTypes = {
  taskNode: TaskNode,
};

// Layout function using Dagre
const layoutNodes = (nodes: Node[], edges: Edge[], direction = 'TB'): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const laidOutNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 75,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: laidOutNodes, edges };
};

export default function DependencyGraph({ tasks, onNodeClick }: DependencyGraphProps) {
  const [autoLayout, setAutoLayout] = useState(false);

  // Convert tasks to nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = tasks.map((task) => ({
      id: task.id,
      type: 'taskNode',
      data: { task, onNodeClick: onNodeClick || (() => {}) },
      position: { x: 0, y: 0 },
    }));

    const edges: Edge[] = [];
    tasks.forEach((task) => {
      task.dependencies.forEach((depId) => {
        edges.push({
          id: `${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks, onNodeClick]);

  // Apply auto-layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return layoutNodes(initialNodes, initialEdges, 'TB');
  }, [initialNodes, initialEdges, autoLayout]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Re-apply layout when auto-layout is toggled
  const handleAutoLayout = useCallback(() => {
    const { nodes: newNodes } = layoutNodes(nodes, edges, 'TB');
    setNodes(newNodes);
    setAutoLayout(!autoLayout);
  }, [nodes, edges, autoLayout, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  // Update nodes when layouted nodes change
  React.useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        className="bg-gray-50"
      >
        <Background color="#94a3b8" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const task = node.data.task as RalphTask;
            return getStatusColor(task.status);
          }}
          className="!bg-white !border-gray-200"
        />
        <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <button
            onClick={handleAutoLayout}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Auto-Layout
          </button>
        </Panel>
        <Panel position="bottom-left" className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-2">Legend</div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600">Implemented/Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600">Needs Re-Work</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-gray-600">To Do</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
