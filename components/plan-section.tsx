'use client';

import { useState } from 'react';
import { Badge, Skeleton } from '@/components/ui';
import type { StudyPlan } from '@/lib/types';

export function PlanSection({ plan, busy }: { plan: StudyPlan | null; busy: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  if (busy) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!plan || plan.content.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
        No study plan yet. Hit <strong>“Generate plan”</strong> above to get a day-by-day roadmap.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {plan.content.map((day, di) => {
        const dayTasks = day.tasks.map((t, ti) => ({ id: `${day.day}-${di}-${ti}`, text: t }));
        const doneCount = dayTasks.filter((t) => done[t.id]).length;
        return (
          <div key={`${day.day}-${di}`} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {di < plan.content.length - 1 && (
              <div className="absolute top-0 bottom-0 -right-6 hidden w-px bg-slate-200 sm:block" />
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {day.day}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{day.title ?? `Day ${day.day}`}</p>
                  {day.focused === false && <Badge tone="amber">light day</Badge>}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                {doneCount}/{dayTasks.length} done
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {day.topics.map((topic, ti) => (
                <Badge key={ti} tone="slate">
                  {topic}
                </Badge>
              ))}
            </div>

            <ul className="mt-3 space-y-1.5">
              {dayTasks.map((task) => {
                const checked = !!done[task.id];
                return (
                  <li key={task.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setDone((prev) => ({ ...prev, [task.id]: !checked }))}
                        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                      />
                      <span className={checked ? 'text-slate-400 line-through' : ''}>{task.text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}