'use client';

import { MouseEventHandler } from 'react';
import Link from 'next/link';
import { PlusCircle, Mail, Newspaper, BarChart2 } from 'lucide-react';

interface QuickActionsProps {
  onInviteClient: MouseEventHandler<HTMLButtonElement>;
}

export function AdminQuickActions({ onInviteClient }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3 bg-white p-4 rounded shadow-sm">
      {/* New Project */}
      <Link
        href="/admin/create-project"
        className="flex items-center gap-2 btn-blue px-4 py-2 rounded"
      >
        <PlusCircle size={16} /> New Project
      </Link>

      {/* Invite Client */}
      <button
        onClick={onInviteClient}
        className="flex items-center gap-2 btn-yellow px-4 py-2 rounded"
      >
        <Mail size={16} /> Invite Client
      </button>

      {/* Write Blog */}
      <Link
        href="/admin/blog/new"
        className="flex items-center gap-2 btn-green px-4 py-2 rounded"
      >
        <Newspaper size={16} /> Write Blog
      </Link>

      {/* View Analytics */}
      <Link
        href="/admin/analytics"
        className="flex items-center gap-2 btn-gray px-4 py-2 rounded"
      >
        <BarChart2 size={16} /> View Analytics
      </Link>
    </div>
  );
}
