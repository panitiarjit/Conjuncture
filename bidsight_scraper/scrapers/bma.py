"""
Group A — Bangkok Metropolitan Administration (BMA) e-GP scraper.

API base: https://egp2.bangkok.go.th/appapi/api
robots.txt: Disallow: /api/, /admin/  →  appapi/api is allowed (different path)

KEY DESIGN DECISION — deduplication against central e-GP feed:
  BMA's projectNumber (e.g. "69069422299") uses the identical national format
  (YYMM + sequence) as the projectId stored in Firestore by the central e-GP
  scraper.  Some BMA projects are also visible in the central e-GP feed; those
  would create duplicate Firestore documents if naively imported.

  Deduplication strategy (two layers):
    1. Within-run: TenderRecord.tender_id is set to projectNumber (not the BMA
       UUID).  run_all.py deduplicates master.jsonl on tender_id at write time.
    2. Cross-source: BMA records carry source="BMA".  The Firestore import step
       (outside this scraper) should upsert on tender_id and merge fields — not
       create new documents — when a record with the same tender_id already
       exists from the central e-GP feed.
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from tqdm import tqdm

from base_scraper import BaseScraper, TenderRecord, parse_budget

# ── Constants ────────────────────────────────────────────────────────────────
BMA_API_BASE = "https://egp2.bangkok.go.th/appapi/api"
BMA_FILE_BASE = "https://egp2.bangkok.go.th"
BMA_ADMIN_FILE_BASE = "https://adminapiegp.bangkok.go.th"

# BMA masterContractAvailableCode → status
STATUS_MAP = {
    "S1": "open",
    "S2": "open",
    "S3": "awarded",
    "S4": "cancelled",
    "C01": "open",
    "C02": "awarded",
    "C03": "cancelled",
    "C04": "awarded",
    "C05": "cancelled",
    "C06": "awarded",
    "99": "cancelled",
    "C99": "cancelled",
}

# masterTypeIdName → category
CATEGORY_MAP = {
    "ซื้อ": "goods",
    "จ้าง": "services",
    "ก่อสร้าง": "works",
    "จ้างก่อสร้าง": "works",
    "จ้างที่ปรึกษา": "consulting",
    "จ้างออกแบบ": "consulting",
}

# masterMethodIdName → method
METHOD_MAP = {
    "เฉพาะเจาะจง": "specific",
    "คัดเลือก": "selective",
    "ประกวดราคา": "e-bidding",
    "e-bidding": "e-bidding",
    "ประกวดราคาอิเล็กทรอนิกส์": "e-bidding",
    "Auction": "auction",
    "กรณีพิเศษ": "special",
}


class BMAScraper(BaseScraper):
    def __init__(self, days_back: int = 30, page_size: int = 50):
        super().__init__("BMA", "https://egp2.bangkok.go.th")
        self.days_back = days_back
        self.page_size = page_size
        self.api_base = BMA_API_BASE
        self._session_initialized = False

    # ── Session setup ─────────────────────────────────────────────────────────
    def _init_session(self):
        """Establish the userAgent cookie required by the BMA Next.js frontend."""
        if self._session_initialized:
            return
        try:
            self.session.post(
                "https://egp2.bangkok.go.th/api/cookies/useragent",
                json={"userAgent": self.USER_AGENT},
                timeout=15,
            )
            self._session_initialized = True
            self.log.info("BMA session cookie established")
        except Exception as e:
            self.log.warning(f"Session init failed (non-fatal): {e}")

    # ── PDF URL builder (mirrors the h() function in BMA JS bundle) ───────────
    @staticmethod
    def build_file_url(announcement_id: str, path: str) -> Optional[str]:
        if not path:
            return None
        if path.startswith("https://") or path.startswith("http://"):
            return path
        if path.startswith("Uploads"):
            return f"{BMA_ADMIN_FILE_BASE}/{path}"
        return f"{BMA_FILE_BASE}/api/file/{announcement_id}/{path}"

    # ── API helpers ───────────────────────────────────────────────────────────
    def _get(self, path: str, **params) -> Optional[dict]:
        """GET from the BMA appapi with rate limiting."""
        url = f"{self.api_base}{path}"
        resp = self.fetch(url, params=params,
                          headers={"Accept": "application/json", "Cache-Control": "no-cache"})
        if resp is None:
            return None
        try:
            return resp.json()
        except Exception as e:
            self.log.warning(f"JSON parse error for {url}: {e}")
            return None

    def _get_projects_page(self, page_no: int) -> Optional[dict]:
        return self._get("/Projects/GetProjectFromFilter",
                         pageNo=page_no, pageSize=self.page_size)

    def _get_project_detail(self, project_id: str) -> Optional[dict]:
        return self._get("/Projects/GetProjectDetail", projectId=project_id)

    def _get_announcements(self, project_id: str) -> list[dict]:
        data = self._get("/ProjectAnnouncements/GetAnnouncementDetailInProject",
                         projectId=project_id, pageNo=1, pageSize=20)
        if data and data.get("data"):
            return data["data"]
        return []

    def _get_winner(self, project_id: str) -> Optional[dict]:
        data = self._get("/BidderPasss/GetBidderPassInProject",
                         projectId=project_id, pageNo=1, pageSize=5)
        if data and data.get("data"):
            return data["data"][0]
        return None

    def _get_bidders(self, project_id: str) -> list[dict]:
        # BMA retired this endpoint (confirmed 2026-07-10: returns 410 Gone for
        # every project). num_bidders now falls back to the winner-presence
        # heuristic in _build_record. Left as a no-op call site rather than
        # removed so a future BMA API restore only needs this body reverted.
        return []

    def _get_contract(self, project_id: str) -> Optional[dict]:
        data = self._get("/ProjectContracts/GetProjectContractInProject",
                         projectId=project_id, pageNo=1, pageSize=5)
        if data and data.get("data"):
            return data["data"][0]
        return None

    # ── Record builder ────────────────────────────────────────────────────────
    def _build_record(self, list_item: dict, detail: dict,
                      announcements: list[dict],
                      winner: Optional[dict],
                      bidders: list[dict],
                      contract: Optional[dict]) -> TenderRecord:
        pid = list_item.get("projectId", "")

        # Determine announce_date, TOR URL
        announce_date = None
        tor_url = None
        award_date = None

        tor_types = {"ร่างขอบเขตของงาน (TOR)", "ขอบเขตของงาน (TOR)", "TOR", "ร่างTOR"}
        winner_types = {"ผลการคัดเลือก", "ประกาศผู้ชนะ", "ผู้ชนะ", "ผลการประกวดราคา"}

        for ann in announcements:
            pub_date_raw = ann.get("projectAnnouncementPublishDate", "")
            pub_date = _parse_iso_date(pub_date_raw)
            ann_type = ann.get("masterAnnounceTypeName", "")
            ann_id = ann.get("id", "")
            ann_path = ann.get("projectAnnouncementPath", "") or ann.get("projectAnnouncementRssLink", "")
            file_url = self.build_file_url(ann_id, ann_path)

            if announce_date is None:
                announce_date = pub_date

            if ann_type in tor_types or "TOR" in ann_type.upper():
                tor_url = file_url
            elif any(t in ann_type for t in winner_types):
                award_date = pub_date

        # Method / category
        method_raw = detail.get("masterMethodIdName", "") or list_item.get("projectName", "")
        method = _normalize_method(method_raw)

        type_raw = detail.get("masterTypeIdName", "")
        category = CATEGORY_MAP.get(type_raw, "goods")

        # Status
        status_code = list_item.get("masterContractAvailableCode", "S1")
        status = STATUS_MAP.get(status_code, "open")

        # Budget
        budget = list_item.get("projectBudget") or detail.get("projectBudget")

        # Winner info
        winning_bid = None
        winner_name = None
        winner_tax_id = None

        if winner:
            winning_bid = winner.get("bidAmount") or winner.get("agreeBidPrice")
            winner_name = winner.get("companyName") or winner.get("vendorName")
            winner_tax_id = winner.get("taxId") or winner.get("juristic")

        if contract and winning_bid is None:
            winning_bid = contract.get("contractAmount") or contract.get("agreeBidPrice")
        if contract and winner_name is None:
            winner_name = contract.get("vendorName") or contract.get("contractVendorName")

        # Discount-derived winning bid from detail
        if winning_bid is None and detail.get("projectSavingBudget") and budget:
            winning_bid = budget - detail["projectSavingBudget"]

        # Number of bidders
        num_bidders = len(bidders) if bidders else None
        if winner and num_bidders is None:
            num_bidders = 1  # at minimum, there was a winner

        return TenderRecord(
            source="BMA",
            tender_id=list_item.get("projectNumber", pid),
            title=list_item.get("projectName", ""),
            department=detail.get("masterOrgGroupName") or list_item.get("masterOrgGroupName"),
            budget=float(budget) if budget else None,
            winning_bid=float(winning_bid) if winning_bid else None,
            winner_name=winner_name,
            winner_tax_id=winner_tax_id,
            method=method,
            category=category,
            announcement_date=announce_date,
            award_date=award_date,
            tor_url=tor_url,
            announcement_url=f"https://egp2.bangkok.go.th/project-detail/{pid}",
            num_bidders=num_bidders,
            status=status,
        )

    # ── Main scrape ───────────────────────────────────────────────────────────
    def scrape(self) -> list[TenderRecord]:
        self._init_session()

        # Page through all projects (newest first)
        first = self._get_projects_page(1)
        if not first:
            self.log.error("BMA: failed to fetch first page")
            return []

        total_pages = first.get("pageCount", 1)
        total_count = first.get("totalCount", 0)
        self.log.info(f"BMA: {total_count} total projects, {total_pages} pages")

        records: list[TenderRecord] = []
        seen_ids: set[str] = set()

        # We iterate newest → oldest; stop early when records exceed days_back
        cutoff = (datetime.now(timezone.utc) - timedelta(days=self.days_back)).date()

        all_list_items = first.get("data", [])
        pages_to_fetch = range(2, min(total_pages + 1, 500))  # safety cap at 500 pages

        self.log.info(f"BMA: fetching detail for page 1 items...")
        pbar = tqdm(total=total_count, desc="BMA projects", unit="proj")

        stop_early = False
        current_page_data = first.get("data", [])

        for page_no in [1] + list(pages_to_fetch):
            if stop_early:
                break

            if page_no == 1:
                items = current_page_data
            else:
                page_data = self._get_projects_page(page_no)
                if not page_data:
                    self.log.warning(f"BMA: page {page_no} failed, skipping")
                    continue
                items = page_data.get("data", [])

            if not items:
                break

            for item in items:
                tender_id = item.get("projectNumber", "")
                if tender_id in seen_ids:
                    continue
                seen_ids.add(tender_id)

                # Fetch detail + enrichment
                pid = item.get("projectId", "")
                detail = self._get_project_detail(pid) or {}
                announcements = self._get_announcements(pid)
                winner = self._get_winner(pid)
                bidders = self._get_bidders(pid)
                contract = self._get_contract(pid)

                try:
                    record = self._build_record(item, detail, announcements, winner, bidders, contract)
                    records.append(record)
                except Exception as e:
                    self.log.warning(f"BMA: build_record failed for {pid}: {e}")

                pbar.update(1)

                # Early stop if announce_date before cutoff (data is newest-first)
                if record.announcement_date:
                    try:
                        from datetime import date
                        ann = date.fromisoformat(record.announcement_date)
                        if ann < cutoff:
                            self.log.info(f"BMA: reached cutoff {cutoff}, stopping")
                            stop_early = True
                            break
                    except Exception:
                        pass

        pbar.close()
        self.log.info(f"BMA: {len(records)} records scraped ({len(seen_ids)} unique IDs)")
        return records


# ── Helpers ──────────────────────────────────────────────────────────────────
def _parse_iso_date(iso: str) -> Optional[str]:
    """Convert ISO 8601 UTC datetime → 'YYYY-MM-DD'."""
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except Exception:
        return None


def _normalize_method(raw: str) -> str:
    for thai, eng in METHOD_MAP.items():
        if thai in raw:
            return eng
    if "e-bidding" in raw.lower():
        return "e-bidding"
    return raw or "unknown"
