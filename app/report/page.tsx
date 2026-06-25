'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Database, BarChart2, TrendingUp, CheckCircle, ChevronRight, Upload } from 'lucide-react';
import { BulkImport } from '@/components/BulkImport';
import type { CommunityReportType } from '@/lib/types';

// ── Step type definitions ──────────────────────────────────────────────────

type ReportTypeOption = {
  value: CommunityReportType;
  icon: React.ElementType;
  labelTh: string;
  labelEn: string;
  descTh: string;
  descEn: string;
  color: string;
};

const REPORT_TYPES: ReportTypeOption[] = [
  {
    value:   'suspicious',
    icon:    AlertTriangle,
    labelTh: 'พบสัญญาน่าสงสัย',
    labelEn: 'Suspicious contract',
    descTh:  'ราคาสูงผิดปกติ ผู้ชนะซ้ำเดิมมากเกินไป หรือพบสัญญาณฮั้ว',
    descEn:  'Abnormal price, repeat winner pattern, or bid-rigging signals',
    color:   'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  },
  {
    value:   'data_error',
    icon:    Database,
    labelTh: 'ข้อมูลไม่ถูกต้อง',
    labelEn: 'Data error',
    descTh:  'ราคา หน่วยงาน หรือรายละเอียดโครงการในฐานข้อมูลผิดพลาด',
    descEn:  'Wrong price, agency, or project details in the database',
    color:   'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  {
    value:   'analysis_request',
    icon:    BarChart2,
    labelTh: 'ขอให้วิเคราะห์',
    labelEn: 'Analysis request',
    descTh:  'อยากให้ทีมวิเคราะห์หน่วยงาน ประเภทโครงการ หรือแนวโน้มเฉพาะ',
    descEn:  'Request deeper analysis of an agency, project type, or trend',
    color:   'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  {
    value:   'bid_outcome',
    icon:    TrendingUp,
    labelTh: 'รายงานผลประมูล',
    labelEn: 'Bid outcome',
    descTh:  'แจ้งผลการประมูลเพื่อช่วยปรับปรุงโมเดลทำนายราคา',
    descEn:  'Share your bid result to help improve the price prediction model',
    color:   'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
];

const FISCAL_YEARS = ['2568', '2567', '2566', '2565', '2564', '2563', '2562', '2561'];
const ROLES = [
  { value: 'contractor',  labelTh: 'ผู้รับเหมา / ผู้เสนอราคา' },
  { value: 'journalist',  labelTh: 'นักข่าว / สื่อมวลชน' },
  { value: 'researcher',  labelTh: 'นักวิจัย / นักวิชาการ' },
  { value: 'government',  labelTh: 'เจ้าหน้าที่รัฐ' },
  { value: 'other',       labelTh: 'อื่นๆ' },
];

// ── Field helpers ──────────────────────────────────────────────────────────

function FieldText({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 lang-th">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-400 lang-th"
      />
    </div>
  );
}

function FieldTextarea({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 lang-th">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={4}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-400 lang-th resize-none"
      />
    </div>
  );
}

function FieldSelect({
  label, value, onChange, options, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; labelTh: string }[]; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 lang-th">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-400 lang-th appearance-none bg-white"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.labelTh}</option>
        ))}
      </select>
    </div>
  );
}

// ── Step question renderers ────────────────────────────────────────────────

function SuspiciousForm({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <FieldText label="หน่วยงาน" value={data.agency ?? ''} onChange={(v) => setData({ ...data, agency: v })} placeholder="เช่น กรมชลประทาน" />
      <FieldSelect label="ปีงบประมาณ" value={data.fiscal_year ?? ''} onChange={(v) => setData({ ...data, fiscal_year: v })} options={FISCAL_YEARS.map((y) => ({ value: y, labelTh: `ปีงบ ${y}` }))} placeholder="เลือก (ไม่บังคับ)" />
      <FieldText label="หมายเลขโครงการ / ชื่อโครงการ" value={data.project_ref ?? ''} onChange={(v) => setData({ ...data, project_ref: v })} placeholder="เช่น 66039020001" />
      <FieldTextarea label="อธิบายสิ่งที่พบ" required value={data.description ?? ''} onChange={(v) => setData({ ...data, description: v })} placeholder="เช่น ผู้รับเหมาเดิมชนะประมูลทุกปีในหน่วยงานนี้ ราคาสูงกว่าตลาด 30%" />
    </div>
  );
}

function DataErrorForm({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <FieldText label="หน่วยงาน" value={data.agency ?? ''} onChange={(v) => setData({ ...data, agency: v })} placeholder="เช่น กรมทางหลวง" />
      <FieldText label="หมายเลขโครงการ / ชื่อโครงการ" value={data.project_ref ?? ''} onChange={(v) => setData({ ...data, project_ref: v })} placeholder="เช่น 66039020001" />
      <FieldTextarea label="ข้อมูลที่ผิด (ระบุสิ่งที่ควรจะเป็น)" required value={data.description ?? ''} onChange={(v) => setData({ ...data, description: v })} placeholder="เช่น ราคาสัญญาแสดงเป็น 1.2 ล้าน แต่จริงๆ คือ 12 ล้านบาท" />
    </div>
  );
}

function AnalysisRequestForm({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <FieldText label="หน่วยงาน / ประเภทโครงการที่ต้องการวิเคราะห์" value={data.agency ?? ''} onChange={(v) => setData({ ...data, agency: v })} placeholder="เช่น กรมสรรพากร / งานระบบไอที" />
      <FieldSelect label="ปีงบประมาณ" value={data.fiscal_year ?? ''} onChange={(v) => setData({ ...data, fiscal_year: v })} options={FISCAL_YEARS.map((y) => ({ value: y, labelTh: `ปีงบ ${y}` }))} placeholder="เลือก (ไม่บังคับ)" />
      <FieldTextarea label="คำถามหรือประเด็นที่อยากให้วิเคราะห์" required value={data.description ?? ''} onChange={(v) => setData({ ...data, description: v })} placeholder="เช่น อยากรู้ว่าหน่วยงานนี้ใช้วิธีคัดเลือกอะไรบ้าง และผู้รับเหมารายใดชนะมากที่สุด" />
    </div>
  );
}

function BidOutcomeForm({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <FieldSelect
        label="ผลการประมูล"
        value={data.outcome ?? ''}
        onChange={(v) => setData({ ...data, outcome: v })}
        options={[
          { value: 'won',     labelTh: 'ชนะการประมูล' },
          { value: 'lost',    labelTh: 'ไม่ชนะการประมูล' },
          { value: 'no_bid',  labelTh: 'ไม่ได้ยื่นประมูล' },
          { value: 'pending', labelTh: 'ยังรอผล' },
        ]}
        placeholder="เลือกผล"
      />
      <FieldText label="หน่วยงาน" value={data.agency ?? ''} onChange={(v) => setData({ ...data, agency: v })} placeholder="เช่น กรมชลประทาน" />
      <FieldText label="ราคาที่คุณเสนอ (ล้านบาท)" value={data.submitted_price ?? ''} onChange={(v) => setData({ ...data, submitted_price: v })} placeholder="0.00" />
      {data.outcome === 'lost' && (
        <FieldText label="ราคาผู้ชนะ (ล้านบาท, ถ้าทราบ)" value={data.winner_price ?? ''} onChange={(v) => setData({ ...data, winner_price: v })} placeholder="0.00" />
      )}
      <FieldText label="จำนวนผู้เสนอราคา" value={data.competitor_count ?? ''} onChange={(v) => setData({ ...data, competitor_count: v })} placeholder="0" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type PageStep = 'type' | 'form' | 'contact' | 'done';

export default function ReportPage() {
  const [pageStep, setPageStep] = useState<PageStep>('type');
  const [selectedType, setSelectedType] = useState<CommunityReportType | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState('');
  const [error, setError] = useState('');

  const selectedTypeDef = REPORT_TYPES.find((t) => t.value === selectedType);

  const handleTypeSelect = (type: CommunityReportType) => {
    setSelectedType(type);
    setFormData({});
    setPageStep('form');
  };

  const isFormValid = () => {
    if (!selectedType) return false;
    if (selectedType === 'bid_outcome') return !!formData.outcome;
    return !!(formData.description?.trim());
  };

  const handleFormNext = () => {
    if (!isFormValid()) { setError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
    setError('');
    setPageStep('contact');
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/community-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type:     selectedType,
          agency:          formData.agency || undefined,
          fiscal_year:     formData.fiscal_year || undefined,
          project_ref:     formData.project_ref || undefined,
          content:         formData,
          submitter_email: email || undefined,
          submitter_role:  role || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; report_id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return; }
      setRefId(data.report_id ?? '');
      setPageStep('done');
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-16">

        {/* Back link */}
        <Link href="/home" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-8 transition-colors lang-th">
          ← กลับหน้าหลัก
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-black tracking-tight lang-th">รายงานถึงทีม</h1>
          <p className="mt-2 text-sm text-slate-500 lang-th">
            ข้อมูลจากคุณช่วยให้ Conjuncture แม่นยำขึ้น — ทุกรายงานมีผลจริง
          </p>
        </div>

        {/* Progress indicator */}
        {pageStep !== 'done' && (
          <div className="flex items-center gap-2 mb-8">
            {(['type', 'form', 'contact'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  s === pageStep ? 'bg-black text-white' :
                  ['type', 'form', 'contact'].indexOf(pageStep) > i ? 'bg-emerald-500 text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {['type', 'form', 'contact'].indexOf(pageStep) > i ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`h-px flex-1 w-8 transition-colors ${['type', 'form', 'contact'].indexOf(pageStep) > i ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

          {/* Step 1: Type selection */}
          {pageStep === 'type' && !showBulkImport && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-4 lang-th">คุณต้องการรายงานเรื่องอะไร?</p>
              <div className="space-y-2">
                {REPORT_TYPES.map((rt) => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.value}
                      onClick={() => handleTypeSelect(rt.value)}
                      className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${rt.color}`}
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold lang-th">{rt.labelTh}</p>
                        <p className="text-xs opacity-70 mt-0.5 lang-th">{rt.descTh}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40 mt-0.5 shrink-0" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 text-left hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 lang-th">นำเข้าหลายรายการ (CSV)</p>
                    <p className="text-xs text-slate-400 mt-0.5 lang-th">อัปโหลดผลประมูลหลายโครงการพร้อมกัน</p>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40 mt-0.5 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* Bulk import panel */}
          {pageStep === 'type' && showBulkImport && (
            <div>
              <button
                onClick={() => setShowBulkImport(false)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-5 transition-colors lang-th"
              >
                ← กลับ
              </button>
              <BulkImport onDone={() => setShowBulkImport(false)} />
            </div>
          )}

          {/* Step 2: Form */}
          {pageStep === 'form' && selectedType && (
            <div>
              {selectedTypeDef && (
                <div className="flex items-center gap-2 mb-5">
                  <selectedTypeDef.icon className="w-4 h-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-700 lang-th">{selectedTypeDef.labelTh}</p>
                </div>
              )}
              {selectedType === 'suspicious'        && <SuspiciousForm data={formData} setData={setFormData} />}
              {selectedType === 'data_error'        && <DataErrorForm data={formData} setData={setFormData} />}
              {selectedType === 'analysis_request'  && <AnalysisRequestForm data={formData} setData={setFormData} />}
              {selectedType === 'bid_outcome'        && <BidOutcomeForm data={formData} setData={setFormData} />}
              {error && <p className="text-xs text-red-500 mt-3 lang-th">{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setPageStep('type')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors lang-th">
                  ย้อนกลับ
                </button>
                <button onClick={handleFormNext} className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors lang-th">
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Contact */}
          {pageStep === 'contact' && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 lang-th">ข้อมูลติดต่อ (ไม่บังคับ)</p>
              <p className="text-xs text-slate-400 mb-5 lang-th">ถ้าต้องการให้ทีมติดต่อกลับ หรือส่งผลการตรวจสอบ</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 lang-th">อีเมล</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                  />
                </div>
                <FieldSelect
                  label="บทบาทของคุณ"
                  value={role}
                  onChange={setRole}
                  options={ROLES}
                  placeholder="เลือก (ไม่บังคับ)"
                />
              </div>
              {error && <p className="text-xs text-red-500 mt-3 lang-th">{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setPageStep('form')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors lang-th">
                  ย้อนกลับ
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 lang-th"
                >
                  {submitting ? 'กำลังส่ง…' : 'ส่งรายงาน'}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {pageStep === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-lg font-bold text-slate-800 mb-1 lang-th">รับรายงานแล้ว</p>
              <p className="text-sm text-slate-500 lang-th">ทีมจะตรวจสอบและตอบกลับถ้ามีอีเมล</p>
              {refId && (
                <div className="mt-4 inline-block bg-slate-50 rounded-lg px-4 py-2">
                  <p className="text-[10px] text-slate-400 mb-0.5 lang-th">หมายเลขอ้างอิง</p>
                  <p className="text-sm font-mono font-semibold text-slate-700">{refId}</p>
                </div>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => { setPageStep('type'); setFormData({}); setSelectedType(null); setEmail(''); setRole(''); setRefId(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors lang-th"
                >
                  ส่งรายงานอีก
                </button>
                <Link href="/home" className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors text-center lang-th">
                  กลับหน้าหลัก
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
