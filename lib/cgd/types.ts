/**
 * Types for Thailand Government Spending CKAN API (opend.data.go.th)
 *
 * Two primary datasets used:
 *   cdg-contract-{year}  — all awarded contracts (~514k/year), winner + prices
 *   egpcost-bidder-{year} — CoST transparency subset (~3k/year), all bidder names
 */

// ── CKAN API envelope ─────────────────────────────────────────────────────────

export interface CkanResponse<T> {
  success: boolean;
  result: {
    total: number;
    records: T[];
    fields: { id: string; type: string }[];
    _links?: { next?: string };
  };
}

// ── cgd-contract raw record (Thai field names) ────────────────────────────────

export interface RawCgdContract {
  _id: number;
  รหัสโครงการ: number;           // e-GP project ID — matches Tender.id
  ชื่อโครงการ: string;           // project name
  ชื่อประเภทโครงการ: string;     // project type (ซื้อ / จ้างก่อสร้าง / จ้างเหมา)
  ชื่อหน่วยงาน: string;          // agency name
  ชื่อหน่วยงานย่อย: string;      // sub-agency
  'วิธีจัดซื้อฯ': string;        // procurement method group
  'กลุ่มวิธีจัดซื้อฯ': string;  // procurement method name
  วันที่ประกาศ: string;          // announcement date (Thai format)
  'งบประมาณ(บาท)': number | null;
  'ราคากลาง(บาท)': number | null;
  'ราคาตกลงซื้อ/จ้าง': number | null;  // agreed/winning price
  ปีงบประมาณ: number;            // fiscal year (BE)
  วันที่เกิดรายการ: string;      // transaction date
  จังหวัด: string;               // province
  ชื่อผู้ชนะ: string | null;     // winner company name
  เลขนิติบุคคล: string | null;   // winner business registration ID
  เลขที่สัญญา: string | null;    // contract number
  วันที่ลงนามสัญญา: string | null;
  วันที่สิ้นสุดสัญญา: string | null;
  'งบสัญญา(บาท)': number | null; // final contract value
  สถานะสัญญา: string | null;     // contract status
}

// ── egpcost-bidder raw record ─────────────────────────────────────────────────

export interface RawEgpCostBidder {
  _id: number;
  'เลขที่ CoST': number;
  เลขที่โครงการ: number;         // e-GP project ID
  ปีงบประมาณ: number;
  ชื่อผู้เสนอราคา: string;       // bidder name (includes winner)
}

// ── Normalised domain types ───────────────────────────────────────────────────

export interface CgdContract {
  projectId: string;             // รหัสโครงการ as string
  projectName: string;
  projectType: string;
  agency: string;
  subAgency: string;
  procurementMethod: string;
  procurementMethodGroup: string;
  announceDate: string;
  budget: number | null;
  referencePrice: number | null;
  agreedPrice: number | null;    // winning price
  fiscalYear: number;            // BE year
  province: string;
  winnerName: string | null;
  winnerBusinessId: string | null;
  contractNo: string | null;
  contractSignDate: string | null;
  contractEndDate: string | null;
  contractValue: number | null;
  contractStatus: string | null;
  /** Discount from reference price — null if either price is missing */
  discountFromReference: number | null;
}

export interface CgdBidder {
  costId: number;
  projectId: string;
  fiscalYear: number;
  bidderName: string;
}

/** Enriched project: contract data + identified losers (when available) */
export interface CgdProjectDetail {
  contract: CgdContract;
  /** All known bidders from egpcost-bidder (CoST projects only). Empty = not a CoST project. */
  bidders: string[];
  /** Bidders who are not the winner. Empty if bidders array is empty or winner unknown. */
  losers: string[];
}

// ── Resource ID map (CKAN resource IDs by year) ───────────────────────────────

/** cgd-contract resources by BE fiscal year. Each year is split into multiple chunks. */
export const CGD_CONTRACT_RESOURCES: Record<number, string[]> = {
  2567: [
    '4140ff35-d758-45af-8d7f-3de23010fbb2',
    'c2b65110-52a3-4ded-ad8f-fb3a9964ae53',
    'a9e960d3-088d-4201-aff3-3f3a6d3e8b85',
    '8297ee18-f974-4003-afed-87335d7cf9c0',
    'c84b6299-fe32-4872-96f1-acbf9e98f750',
    'e5be67b3-7c1e-4fcb-9337-f755ff09f504',
    '740d8cc9-b68a-439c-85f3-e08ad8a4efaa',
    '39963287-ee87-4604-b000-2698b242fedc',
    '1b46127d-898e-4e95-9d32-5b9d98f65b01',
    '0a9fdf07-009d-4d17-983e-778e4664ab9d',
    '75c29453-9649-48c8-a823-81b127e7d052',
  ],
  2568: [
    'e4eaa1b4-eb1a-4534-b227-988ee25b898d',
    '9ae119c4-73b9-4bb6-9b71-7b355269bc00',
    '1c1a90af-2d47-4bfb-ae87-e479b2582257',
  ],
};

/** egpcost-bidder resources by BE fiscal year (single file per year) */
export const EGPCOST_BIDDER_RESOURCES: Record<number, string> = {
  2559: 'b8eed0c0-d4e5-4098-bf6a-b420ad5b9640',
  2560: 'd0df6ead-7aee-42b7-9af1-b1727a865654',
  2561: '6654c91c-0d68-43f5-a306-42c274eb035c',
  2562: '2b522137-fee5-42ff-b013-eab935db7130',
  2563: '7f3e02c5-6557-4c60-b649-d72fef0e734b',
  2564: '8b8cff59-261d-41bf-96c9-ebaeae2d3d9d',
  2565: '67ba7c7b-7420-49f0-b519-020c292e0ddf',
  2566: '018057a5-34aa-4749-91fc-64418df11604',
  2567: 'b5486509-66c7-4a39-9193-af377ecc2a33',
};
