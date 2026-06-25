'use client';

import { useState } from 'react';
import { X, CheckCircle, TrendingDown, PauseCircle, Clock, ChevronRight } from 'lucide-react';
import type { BidOutcomeType } from '@/lib/types';

interface BidOutcomePromptProps {
  sessionId: string;
  projectType?: string;
  agency?: string;
  submittedPrice?: number;
  isTh?: boolean;
  onClose: () => void;
}

type Step = 'outcome' | 'details' | 'prices' | 'done';

const OUTCOME_OPTIONS: {
  value: BidOutcomeType;
  labelTh: string;
  labelEn: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: 'won',     labelTh: 'ชนะการประมูล',     labelEn: 'Won',          icon: CheckCircle,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { value: 'lost',    labelTh: 'ไม่ชนะการประมูล',   labelEn: 'Lost',         icon: TrendingDown, color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  { value: 'no_bid',  labelTh: 'ไม่ได้ยื่นประมูล',  labelEn: 'Did not bid',  icon: PauseCircle,  color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { value: 'pending', labelTh: 'ยังรอผล',           labelEn: 'Pending',      icon: Clock,        color: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' },
];

const NO_BID_REASON_OPTIONS = [
  { value: 'too_competitive', labelTh: 'ตลาดแข่งขันสูงเกินไป',      labelEn: 'Too competitive' },
  { value: 'margin_too_low',  labelTh: 'กำไรต่ำเกินไป',               labelEn: 'Margin too low' },
  { value: 'spec_issues',     labelTh: 'มีปัญหาเรื่องสเปค/เงื่อนไข', labelEn: 'Spec / terms issues' },
  { value: 'other',           labelTh: 'เหตุผลอื่น',                  labelEn: 'Other' },
];

export function BidOutcomePrompt({
  sessionId,
  projectType: initialProjectType = '',
  agency: initialAgency = '',
  submittedPrice: initialPrice,
  isTh = true,
  onClose,
}: BidOutcomePromptProps) {
  const [step, setStep] = useState<Step>('outcome');
  const [outcomeType, setOutcomeType] = useState<BidOutcomeType | null>(null);
  const [agency, setAgency] = useState(initialAgency);
  const [projectType, setProjectType] = useState(initialProjectType);
  const [submittedPrice, setSubmittedPrice] = useState(initialPrice ? String(initialPrice) : '');
  const [winnerPrice, setWinnerPrice] = useState('');
  const [competitorCount, setCompetitorCount] = useState('');
  const [noBidReason, setNoBidReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState('');

  const showPriceStep = outcomeType === 'won' || outcomeType === 'lost';

  const handleOutcomeSelect = (v: BidOutcomeType) => {
    setOutcomeType(v);
    setStep('details');
  };

  const handleDetailsNext = () => {
    if (outcomeType === 'no_bid') {
      handleSubmit();
    } else if (showPriceStep) {
      setStep('prices');
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!outcomeType) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        session_id:    sessionId,
        outcome_type:  outcomeType,
        project_type:  projectType || undefined,
        agency:        agency || undefined,
        submitted_price: submittedPrice ? parseFloat(submittedPrice) : undefined,
        winner_price:  winnerPrice ? parseFloat(winnerPrice) : undefined,
        competitor_count: competitorCount ? parseInt(competitorCount, 10) : undefined,
        no_bid_reason: noBidReason || undefined,
        source:        'simulator_prompt',
      };
      const res = await fetch('/api/bid-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; outcome_id?: string };
      setRefId(data.outcome_id ?? '');
      setStep('done');
    } catch {
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className={`text-sm font-semibold text-slate-700 ${isTh ? 'lang-th' : ''}`}>
            {isTh ? 'รายงานผลการประมูล' : 'Report Bid Outcome'}
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Step: outcome */}
          {step === 'outcome' && (
            <div>
              <p className={`text-xs text-slate-500 mb-4 ${isTh ? 'lang-th' : ''}`}>
                {isTh
                  ? 'โครงการที่คุณจำลองไว้ — ผลเป็นอย่างไร?'
                  : 'How did the bid you modeled turn out?'}
              </p>
              <div className="space-y-2">
                {OUTCOME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleOutcomeSelect(opt.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${opt.color}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={isTh ? 'lang-th' : ''}>
                        {isTh ? opt.labelTh : opt.labelEn}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step: details */}
          {step === 'details' && (
            <div>
              <p className={`text-xs text-slate-500 mb-4 ${isTh ? 'lang-th' : ''}`}>
                {isTh ? 'ข้อมูลโครงการ (ไม่บังคับ)' : 'Project details (optional)'}
              </p>
              <div className="space-y-3">
                <Field
                  label={isTh ? 'หน่วยงาน' : 'Agency'}
                  value={agency}
                  onChange={setAgency}
                  placeholder={isTh ? 'เช่น กรมชลประทาน' : 'e.g. Royal Irrigation Dept.'}
                  isTh={isTh}
                />
                <Field
                  label={isTh ? 'ประเภทโครงการ' : 'Project type'}
                  value={projectType}
                  onChange={setProjectType}
                  placeholder={isTh ? 'เช่น งานก่อสร้าง' : 'e.g. Construction'}
                  isTh={isTh}
                />
                {outcomeType === 'no_bid' && (
                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium text-slate-600 ${isTh ? 'lang-th' : ''}`}>
                      {isTh ? 'เหตุผลที่ไม่ยื่น' : 'Reason for not bidding'}
                    </label>
                    <select
                      value={noBidReason}
                      onChange={(e) => setNoBidReason(e.target.value)}
                      className={`w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 ${isTh ? 'lang-th' : ''}`}
                    >
                      <option value="">{isTh ? 'เลือก (ไม่บังคับ)' : 'Select (optional)'}</option>
                      {NO_BID_REASON_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {isTh ? r.labelTh : r.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setStep('outcome')}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {isTh ? 'ย้อนกลับ' : 'Back'}
                </button>
                <button
                  onClick={handleDetailsNext}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? (isTh ? 'กำลังส่ง…' : 'Submitting…')
                    : showPriceStep
                    ? (isTh ? 'ถัดไป' : 'Next')
                    : (isTh ? 'ส่งข้อมูล' : 'Submit')}
                </button>
              </div>
            </div>
          )}

          {/* Step: prices */}
          {step === 'prices' && (
            <div>
              <p className={`text-xs text-slate-500 mb-4 ${isTh ? 'lang-th' : ''}`}>
                {isTh ? 'ข้อมูลราคา (ไม่บังคับ แต่ช่วยให้โมเดลแม่นขึ้นมาก)' : 'Price details (optional but highly valuable)'}
              </p>
              <div className="space-y-3">
                <Field
                  label={isTh ? 'ราคาที่คุณเสนอ (ล้านบาท)' : 'Your submitted price (M฿)'}
                  value={submittedPrice}
                  onChange={setSubmittedPrice}
                  placeholder="0.00"
                  type="number"
                  isTh={isTh}
                />
                {outcomeType === 'lost' && (
                  <Field
                    label={isTh ? 'ราคาผู้ชนะ (ล้านบาท)' : 'Winner price (M฿)'}
                    value={winnerPrice}
                    onChange={setWinnerPrice}
                    placeholder="0.00"
                    type="number"
                    isTh={isTh}
                  />
                )}
                <Field
                  label={isTh ? 'จำนวนผู้เสนอราคา' : 'Number of bidders'}
                  value={competitorCount}
                  onChange={setCompetitorCount}
                  placeholder="0"
                  type="number"
                  isTh={isTh}
                />
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {isTh ? 'ย้อนกลับ' : 'Back'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? (isTh ? 'กำลังส่ง…' : 'Submitting…') : (isTh ? 'ส่งข้อมูล' : 'Submit')}
                </button>
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <p className={`text-base font-semibold text-slate-800 mb-1 ${isTh ? 'lang-th' : ''}`}>
                {isTh ? 'ขอบคุณ!' : 'Thank you!'}
              </p>
              <p className={`text-xs text-slate-500 mb-1 ${isTh ? 'lang-th' : ''}`}>
                {isTh
                  ? 'ข้อมูลของคุณจะช่วยปรับปรุงโมเดลให้แม่นยำขึ้น'
                  : 'Your data will help improve model accuracy.'}
              </p>
              {refId && (
                <p className="text-[10px] text-slate-400 font-mono mb-4">{refId}</p>
              )}
              <button
                onClick={onClose}
                className="mt-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {isTh ? 'ปิด' : 'Close'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  isTh,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  isTh?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`text-xs font-medium text-slate-600 ${isTh ? 'lang-th' : ''}`}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 ${isTh ? 'lang-th' : ''}`}
        inputMode={type === 'number' ? 'decimal' : undefined}
      />
    </div>
  );
}
