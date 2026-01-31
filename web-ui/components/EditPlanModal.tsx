'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  X,
  Plus,
  Trash2,
  Check,
  XCircle,
  Save,
  Edit3,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RalphTask, AcceptanceCriterion } from '@/lib/ralph/types';
import type { TaskStatus } from '@/lib/ralph/types';

export interface EditTaskData {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: TaskStatus;
  dependencies: string[];
  acceptanceCriteria: AcceptanceCriterion[];
}

interface PlanMetadata {
  name: string;
  description: string;
}

interface EditPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: RalphTask[];
  completedTaskIds?: Set<string>;
  planMetadata?: PlanMetadata;
  onSave: (tasks: RalphTask[], metadata?: PlanMetadata) => Promise<void>;
  loading?: boolean;
}

export function EditPlanModal({ open, onOpenChange, tasks, completedTaskIds = new Set<string>(), planMetadata, onSave, loading }: EditPlanModalProps) {
  const [editedTasks, setEditedTasks] = useState<RalphTask[]>(tasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<PlanMetadata>(planMetadata || { name: '', description: '' });

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setEditedTasks([...tasks]);
      setEditingTaskId(null);
      setEditedMetadata(planMetadata || { name: '', description: '' });
    }
  }, [open, tasks, planMetadata]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(editedTasks, editedMetadata);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addNewTask = () => {
    const newId = `task-${String(editedTasks.length + 1).padStart(3, '0')}`;
    const newTask: RalphTask = {
      id: newId,
      title: 'New Task',
      description: '',
      priority: 'medium',
      status: 'To Do',
      dependencies: [],
      acceptanceCriteria: [{ text: '', completed: false }],
    };
    setEditedTasks([...editedTasks, newTask]);
    setEditingTaskId(newId);
  };

  const updateTask = (taskId: string, updates: Partial<RalphTask>) => {
    setEditedTasks(
      editedTasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    // Check if any tasks depend on this one
    const dependents = editedTasks.filter((t) => t.dependencies.includes(taskId));
    if (dependents.length > 0) {
      alert(
        `Cannot delete task ${taskId} because ${dependents.map((t) => t.id).join(', ')} depend on it.`
      );
      return;
    }
    setEditedTasks(editedTasks.filter((task) => task.id !== taskId));
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
    }
  };

  const addCriterion = (taskId: string) => {
    const task = editedTasks.find((t) => t.id === taskId);
    if (task) {
      updateTask(taskId, {
        acceptanceCriteria: [...task.acceptanceCriteria, { text: '', completed: false }],
      });
    }
  };

  const updateCriterion = (taskId: string, index: number, value: string) => {
    const task = editedTasks.find((t) => t.id === taskId);
    if (task) {
      const newCriteria = [...task.acceptanceCriteria];
      newCriteria[index] = { ...newCriteria[index], text: value };
      updateTask(taskId, { acceptanceCriteria: newCriteria });
    }
  };

  const toggleCriterion = (taskId: string, index: number) => {
    const task = editedTasks.find((t) => t.id === taskId);
    if (task) {
      const newCriteria = [...task.acceptanceCriteria];
      const criterion = newCriteria[index];
      // Handle both object format and legacy string format
      if (typeof criterion === 'object') {
        newCriteria[index] = { ...criterion, completed: !criterion.completed };
      } else {
        newCriteria[index] = { text: String(criterion), completed: true };
      }
      updateTask(taskId, { acceptanceCriteria: newCriteria });
    }
  };

  const deleteCriterion = (taskId: string, index: number) => {
    const task = editedTasks.find((t) => t.id === taskId);
    if (task && task.acceptanceCriteria.length > 1) {
      const newCriteria = task.acceptanceCriteria.filter((_, i) => i !== index);
      updateTask(taskId, { acceptanceCriteria: newCriteria });
    }
  };

  const toggleDependency = (taskId: string, depTaskId: string) => {
    const task = editedTasks.find((t) => t.id === taskId);
    if (task) {
      if (task.dependencies.includes(depTaskId)) {
        updateTask(taskId, {
          dependencies: task.dependencies.filter((d) => d !== depTaskId),
        });
      } else {
        // Check for circular dependency
        if (wouldCreateCircularDependency(editedTasks, taskId, depTaskId)) {
          alert('This would create a circular dependency!');
          return;
        }
        updateTask(taskId, {
          dependencies: [...task.dependencies, depTaskId],
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
          <DialogDescription>
            Manage plan details, tasks, and acceptance criteria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Plan Metadata Section */}
          <div className="space-y-4 border-b pb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Plan Details
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="plan-name">Project Title</Label>
                <Input
                  id="plan-name"
                  value={editedMetadata.name}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, name: e.target.value })}
                  placeholder="Enter project title..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="plan-description">Description</Label>
                <Textarea
                  id="plan-description"
                  value={editedMetadata.description}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, description: e.target.value })}
                  placeholder="Enter project description..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tasks</h3>
            <Button onClick={addNewTask} className="w-full" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add New Task
            </Button>

            <div className="space-y-4">
            {editedTasks.map((task) => (
              <TaskEditor
                key={task.id}
                task={task}
                allTasks={editedTasks}
                isEditing={editingTaskId === task.id}
                completedTaskIds={completedTaskIds}
                onToggleEdit={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)}
                onUpdate={(updates) => updateTask(task.id, updates)}
                onDelete={() => deleteTask(task.id)}
                onAddCriterion={() => addCriterion(task.id)}
                onUpdateCriterion={(idx, value) => updateCriterion(task.id, idx, value)}
                onToggleCriterion={(idx) => toggleCriterion(task.id, idx)}
                onDeleteCriterion={(idx) => deleteCriterion(task.id, idx)}
                onToggleDependency={(depId) => toggleDependency(task.id, depId)}
              />
            ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TaskEditorProps {
  task: RalphTask;
  allTasks: RalphTask[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Partial<RalphTask>) => void;
  onDelete: () => void;
  onAddCriterion: () => void;
  onUpdateCriterion: (index: number, value: string) => void;
  onToggleCriterion: (index: number) => void;
  onDeleteCriterion: (index: number) => void;
  onToggleDependency: (depTaskId: string) => void;
  completedTaskIds?: Set<string>;
}

function TaskEditor({
  task,
  allTasks,
  isEditing,
  onToggleEdit,
  onUpdate,
  onDelete,
  onAddCriterion,
  onUpdateCriterion,
  onToggleCriterion,
  onDeleteCriterion,
  onToggleDependency,
  completedTaskIds = new Set<string>(),
}: TaskEditorProps) {
  // Display status is the plan file status (single source of truth)
  const displayStatus: RalphTask['status'] = task.status;

  const getPriorityColor = (priority: RalphTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Implemented':
      case 'Verified':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Needs Re-Work':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        isEditing ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {task.id}
              </span>
              <Input
                value={task.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="flex-1 min-w-[200px] font-medium"
                placeholder="Task title"
              />
              <Select
                value={task.priority}
                onValueChange={(value: any) => onUpdate({ priority: value })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={displayStatus}
                onValueChange={(value: TaskStatus) => onUpdate({ status: value })}
              >
                <SelectTrigger className={cn('w-[140px]', getStatusColor(displayStatus))}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="To Do">To Do</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Implemented">Implemented</SelectItem>
                  <SelectItem value="Needs Re-Work">Needs Re-Work</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={onToggleEdit}>
              {isEditing ? <XCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Description */}
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <Textarea
            value={task.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Task description..."
            rows={2}
            className="mt-1"
          />
        </div>

        {/* Dependencies */}
        <div>
          <Label className="text-sm font-medium">Dependencies</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {allTasks
              .filter((t) => t.id !== task.id)
              .map((depTask) => (
                <button
                  key={depTask.id}
                  type="button"
                  onClick={() => onToggleDependency(depTask.id)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border transition-colors flex items-center gap-1',
                    task.dependencies.includes(depTask.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {task.dependencies.includes(depTask.id) && (
                    <Check className="h-3 w-3" />
                  )}
                  {depTask.id}
                </button>
              ))}
          </div>
        </div>

        {/* Acceptance Criteria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Acceptance Criteria</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddCriterion}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {task.acceptanceCriteria.map((criterion, idx) => {
              // Handle both object format {text, completed} and legacy string format
              const criterionText = typeof criterion === 'object' ? criterion.text : criterion;
              const isCompleted = typeof criterion === 'object' ? criterion.completed : false;

              return (
                <div key={idx} className="flex items-start gap-2">
                  <div className="mt-2.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleCriterion(idx)}
                      className={cn(
                        'h-4 w-4 rounded border-2 transition-colors',
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                          : 'border-gray-300 hover:border-green-500'
                      )}
                    >
                      {isCompleted && <Check className="h-3 w-3" />}
                    </button>
                  </div>
                  <Input
                    value={criterionText}
                    onChange={(e) => onUpdateCriterion(idx, e.target.value)}
                    placeholder="Acceptance criterion..."
                    className="flex-1"
                  />
                  {task.acceptanceCriteria.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteCriterion(idx)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if adding a dependency would create a circular dependency
 */
function wouldCreateCircularDependency(
  tasks: RalphTask[],
  fromTaskId: string,
  toTaskId: string
): boolean {
  const visited = new Set<string>();

  function dfs(taskId: string): boolean {
    if (taskId === fromTaskId) return true;
    if (visited.has(taskId)) return false;

    visited.add(taskId);

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (dfs(depId)) return true;
      }
    }

    return false;
  }

  return dfs(toTaskId);
}
