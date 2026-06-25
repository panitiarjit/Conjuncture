"""
Group C — EGAT (Electricity Generating Authority of Thailand).

Endpoint: POST https://bidding.egat.co.th/procure/procure_api.php
Format:   JSON, 10 records/page, sorted newest-first by published_date
Auth:     None required — publicly accessible
Robots:   No robots.txt at domain root (checked 2026-06-22)

Fields from list API:
  id             → EGAT internal project ID (used in detail URL)
  title          → project name
  project_id     → e-GP national project number (empty when not linked to central e-GP)
  method_name    → procurement method (Thai)
  subdept_name   → department chain (full path separated by spaces)
  published_date → announcement date (ISO: YYYY-MM-DD)
  total_records  → total count in first-page response (used to set up pagination)

Budget: NOT in the list API. The detail page
  https://bidding.egat.co.th/procure/project/index.php?project_id={id}
  contains budget info in a PDF/attachment reference, but no structured field.
  Detail fetch is skipped to avoid per-record HTTP overhead; budget is left None.

Pagination: client-supplied page variable; server returns 10 records/page,
  newest first. Scraper stops when published_date drops below cutoff date.
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
from datetime import datetime, timezone, timedelta, date

from base_scraper import BaseScraper, TenderRecord

_ROW_PER_PAGE = 10
_EGP_ID_RE = re.compile(r'\b(\d{11,})\b')

# Thai method name → unified method key
_METHOD_MAP = {
    "ประกวดราคา":          "e-bidding",
    "e-bidding":           "e-bidding",
    "เปรียบเทียบราคา":     "price-comparison",
    "คัดเลือก":            "selective",
    "เฉพาะเจาะจง":         "specific-appointment",
    "ปรึกษา":              "consultant",
    "จ้างที่ปรึกษา":       "consultant",
}


def _norm_method(raw: str) -> str:
    for k, v in _METHOD_MAP.items():
        if k in raw:
            return v
    return raw.strip()


def _extract_egp_id(raw: str | None) -> str | None:
    if not raw:
        return None
    m = _EGP_ID_RE.search(str(raw))
    return m.group(1) if m else None


class EGATScraper(BaseScraper):
    """Scrape procurement announcements from EGAT bidding portal."""

    def __init__(self, days_back: int = 30):
        super().__init__("EGAT", "https://bidding.egat.co.th")
        self.days_back = days_back
        self.cutoff: date = (datetime.now(timezone.utc) - timedelta(days=days_back)).date()

    def scrape(self) -> list[TenderRecord]:
        records: list[TenderRecord] = []
        page = 1
        total_records = None
        # EGAT API sorts by id desc, NOT by published_date. Dates are mixed on
        # every page. Strategy: fetch pages until the whole page has no records
        # within the cutoff window, or until total pages exhausted.
        _MAX_PAGES = 50  # at 10/page = 500 most-recent records

        while page <= _MAX_PAGES:
            payload = {
                "search": {
                    "search":           "",
                    "methodID":         "",
                    "rowPerPage":       _ROW_PER_PAGE,
                    "totalRecords":     total_records or 0,
                    "currentPage":      page,
                    "currentTotalPage": 0,
                    "typeID":           "",
                },
                "type": "search",
            }
            resp = self.session.post(
                "https://bidding.egat.co.th/procure/procure_api.php",
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            rows = resp.json()

            if not rows:
                break

            if total_records is None:
                total_records = rows[0].get("total_records", 0)

            in_window = 0
            for row in rows:
                pub_str = row.get("published_date", "")
                try:
                    pub_date = date.fromisoformat(pub_str)
                except (ValueError, TypeError):
                    pub_date = None

                if pub_date and pub_date < self.cutoff:
                    continue  # skip old records but keep scanning page

                in_window += 1
                egp_id = _extract_egp_id(row.get("project_id")) or _extract_egp_id(str(row.get("id")))
                method_raw = row.get("method_name", "")
                dept_chain = (row.get("subdept_name") or "").strip()

                records.append(TenderRecord(
                    source            = "EGAT",
                    tender_id         = egp_id or f"EGAT-{row['id']}",
                    title             = row.get("title", "").strip(),
                    budget            = None,  # not in list API
                    method            = _norm_method(method_raw),
                    department        = dept_chain or None,
                    category          = None,
                    announcement_date = pub_date.isoformat() if pub_date else None,
                    status            = "open",
                    announcement_url  = (
                        f"https://bidding.egat.co.th/procure/project/index.php"
                        f"?project_id={row['id']}"
                    ),
                ))

            # Stop if the entire page had nothing within the window
            if in_window == 0:
                break

            page += 1
            self._rate_limit()

        self.log.info(f"EGAT: {len(records)} records in last {self.days_back} days")
        return records
