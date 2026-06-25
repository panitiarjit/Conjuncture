"""
Group B — Energy & Utilities scrapers: MEA, PEA, PWA.

MEA  (การไฟฟ้านครหลวง)      https://procurement.mea.or.th
     DataTables server-side POST — session cookie required.
     Endpoint: POST /Procurement/Search → JSON, 825+ records.
     Enrichment: GET /Procurement/Detail/{KEY_ID} for budget + department.

PEA  (การไฟฟ้าส่วนภูมิภาค)  https://bidding.pea.co.th
     Static HTML, ?page=N pagination, ~20/page.
     e-GP project IDs embedded directly in the listing table.

PWA  (การประปาส่วนภูมิภาค)  https://eprocurement.pwa.co.th
     Static HTML, latest 25 awarded tenders (no server-side pagination).
     Rich data: budget, ref price, winner, contract no in listing.
"""
from __future__ import annotations

import re
import sys
import os
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from base_scraper import BaseScraper, TenderRecord, parse_budget, parse_thai_date, THAI_MONTHS

# ── Site registry (used by run_all.py) ───────────────────────────────────────
UTILITY_SITES = {
    "mea": {"url": "https://procurement.mea.or.th", "name_th": "การไฟฟ้านครหลวง"},
    "pea": {"url": "https://bidding.pea.co.th",      "name_th": "การไฟฟ้าส่วนภูมิภาค"},
    "pwa": {"url": "https://eprocurement.pwa.co.th",  "name_th": "การประปาส่วนภูมิภาค"},
}

# ── MEA METHOD_ID (int from DataTables JSON) → method string ─────────────────
_MEA_METHOD_MAP = {
    1: "specific",
    2: "e-bidding",
    3: "selective",
    4: "e-bidding",
    5: "auction",
    6: "specific",
}

# ── National e-GP project number: 11+ consecutive digits ─────────────────────
_EGP_ID_RE = re.compile(r'\b(\d{11,})\b')

# ── Method text normalisation (shared by MEA detail + PEA) ───────────────────
_METHOD_KEYWORDS = [
    ("e-bidding",   ["e-bidding", "ประกวดราคาอิเล็กทรอนิกส์", "e-Bidding"]),
    ("specific",    ["เฉพาะเจาะจง"]),
    ("selective",   ["คัดเลือก"]),
    ("auction",     ["ประมูล", "Auction"]),
    ("works",       ["ก่อสร้าง"]),  # method keyword, not category
]

# ── Category inference from Thai title ───────────────────────────────────────
_WORKS_KW  = ["ก่อสร้าง", "วางท่อ", "ปรับปรุง", "ซ่อมแซม", "ติดตั้ง", "ย้ายแนวท่อ",
               "ขุดวางท่อ", "จ้างเหมา", "งานก่อ"]
_GOODS_KW  = ["จัดซื้อ", "ซื้อ", "จัดหา"]
_SVC_KW    = ["บริการ", "บำรุงรักษา", "ที่ปรึกษา", "PM", "สูบน้ำ"]
_CONSULT_KW= ["ที่ปรึกษา", "ออกแบบ"]


def _infer_category(title: str) -> str:
    for kw in _CONSULT_KW:
        if kw in title:
            return "consulting"
    for kw in _WORKS_KW:
        if kw in title:
            return "works"
    for kw in _SVC_KW:
        if kw in title:
            return "services"
    for kw in _GOODS_KW:
        if kw in title:
            return "goods"
    return "goods"


def _normalize_method(text: str, fallback_id: Optional[int] = None) -> str:
    for eng, keywords in _METHOD_KEYWORDS:
        for kw in keywords:
            if kw in text:
                return eng
    if fallback_id is not None:
        return _MEA_METHOD_MAP.get(fallback_id, "unknown")
    return "unknown"


def _extract_egp_id(text: str) -> Optional[str]:
    """Return first 11+-digit national project number found in text, or None."""
    m = _EGP_ID_RE.search(text)
    return m.group(1) if m else None


def _parse_dotnet_date(dot_date: str) -> Optional[date]:
    """/Date(1782061200000)/ → Python date (UTC)."""
    m = re.search(r'/Date\((-?\d+)\)/', dot_date)
    if not m:
        return None
    try:
        return datetime.fromtimestamp(int(m.group(1)) / 1000, tz=timezone.utc).date()
    except Exception:
        return None


def _parse_pea_date(text: str) -> Optional[date]:
    """Extract first Thai full-month-name date from PEA method/date cell."""
    for name, mo in THAI_MONTHS.items():
        m = re.search(r'(\d{1,2})\s+' + re.escape(name) + r'\s+(\d{4})', text)
        if m:
            day = int(m.group(1))
            be_year = int(m.group(2))
            ce_year = be_year - 543
            try:
                return date(ce_year, mo, day)
            except ValueError:
                continue
    return None


def _parse_pea_bid_deadline(text: str) -> Optional[date]:
    """Extract the bid submission date ('วันที่เสนอราคา: DD Month YYYY') from the method/date cell."""
    m = re.search(r'วันที่เสนอราคา[:\s]+(\d{1,2})\s+(\S+)\s+(\d{4})', text)
    if not m:
        return None
    day, month_name, be_year = int(m.group(1)), m.group(2), int(m.group(3))
    mo = THAI_MONTHS.get(month_name)
    if not mo:
        return None
    try:
        return date(be_year - 543, mo, day)
    except ValueError:
        return None


def _parse_pwa_winner(text: str) -> tuple[Optional[str], Optional[float]]:
    """
    Parse PWA winner/bidder cell.
    Cell format variants:
      "บจก. ไบนารี่พลัส  ราคาที่เสนอ 537,140.00 บาท"
      "1. บริษัท X ราคาที่เสนอ Y  2. บริษัท Z ..."
    Returns (winner_name, winning_bid).
    First listed company treated as winner/lowest bidder.
    """
    if not text:
        return None, None
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove leading ordinal "1. " or "1) "
    first_entry = re.sub(r'^\d+[.)]\s*', '', text)
    # Split off the price
    price_m = re.search(r'ราคา(?:ที่เสนอ)?\s*([\d,]+(?:\.\d+)?)', first_entry)
    price = parse_budget(price_m.group(1)) if price_m else None
    # Name is everything before the price reference
    if price_m:
        name = first_entry[:price_m.start()].strip().rstrip('/').strip()
    else:
        # No price found: take up to 80 chars before line break / next bidder
        name = re.split(r'\n|\d+\.', first_entry)[0].strip()[:80]
    return (name or None, price)


# ─────────────────────────────────────────────────────────────────────────────
class UtilitiesScraper(BaseScraper):
    """
    Single class that dispatches to site-specific scrape methods.
    Instantiated by run_all.py as:
        UtilitiesScraper(key, cfg["url"], cfg["name_th"], days_back=N)
    """

    def __init__(self, source_key: str, base_url: str, name_th: str,
                 days_back: int = 30):
        super().__init__(source_key.upper(), base_url)
        self.source_key = source_key.lower()
        self.name_th = name_th
        self.days_back = days_back
        self.cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).date()

    def scrape(self) -> list[TenderRecord]:
        dispatch = {
            "mea": self._scrape_mea,
            "pea": self._scrape_pea,
            "pwa": self._scrape_pwa,
        }
        fn = dispatch.get(self.source_key)
        if fn:
            return fn()
        return []

    # ──────────────────────────────────────────────────────────────────────────
    # MEA — DataTables server-side POST
    # ──────────────────────────────────────────────────────────────────────────
    def _scrape_mea(self) -> list[TenderRecord]:
        base = "https://procurement.mea.or.th"

        # Establish session: AspxAutoDetectCookieSupport cookie
        if self.fetch(f"{base}/Procurement/Index") is None:
            self.log.error("MEA: failed to reach site")
            return []

        records: list[TenderRecord] = []
        page_size = 100
        start = 0
        total_records: Optional[int] = None

        while True:
            self._rate_limit()
            try:
                resp = self.session.post(
                    f"{base}/Procurement/Search",
                    data={
                        "draw":              str(start // page_size + 1),
                        "start":             str(start),
                        "length":            str(page_size),
                        "search[value]":     "",
                        "search[regex]":     "false",
                        "order[0][column]":  "3",
                        "order[0][dir]":     "desc",
                        "columns[0][data]":  "PUBLISH_NO",
                        "columns[1][data]":  "SUBJECT",
                        "columns[2][data]":  "METHOD_DESC",
                        "columns[3][data]":  "DETAIL_DT_TEXT",
                        "columns[4][data]":  "",
                        "columns[5][data]":  "BID_DT_TEXT",
                        "PURCHASE_TYPE_ID":  "",
                        "METHOD_ID":         "",
                    },
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type":     "application/x-www-form-urlencoded",
                        "Referer":          f"{base}/Procurement/Index",
                    },
                    timeout=20,
                )
            except Exception as e:
                self.log.error(f"MEA Search request error: {e}")
                break

            if resp.status_code != 200:
                self.log.error(f"MEA Search: HTTP {resp.status_code}")
                break

            try:
                data = resp.json()
            except Exception as e:
                self.log.error(f"MEA Search JSON parse error: {e}")
                break

            if total_records is None:
                total_records = data.get("recordsTotal", 0)
                self.log.info(f"MEA: {total_records} total records (fetching from newest)")

            items = data.get("data", [])
            if not items:
                break

            stop_early = False
            for item in items:
                ann_date = _parse_dotnet_date(item.get("DETAIL_DT", ""))
                if ann_date and ann_date < self.cutoff:
                    self.log.info(f"MEA: reached cutoff {self.cutoff} at {ann_date}, stopping")
                    stop_early = True
                    break

                publish_no = item.get("PUBLISH_NO", "")
                # Use national e-GP ID if embedded, else first token of announcement number
                tender_id = _extract_egp_id(publish_no) or re.split(r'\s', publish_no)[0]

                method_desc = item.get("METHOD_DESC", "") or ""
                method = _normalize_method(method_desc, fallback_id=item.get("METHOD_ID"))

                key_id = item.get("KEY_ID", "")
                budget = None
                department = None

                if key_id:
                    detail = self._fetch_mea_detail(base, key_id)
                    if detail:
                        budget   = detail.get("budget")
                        department = detail.get("department")

                records.append(TenderRecord(
                    source="MEA",
                    tender_id=tender_id,
                    title=item.get("SUBJECT", ""),
                    department=department,
                    budget=budget,
                    method=method,
                    category=_infer_category(item.get("SUBJECT", "")),
                    announcement_date=ann_date.isoformat() if ann_date else None,
                    submission_deadline=(
                        _parse_dotnet_date(item.get("BID_DT", "")).isoformat()
                        if item.get("BID_DT") else None
                    ),
                    announcement_url=f"{base}/Procurement/Detail/{key_id}" if key_id else None,
                    status="open",
                ))

            if stop_early or start + page_size >= (total_records or 0):
                break
            start += page_size

        self.log.info(f"MEA: {len(records)} records scraped")
        return records

    def _fetch_mea_detail(self, base: str, key_id: str) -> Optional[dict]:
        resp = self.fetch(f"{base}/Procurement/Detail/{key_id}")
        if resp is None:
            return None
        html = resp.text

        # Budget: look for "วงเงินงบประมาณ" followed by a number
        budget = None
        for pat in [
            r'วงเงินงบประมาณ[^<]{0,40}</[^>]+>\s*<[^>]+>\s*([\d,]+(?:\.\d+)?)',
            r'วงเงิน[^<]{0,20}</[^>]+>\s*<[^>]+>\s*([\d,]+(?:\.\d+)?)',
            r'>([\d,]{4,}(?:\.\d+)?)\s*บาท',
        ]:
            m = re.search(pat, html)
            if m:
                budget = parse_budget(m.group(1))
                if budget and budget > 0:
                    break

        # Department: หน่วยงานที่จัดซื้อจัดจ้าง
        department = None
        m = re.search(
            r'หน่วยงานที่[่]?จัดซื้อจัดจ้าง[^<]*</[^>]+>\s*<[^>]+>\s*([^<]{3,100})',
            html,
        )
        if m:
            department = re.sub(r'\s+', ' ', m.group(1)).strip()

        return {"budget": budget, "department": department}

    # ──────────────────────────────────────────────────────────────────────────
    # PEA — static HTML, ?page=N pagination (Drupal 0-indexed)
    # PEA's bidding site is updated infrequently; records may be months old.
    # We don't filter by announcement_date (would return 0); instead we parse
    # the bid submission deadline to set open/closed status.
    # ──────────────────────────────────────────────────────────────────────────
    def _scrape_pea(self) -> list[TenderRecord]:
        from datetime import date as _date
        base = "https://bidding.pea.co.th"
        records: list[TenderRecord] = []
        seen: set[str] = set()
        page = 0          # Drupal 0-indexed: page 0 = most recent
        MAX_PAGES = 5     # cap at ~100 tenders
        today = _date.today()

        while page < MAX_PAGES:
            resp = self.fetch(f"{base}/procurement/list", params={"page": str(page)})
            if resp is None:
                self.log.warning(f"PEA: page {page} failed, stopping")
                break

            html = resp.text
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
            data_rows = [r for r in rows if re.search(r'<td', r, re.IGNORECASE)]

            if not data_rows:
                break

            new_this_page = 0

            for row in data_rows:
                cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
                clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
                if len(clean) < 3:
                    continue

                announce_no  = clean[0]
                egp_raw      = clean[1].strip()
                title        = clean[2].strip()
                method_date  = clean[3] if len(clean) > 3 else ""

                if not title:
                    continue

                tender_id = egp_raw if re.match(r'^\d{9,}$', egp_raw) else announce_no
                if not tender_id:
                    continue
                if tender_id in seen:
                    continue
                seen.add(tender_id)

                method    = _normalize_method(method_date)
                ann_date  = _parse_pea_date(method_date)
                bid_date  = _parse_pea_bid_deadline(method_date)
                cancelled = "ถูกยกเลิก" in method_date

                if cancelled:
                    status = "cancelled"
                elif bid_date and bid_date < today:
                    status = "closed"
                else:
                    status = "open"

                all_links = re.findall(r'href="([^"]+)"', row)
                detail_rel = next(
                    (l for l in all_links if '/procurement/' in l and 'pdf' not in l.lower()), None)
                pdf_rel = next(
                    (l for l in all_links if l.lower().endswith('.pdf')), None)

                detail_url = (base + detail_rel) if detail_rel else None
                pdf_url    = (base + pdf_rel) if pdf_rel else None

                budget = None
                if detail_url:
                    d = self._fetch_pea_detail(detail_url)
                    if d:
                        budget = d.get("budget")

                new_this_page += 1
                records.append(TenderRecord(
                    source="PEA",
                    tender_id=tender_id,
                    title=title,
                    budget=budget,
                    method=method,
                    category=_infer_category(title),
                    announcement_date=ann_date.isoformat() if ann_date else None,
                    submission_deadline=bid_date.isoformat() if bid_date else None,
                    announcement_url=detail_url or f"{base}/procurement/list",
                    tor_url=pdf_url,
                    status=status,
                ))

            if new_this_page == 0:
                break

            linked_pages = set(int(p) for p in re.findall(r'[?&]page=(\d+)', html))
            if not linked_pages or max(linked_pages) <= page:
                break

            page += 1

        self.log.info(f"PEA: {len(records)} records scraped across {page + 1} pages")
        return records

    def _fetch_pea_detail(self, url: str) -> Optional[dict]:
        resp = self.fetch(url)
        if resp is None:
            return None
        html = resp.text
        budget = None
        for pat in [
            r'วงเงิน[^<]{0,30}</[^>]+>\s*<[^>]+>\s*([\d,]+(?:\.\d+)?)',
            r'วงเงิน[งบประมาณ]*[^<]{0,30}([\d,]{4,}(?:\.\d+)?)',
        ]:
            m = re.search(pat, html)
            if m:
                v = parse_budget(m.group(1))
                if v and v > 0:
                    budget = v
                    break
        return {"budget": budget}

    # ──────────────────────────────────────────────────────────────────────────
    # PWA — static HTML, latest 25 awarded tenders
    # ──────────────────────────────────────────────────────────────────────────
    def _scrape_pwa(self) -> list[TenderRecord]:
        base = "https://eprocurement.pwa.co.th"
        resp = self.fetch(f"{base}/report/conclude-type-1")
        if resp is None:
            self.log.error("PWA: failed to reach site")
            return []

        html = resp.text
        records: list[TenderRecord] = []
        seen: set[str] = set()

        # Table columns (9 total):
        # 0: เลขที่ประกาศ  1: ชื่อโครงการ  2: วงเงินงบประมาณ  3: ราคากลาง
        # 4: รายชื่อผู้เสนอราคา  5: ผู้ที่ได้รับการคัดเลือก  6: เหตุผล
        # 7: เลขที่สัญญา  8: วันที่เผยแพร่
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)

        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
            if not cells:
                continue
            clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]

            title = clean[1] if len(clean) > 1 else ""
            if not title:
                continue

            announce_no  = clean[0] if len(clean) > 0 else ""
            budget_raw   = clean[2] if len(clean) > 2 else ""
            # ref_price    = clean[3] — available but not in TenderRecord schema
            bidder_raw   = clean[4] if len(clean) > 4 else ""
            winner_raw   = clean[5] if len(clean) > 5 else ""
            contract_no  = clean[7] if len(clean) > 7 else ""
            pub_date_raw = clean[8] if len(clean) > 8 else ""

            # tender_id: e-GP national ID if announce_no looks like one; else PWA local
            tender_id = announce_no if announce_no and announce_no != "-" else \
                        (_extract_egp_id(announce_no) or title[:30])
            if not tender_id:
                continue
            if tender_id in seen:
                continue
            seen.add(tender_id)

            budget = parse_budget(budget_raw)

            # Winner: prefer the dedicated winner column (col 5) if non-empty
            winner_cell = winner_raw.strip() if winner_raw.strip() else bidder_raw
            winner_name, winning_bid = _parse_pwa_winner(winner_cell)

            ann_date = parse_thai_date(pub_date_raw)

            records.append(TenderRecord(
                source="PWA",
                tender_id=tender_id,
                title=title,
                budget=budget,
                winning_bid=winning_bid,
                winner_name=winner_name,
                method="unknown",
                category=_infer_category(title),
                announcement_date=ann_date,
                announcement_url=f"{base}/report/conclude-type-1",
                status="awarded" if winner_name else "open",
            ))

        self.log.info(
            f"PWA: {len(records)} records scraped "
            f"(site shows latest 25 only; 494 total on server but no pagination)")
        return records
