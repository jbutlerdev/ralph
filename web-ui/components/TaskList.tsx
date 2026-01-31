'use client';

import { useState, useMemo } from 'react';
import { TaskItem } from './TaskItem';
import { TaskDetail } from './TaskDetail';
import { TaskLogs } from './TaskLogs';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { RalphTask } from '@/lib/ralph/types';
import type { TaskWithStatus, RuntimeTaskStatus } from './PlanDetail';

export type TaskFilter = 'all' | 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';
export type TaskSortBy = 'id' | 'priority' | 'status' | 'dependencies';

export interface TaskListProps {
  tasks: TaskWithStatus[];
  className?: string;
  onToggleComplete?: (taskId: string) => Promise<void>;
  togglingTasks?: Set<string>;
  planId?: string; // Plan ID for fetching logs
}

// Status priority for sorting
const statusPriority: Record<RuntimeTaskStatus, number> = {
  'in-progress': 0,
  'blocked': 1,
  'failed': 2,
  'pending': 3,
  'completed': 4,
};

// Status display names
const statusDisplayNames: Record<TaskFilter, string> = {
  'all': 'All Tasks',
  'pending': 'Pending',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'blocked': 'Blocked',
  'failed': 'Failed',
};

/**
 * TaskList component
 *
 * Displays a list of tasks with:
 * - Filter by status (All, Pending, In Progress, Completed)
 * - Sort by ID, priority, status, or dependencies
 * - Configurable display options
 * - Click to view task details in modal
 */
export function TaskList({ tasks, className, onToggleComplete, togglingTasks, planId }: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sortBy, setSortBy] = useState<TaskSortBy>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showAcceptanceCriteria, setShowAcceptanceCriteria] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  // Priority order for sorting (memoized as it's used in useMemo)
  const priorityOrder = useMemo(() => ({ high: 0, medium: 1, low: 2 }), []);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply filter based on runtime status
    if (filter !== 'all') {
      filtered = filtered.filter(task => task.runtimeStatus === filter);
    }

    // Apply sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'priority':
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'dependencies':
          comparison = a.dependencies.length - b.dependencies.length;
          break;
        case 'status':
          comparison = statusPriority[a.runtimeStatus] - statusPriority[b.runtimeStatus];
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [tasks, filter, sortBy, sortOrder, priorityOrder]);

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleTaskClick = (task: TaskWithStatus) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleNavigateToTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Don't clear selectedTask immediately to avoid flicker during close animation
    setTimeout(() => setSelectedTask(null), 200);
  };

  return (
    <div className={className}>
      {/* Controls */}
      <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs sm:text-sm font-medium text-muted-foreground">Filter:</label>
          <Select value={filter} onValueChange={(value: TaskFilter) => setFilter(value)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs sm:text-sm font-medium text-muted-foreground">Sort:</label>
          <Select value={sortBy} onValueChange={(value: TaskSortBy) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="dependencies">Dependencies</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleSortOrder} className="shrink-0">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        {/* Display Options */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <Button
            variant={showDescriptions ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDescriptions(!showDescriptions)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <span className="hidden xs:inline">Descriptions</span>
            <span className="xs:hidden">Desc</span>
          </Button>
          <Button
            variant={showAcceptanceCriteria ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAcceptanceCriteria(!showAcceptanceCriteria)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <span className="hidden xs:inline">Criteria</span>
            <span className="xs:hidden">Crit</span>
          </Button>
        </div>
      </div>

      {/* Task Count */}
      <div className="mb-4 text-xs sm:text-sm text-muted-foreground">
        Showing {filteredAndSortedTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </div>

      {/* Tasks Grid */}
      {filteredAndSortedTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No tasks match the current filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              showDescription={showDescriptions}
              showAcceptanceCriteria={showAcceptanceCriteria}
              onClick={() => handleTaskClick(task)}
              onToggleComplete={onToggleComplete}
              isToggling={togglingTasks?.has(task.id)}
              onViewLogs={() => {
                setSelectedTask(task);
                setLogsOpen(true);
              }}
              planId={planId}
            />
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          open={isModalOpen}
          onOpenChange={handleCloseModal}
          planTasks={tasks}
          onNavigateToTask={handleNavigateToTask}
          taskStatus={selectedTask.runtimeStatus === 'completed' ? 'completed' :
                     selectedTask.runtimeStatus === 'in-progress' ? 'in_progress' :
                     selectedTask.runtimeStatus === 'failed' ? 'failed' : 'pending'}
          planId={planId}
          onOpenLogs={() => setLogsOpen(true)}
        />
      )}

      {/* Task Logs Modal - rendered separately so it persists when TaskDetail closes */}
      {planId && selectedTask && (
        <TaskLogs
          planId={planId}
          taskId={selectedTask.id}
          open={logsOpen}
          onOpenChange={setLogsOpen}
        />
      )}
    </div>
  );
}
