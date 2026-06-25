"""
Group E — PTT Public Company Limited.

Endpoint: POST https://procurement.pttplc.com/th/Award/Table
Format:   HTML response (card-based layout), 50 cards/page
Auth:     None required — publicly accessible
Robots:   No robots.txt restrictions at this path (checked 2026-06-22)

Request parameters (form-urlencoded):
  Keyword, Title, ProcurementTypeCode, ProcurementOwnerCode,
  StartDate (DD/MM/YYYY BE), EndDate (DD/MM/YYYY BE),
  gridCriteria[pageSize]=50, gridCriteria[page]=N,
  gridCriteria[sortby]=PublishDateTime, gridCriteria[sortdir]=desc

Fields per card:
  เลขที่ประกาศ     → PTT announcement number (used as tender_id if no e-GP ID)
  เลขที่โครงการ    → e-GP national project number (YYMM+seq format when present)
  Subject heading  → project title
  ประเภทการจัดหา   → procurement type (used for method inference)
  หน่วยงานจัดหา    → procuring unit/department
  วงเงิน/จำนวนเงิน → budget/award amount in THB (formatted: 139,421.00)
  วันที่ประกาศ     → announcement date (Thai format: DD Mmm. YYYY BE)
  บริษัท/ห้าง/ร้าน → winner name — "ดูรายละเอียด..." when hidden; left None

Date filtering uses BE StartDate/EndDate via the API (server-side filter).
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from bs4 import BeautifulSoup

from base_scraper import BaseScraper, TenderRecord, parse_budget

_PAGE_SIZE = 50
_EGP_ID_RE = re.compile(r'\b(\d{11,})\b')

_THAI_MONTHS = {
    "ม.ค.": 1,  "ก.พ.": 2,  "มี.ค.": 3,  "เม.ย.": 4,
    "พ.ค.": 5,  "มิ.ย.": 6, "ก.ค.": 7,   "ส.ค.": 8,
    "ก.ย.": 9,  "ต.ค.": 10, "พ.ย.": 11,  "ธ.ค.": 12,
    # Long forms
    "มกราคม": 1,   "กุมภาพันธ์": 2,  "มีนาคม": 3,   "เมษายน": 4,
    "พฤษภาคม": 5,  "มิถุนายน": 6,    "กรกฎาคม": 7,   "สิงหาคม": 8,
    "กันยายน": 9,  "ตุลาคม": 10,     "พฤศจิกายน": 11,"ธันวาคม": 12,
}


def _parse_thai_date(s: str) -> Optional[date]:
    """Parse Thai date like '19 มิ.ย. 2569' (BE) → date (CE)."""
    s = s.strip()
    for mth_str, mth_num in _THAI_MONTHS.items():
        if mth_str in s:
            parts = s.replace(mth_str, "").split()
            nums = [p for p in parts if p.isdigit()]
            if len(nums) >= 2:
                day, year_be = int(nums[0]), int(nums[-1])
                return date(year_be - 543, mth_num, day)
    return None


def _be_date_str(d: date) -> str:
    """Format a date as 'DD/MM/YYYY' in BE for PTT API StartDate/EndDate."""
    return f"{d.day:02d}/{d.month:02d}/{d.year + 543}"


def _extract_egp_id(text: str) -> Optional[str]:
    m = _EGP_ID_RE.search(text)
    return m.group(1) if m else None


def _infer_method(type_str: str) -> str:
    t = type_str.lower()
    if "e-bidding" in t or "ประกวดราคาอิเล็กทรอนิกส์" in t:
        return "e-bidding"
    if "ตลาดอิเล็กทรอนิกส์" in t or "e-market" in t:
        return "e-market"
    if "เฉพาะเจาะจง" in t:
        return "specific-appointment"
    if "ปรึกษา" in t:
        return "consultant"
    if "ประกวดราคา" in t:
        return "e-bidding"
    return type_str.strip()


def _parse_cards(html: str, cutoff: date) -> tuple[list[TenderRecord], bool]:
    """Parse one page of PTT Award/Table HTML. Returns (records, cutoff_reached)."""
    soup = BeautifulSoup(html, "html.parser")
    records: list[TenderRecord] = []
    cutoff_reached = False

    for card in soup.select(".card-announce"):
        text = card.get_text(separator="|", strip=True)

        # Announcement number + optional e-GP project number
        header = card.select_one(".title-announce")
        header_text = header.get_text(" ", strip=True) if header else ""
        egp_id = _extract_egp_id(header_text)

        # PTT announce number: "1141000693"
        ann_num_m = re.search(r'\b(\d{10})\b', header_text)
        announce_num = ann_num_m.group(1) if ann_num_m else None

        tender_id = egp_id or (f"PTT-{announce_num}" if announce_num else None)
        if not tender_id:
            continue

        # Title (h2 inside card body)
        title_el = card.select_one("h2.subject")
        title = title_el.get_text(strip=True) if title_el else ""

        # Extract label/value pairs
        def _get_val(label: str) -> Optional[str]:
            idx = text.find(label)
            if idx < 0:
                return None
            parts = text[idx + len(label):].split("|")
            return parts[0].strip() if parts else None

        proc_type = _get_val("ประเภทการจัดหา:") or ""
        department = _get_val("หน่วยงานจัดหา:") or ""
        amount_str = _get_val("วงเงิน/จำนวนเงิน:")
        date_str = _get_val("วันที่ประกาศ :")
        winner_raw = _get_val("บริษัท/ห้าง/ร้าน :")

        budget = parse_budget(amount_str) if amount_str else None
        ann_date = _parse_thai_date(date_str) if date_str else None

        if ann_date and ann_date < cutoff:
            cutoff_reached = True
            break

        winner = winner_raw if winner_raw and "คลิก" not in winner_raw and "ดูราย" not in winner_raw else None

        records.append(TenderRecord(
            source            = "PTT",
            tender_id         = tender_id,
            title             = title,
            budget            = budget,
            method            = _infer_method(proc_type),
            department        = department or None,
            category          = None,
            announcement_date = ann_date.isoformat() if ann_date else None,
            status            = "awarded",
            announcement_url  = "https://procurement.pttplc.com/th/award/index",
            winner_name       = winner,
            winning_bid       = budget,
        ))

    return records, cutoff_reached


class PTTScraper(BaseScraper):
    """Scrape award results from PTT procurement portal."""

    def __init__(self, days_back: int = 30):
        super().__init__("PTT", "https://procurement.pttplc.com")
        self.days_back = days_back
        self.cutoff: date = (datetime.now(timezone.utc) - timedelta(days=days_back)).date()

    def scrape(self) -> list[TenderRecord]:
        records: list[TenderRecord] = []
        start_date = _be_date_str(self.cutoff)
        end_date   = _be_date_str(datetime.now(timezone.utc).date())
        page = 1

        while True:
            resp = self.session.post(
                "https://procurement.pttplc.com/th/Award/Table",
                headers={
                    "Content-Type":    "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer":         "https://procurement.pttplc.com/th/award/index",
                    "Accept":          "text/html, */*; q=0.01",
                },
                data={
                    "Keyword":               "",
                    "Title":                 "",
                    "ProcurementTypeCode":   "",
                    "ProcurementOwnerCode":  "",
                    "StartDate":             start_date,
                    "EndDate":               end_date,
                    "gridCriteria[pageSize]": str(_PAGE_SIZE),
                    "gridCriteria[page]":    str(page),
                    "gridCriteria[sortby]":  "PublishDateTime",
                    "gridCriteria[sortdir]": "desc",
                },
                timeout=30,
            )
            resp.raise_for_status()

            page_records, cutoff_reached = _parse_cards(resp.text, self.cutoff)
            records.extend(page_records)

            if cutoff_reached or len(page_records) < _PAGE_SIZE:
                break

            page += 1
            self._rate_limit()

        self.log.info(f"PTT: {len(records)} records in last {self.days_back} days")
        return records
