'use client';

import { useRef, useState } from 'react';
import { Upload, Download, CheckCircle, AlertTriangle } from 'lucide-react';

const CSV_TEMPLATE = [
  'outcome_type,agency,project_type,submitted_price,winner_price,competitor_count,no_bid_reason',
  'won,กรมชลประทาน,งานก่อสร้าง,9.8,,4,',
  'lost,กรมทางหลวง,งานปรับปรุงถนน,45.2,42.1,6,',
  'no_bid,กรมสรรพากร,ระบบไอที,,,, margin_too_low',
].join('\n');

const COLUMN_DOCS = [
  { name: 'outcome_type',     required: true,  values: 'won / lost / no_bid / pending' },
  { name: 'agency',           required: false, values: 'ชื่อหน่วยงาน' },
  { name: 'project_type',     required: false, values: 'ประเภทงาน' },
  { name: 'submitted_price',  required: false, values: 'ล้านบาท (ตัวเลข)' },
  { name: 'winner_price',     required: false, values: 'ล้านบาท (ตัวเลข)' },
  { name: 'competitor_count', required: false, values: 'จำนวนผู้เสนอราคา (ตัวเลข)' },
  { name: 'no_bid_reason',    required: false, values: 'too_competitive / margin_too_low / spec_issues / other' },
];

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bid_outcomes_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function BulkImport({ onDone }: { onDone?: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(Boolean).slice(0, 6);
      setPreview(lines.map((l) => l.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))));
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const text = await file.text();
      const res = await fetch('/api/bid-outcome/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) { setError(data.error ?? 'อัปโหลดไม่สำเร็จ'); return; }
      setResult(data);
      onDone?.(data.imported);
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Download template */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700 lang-th">นำเข้าข้อมูลหลายรายการ (CSV)</p>
          <p className="text-xs text-slate-400 lang-th">สูงสุด 500 แถวต่อครั้ง</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors lang-th"
        >
          <Download className="w-3.5 h-3.5" />
          ดาวน์โหลด Template
        </button>
      </div>

      {/* Column reference */}
      <div className="bg-slate-50 rounded-xl p-3 text-[11px]">
        <p className="font-semibold text-slate-600 mb-2 lang-th">คอลัมน์ที่รองรับ:</p>
        <div className="space-y-1">
          {COLUMN_DOCS.map((c) => (
            <div key={c.name} className="flex gap-2">
              <span className="font-mono text-slate-700 w-36 shrink-0">{c.name}{c.required && <span className="text-red-400 ml-0.5">*</span>}</span>
              <span className="text-slate-400 lang-th">{c.values}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          {file ? (
            <p className="text-sm font-medium text-blue-600">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 lang-th">คลิกหรือลากไฟล์ CSV มาวางที่นี่</p>
              <p className="text-xs text-slate-400 mt-1">.csv เท่านั้น</p>
            </>
          )}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !result && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="text-[11px] w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {preview[0].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-mono text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(1).map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {row.map((v, j) => (
                    <td key={j} className="px-3 py-1.5 text-slate-600 lang-th">{v || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length >= 6 && (
            <p className="text-[10px] text-slate-400 px-3 py-1.5 lang-th">แสดง 5 แถวแรก…</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 lang-th">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700 lang-th">นำเข้าสำเร็จ</p>
          </div>
          <p className="text-xs text-emerald-600 lang-th">นำเข้า {result.imported} แถว · ข้ามไป {result.skipped} แถว</p>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {result.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-amber-600 lang-th">{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => { setFile(null); setPreview([]); setResult(null); }}
            className="mt-3 text-xs text-emerald-700 hover:underline lang-th"
          >
            นำเข้าไฟล์อีก
          </button>
        </div>
      )}

      {/* Submit */}
      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 lang-th"
        >
          {uploading ? 'กำลังนำเข้า…' : `นำเข้า ${file.name}`}
        </button>
      )}
    </div>
  );
}
