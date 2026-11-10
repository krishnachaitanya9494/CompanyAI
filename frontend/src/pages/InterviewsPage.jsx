// Import React and hooks for interview state management.
import React, { useState } from 'react';

// Import Badge component.
import { Badge } from '../components/common/Badge';

// Import icons from lucide-react.
import { Calendar, User, Video, Clock, CheckCircle2, XCircle, Plus, Eye } from 'lucide-react';

// Export InterviewsPage component managing all scheduled rounds and interviewer assignments.
export const InterviewsPage = ({
  candidates = [],
  onSelectCandidate,
}) => {
  // Filter candidates who have an active interview or interview round stage.
  const interviewList = candidates
    .filter((c) => c.scheduledInterview || c.status?.includes('Round') || c.status?.includes('Interview'))
    .map((c) => ({
      candidateId: c.id,
      candidateName: c.name,
      role: c.currentRole,
      round: c.scheduledInterview?.round || c.status,
      status: c.scheduledInterview?.status || 'Scheduled',
      interviewer: c.scheduledInterview?.interviewer || 'Vikram Malhotra (VP Eng)',
      date: c.scheduledInterview?.date?.replace('T', ' ') || '2026-11-12 14:00',
      meetingLink: c.scheduledInterview?.meetingLink || 'https://meet.google.com/xyz-interview',
    }));

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <span>Interview Management</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {interviewList.length} Scheduled
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate interview loops, assign technical interviewers, and record candidate stage outcomes
          </p>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-surface-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Candidate</th>
                <th className="py-3.5 px-4">Interview Round</th>
                <th className="py-3.5 px-4">Interviewer</th>
                <th className="py-3.5 px-4">Schedule Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {interviewList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No active interviews scheduled. Open any candidate profile to schedule an interview!
                  </td>
                </tr>
              ) : (
                interviewList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {/* Candidate */}
                    <td className="py-4 px-5">
                      <div className="font-semibold text-navy-900">{item.candidateName}</div>
                      <div className="text-[11px] text-slate-500">{item.role}</div>
                    </td>

                    {/* Round */}
                    <td className="py-4 px-4 font-medium text-navy-900">
                      {item.round}
                    </td>

                    {/* Interviewer */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.interviewer}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.date}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <Badge variant="blue" size="xs">
                        {item.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.meetingLink && (
                          <a
                            href={item.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-brand-700 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Join</span>
                          </a>
                        )}

                        <button
                          onClick={() => onSelectCandidate(item.candidateId)}
                          className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Open Candidate Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
