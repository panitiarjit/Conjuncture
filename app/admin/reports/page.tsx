'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { CommunityReport, CommunityReportStatus, CommunityReportType } from '@/lib/types';

const TYPE_LABELS: Record<CommunityReportType, string> = {
  suspicious:       'น่าสงสัย',
  data_error:       'ข้อมูลผิด',
  analysis_request: 'ขอวิเคราะห์',
  bid_outcome:      'ผลประมูล',
};

const STATUS_LABELS: Record<CommunityReportStatus, string> = {
  new:       'ใหม่',
  reviewing: 'กำลังตรวจ',
  verified:  'ยืนยันแล้ว',
  published: 'เผยแพร่แล้ว',
  dismissed: 'ปิด',
};

const STATUS_COLORS: Record<CommunityReportStatus, string> = {
  new:       'bg-blue-50 text-blue-700 border-blue-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  verified:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  published: 'bg-purple-50 text-purple-700 border-purple-200',
  dismissed: 'bg-slate-100 text-slate-500 border-slate-200',
};

const TYPE_COLORS: Record<CommunityReportType, string> = {
  suspicious:       'bg-red-50 text-red-700',
  data_error:       'bg-amber-50 text-amber-700',
  analysis_request: 'bg-blue-50 text-blue-700',
  bid_outcome:      'bg-emerald-50 text-emerald-700',
};

const NEXT_STATUSES: Record<CommunityReportStatus, CommunityReportStatus[]> = {
  new:       ['reviewing', 'dismissed'],
  reviewing: ['verified', 'dismissed'],
  verified:  ['published', 'dismissed'],
  published: ['dismissed'],
  dismissed: ['new'],
};

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ReportRow({
  report,
  adminEmail,
  onUpdated,
}: {
  report: CommunityReport;
  adminEmail: string;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(report.internal_notes ?? '');
  const [updating, setUpdating] = useState(false);

  const applyUpdate = async (payload: Partial<{ status: CommunityReportStatus; internal_notes: string }>) => {
    setUpdating(true);
    try {
      await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminEmail,
        },
        body: JSON.stringify({ report_id: report.report_id, ...payload }),
      });
      onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <tr
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-3 px-4 text-[11px] font-mono text-slate-500">{report.report_id}</td>
        <td className="py-3 px-4">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full lang-th ${TYPE_COLORS[report.report_type]}`}>
            {TYPE_LABELS[report.report_type]}
          </span>
        </td>
        <td className="py-3 px-4 text-xs text-slate-600 lang-th max-w-[180px] truncate">
          {report.agency ?? report.content?.agency as string ?? '—'}
        </td>
        <td className="py-3 px-4 text-[11px] text-slate-400">{formatDate(report.timestamp)}</td>
        <td className="py-3 px-4">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border lang-th ${STATUS_COLORS[report.status]}`}>
            {STATUS_LABELS[report.status]}
          </span>
        </td>
        <td className="py-3 px-4 text-[11px] text-slate-400 max-w-[120px] truncate">
          {report.submitter_email ?? '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Content */}
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">รายละเอียด</p>
                <pre className="text-xs text-slate-700 bg-white rounded-lg p-3 border border-slate-200 overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(report.content, null, 2)}
                </pre>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">บันทึกภายใน</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 resize-none"
                    placeholder="บันทึกสำหรับทีม..."
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); applyUpdate({ internal_notes: notes }); }}
                    disabled={updating}
                    className="mt-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-black transition-colors disabled:opacity-50"
                  >
                    {updating ? 'กำลังบันทึก…' : 'บันทึก'}
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">เปลี่ยนสถานะ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NEXT_STATUSES[report.status].map((s) => (
                      <button
                        key={s}
                        onClick={(e) => { e.stopPropagation(); applyUpdate({ status: s }); }}
                        disabled={updating}
                        className={`text-[11px] px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 lang-th ${STATUS_COLORS[s]} hover:opacity-80`}
                      >
                        → {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {report.submitter_email && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1">ติดต่อ</p>
                    <a
                      href={`mailto:${report.submitter_email}?subject=Re: รายงาน ${report.report_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {report.submitter_email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminReportsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin');
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchReports = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (filterType)   qs.set('type', filterType);
      if (filterStatus) qs.set('status', filterStatus);
      const res = await fetch(`/api/admin/reports?${qs}`, {
        headers: { 'X-Admin-Email': user.email },
      });
      if (res.status === 401) {
        setError('ไม่มีสิทธิ์เข้าถึง — กรุณาตรวจสอบการตั้งค่า ADMIN_EMAIL');
        return;
      }
      const data = await res.json() as CommunityReport[];
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [user?.email, filterType, filterStatus]);

  useEffect(() => {
    if (isAuthenticated && user?.email) fetchReports();
  }, [isAuthenticated, user?.email, fetchReports]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const counts = NEXT_STATUSES
    ? Object.fromEntries(
        (['new', 'reviewing', 'verified', 'published', 'dismissed'] as CommunityReportStatus[]).map((s) => [
          s, reports.filter((r) => r.status === s).length,
        ]),
      )
    : {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-black tracking-tight lang-th">รายงานจากชุมชน</h1>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="text-xs px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white transition-colors disabled:opacity-50 lang-th"
          >
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </button>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(['new', 'reviewing', 'verified', 'published', 'dismissed'] as CommunityReportStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`rounded-xl p-3 border text-left transition-all ${
                filterStatus === s
                  ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-lg font-black text-slate-800">{counts[s] ?? 0}</p>
              <p className={`text-[11px] font-medium lang-th ${filterStatus === s ? '' : 'text-slate-500'}`}>
                {STATUS_LABELS[s]}
              </p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none lang-th"
          >
            <option value="">ทุกประเภท</option>
            {(Object.keys(TYPE_LABELS) as CommunityReportType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          {(filterType || filterStatus) && (
            <button
              onClick={() => { setFilterType(''); setFilterStatus(''); }}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white transition-colors lang-th"
            >
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 self-center lang-th">
            {reports.length} รายการ
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 lang-th">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {loading && reports.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-black rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm lang-th">ไม่มีรายงาน</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider lang-th">ประเภท</th>
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider lang-th">หน่วยงาน</th>
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider lang-th">วันที่</th>
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider lang-th">สถานะ</th>
                    <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <ReportRow
                      key={r.report_id}
                      report={r}
                      adminEmail={user?.email ?? ''}
                      onUpdated={fetchReports}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-[10px] text-slate-400 text-center lang-th">
          คลิกที่แถวเพื่อดูรายละเอียดและเปลี่ยนสถานะ
        </p>
      </div>
    </div>
  );
}
