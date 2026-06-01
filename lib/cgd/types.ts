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
  2559: [
    'd96420a9-75ec-4d05-bf67-0a3c1b7dbebf',
    '32a2aef4-3e05-43c6-8cfa-a2c5294ced3c',
    'bbb78ccd-d3dc-4cfe-9b43-663fea65390a',
    '6cbc3ec3-ff5e-44e5-abdb-71f74c7f4e03',
  ],
  2560: [
    '7015580c-e5b2-40a0-89f0-56a01ad61566',
    'd10d90bf-ec0d-4918-8cd5-6e268d68500d',
    '59c71c16-dfb1-4fbe-bf0d-1217297af519',
    'f8eccf55-d25c-44b3-a59b-d8c61116eb44',
    '90cf28f8-4813-43a8-a144-4e274937ea70',
  ],
  2561: [
    'fc1e2e63-db02-4b34-90aa-462d5fea9a90',
    'af6938a2-f55e-4ea9-9596-97aaec680244',
    'c0e57ce2-8f32-4ac4-8b20-07d427a3f5bb',
    'fb6bfdb5-c8e8-450c-9501-126a03e23aeb',
    '0c3b0ae2-7d4b-4aff-aab3-287a09496e80',
    'c9f94589-963f-46c0-a63c-c65de44268ef',
    '023ce538-376a-435d-a8b5-da6d86c41b62',
    'b379a2c7-f2d8-4b3d-9978-650c0c2ec9ed',
  ],
  2562: [
    '5aa78e7b-49b7-4dd0-983e-8c0d3255f5c5',
    '968cb27d-3b58-4f9b-8e8d-64ce1f86e7b7',
    'bab0c471-dd02-4887-b8f2-4bb72e6f19ba',
    '5cab462d-4644-42e9-8e80-0f9ecdb11039',
    'd4b48b5d-0698-4809-8d04-44747c524ce1',
    '3219084a-cd93-4184-a2e7-b4d77c0bd1de',
    '8a5c3679-474c-47af-a49e-4c5d577c7827',
    'b979c308-7332-471a-9081-03655fbd2574',
    'ae64e954-7042-456e-a764-f48f772efe72',
  ],
  2563: [
    '77ee205a-bc72-469f-8e53-74052b7897b7',
    '5b312026-8628-47f6-b7aa-5589f77ddf81',
    'ab5d301d-a8a7-40f4-a07e-722f05ae5a28',
    '6ddbf3b7-2ed0-48d7-aa98-74765b91a59e',
    '8b679893-7634-4318-8469-79581a6c38c8',
    'd1455f55-4f01-4a93-af51-dfa4544ec74f',
    '6d9defa8-c32d-4d51-99e1-e0232f8e59ab',
    '1abcb819-db49-4393-afd4-525a65d26564',
    'e569629d-dfa4-4e46-8dd5-a2f6d4bd9122',
    '008aae4d-c7b5-4fa2-a9f6-a40854a8e1df',
  ],
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
