"""
Base scraper: rate limiting, retry, robots.txt, raw HTML storage, logging.
All site-specific scrapers inherit from BaseScraper.
"""
from __future__ import annotations

import hashlib
import logging
import random
import re
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ── Thai month name → int ────────────────────────────────────────────────────
THAI_MONTHS = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
}

BE_OFFSET = 543  # Buddhist Era → Common Era

# ── Unified output record ─────────────────────────────────────────────────────
@dataclass
class TenderRecord:
    source: str = ""
    tender_id: str = ""
    title: str = ""
    title_en: Optional[str] = None
    department: Optional[str] = None
    budget: Optional[float] = None
    winning_bid: Optional[float] = None
    winner_name: Optional[str] = None
    winner_tax_id: Optional[str] = None
    method: Optional[str] = None
    category: Optional[str] = None
    announcement_date: Optional[str] = None   # ISO date string
    submission_deadline: Optional[str] = None
    award_date: Optional[str] = None
    tor_url: Optional[str] = None
    tor_text: Optional[str] = None
    announcement_url: Optional[str] = None
    num_bidders: Optional[int] = None
    status: Optional[str] = None
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


# ── Date helpers ──────────────────────────────────────────────────────────────
def parse_thai_date(text: str) -> Optional[str]:
    """
    Parse Thai Buddhist Era date strings to ISO 8601 (CE).
    Handles:
      - dd/mm/yyyy  (Buddhist year)
      - dd เดือน yyyy  (Thai month name + Buddhist year)
      - d Month YYYY  (already CE if year < 2400)
    Returns "YYYY-MM-DD" or None.
    """
    if not text:
        return None
    text = text.strip()

    # dd/mm/yyyy or dd-mm-yyyy
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y > 2400:
            y -= BE_OFFSET
        try:
            return f"{y:04d}-{mo:02d}-{d:02d}"
        except Exception:
            return None

    # dd Thai-month-name yyyy
    for name, mo in THAI_MONTHS.items():
        if name in text:
            m = re.search(r"(\d{1,2})\s+" + re.escape(name) + r"\s+(\d{4})", text)
            if m:
                d, y = int(m.group(1)), int(m.group(2))
                if y > 2400:
                    y -= BE_OFFSET
                return f"{y:04d}-{mo:02d}-{d:02d}"

    return None


def parse_budget(text: str) -> Optional[float]:
    """Strip Thai currency formatting and return float."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


# ── Base scraper ──────────────────────────────────────────────────────────────
class BaseScraper:
    USER_AGENT = "Conjuncture-Research-Bot/1.0 (procurement transparency research)"
    MAX_RETRIES = 3
    MIN_DELAY = 1.0   # seconds between requests (per domain)
    JITTER = (0.5, 1.5)

    def __init__(self, source_name: str, base_url: str):
        self.source_name = source_name
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc

        # Output dirs
        self.raw_dir = Path(__file__).parent / "output" / "raw" / self.domain
        self.parsed_dir = Path(__file__).parent / "output" / "parsed"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.parsed_dir.mkdir(parents=True, exist_ok=True)

        # Logger (file + console)
        log_path = Path(__file__).parent / "logs" / "scraper.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self.log = logging.getLogger(source_name)
        if not self.log.handlers:
            self.log.setLevel(logging.INFO)
            fmt = logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s")
            fh = logging.FileHandler(log_path, encoding="utf-8")
            fh.setFormatter(fmt)
            ch = logging.StreamHandler()
            ch.setFormatter(fmt)
            self.log.addHandler(fh)
            self.log.addHandler(ch)

        # HTTP session
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.USER_AGENT})

        # robots.txt
        self._rp: Optional[urllib.robotparser.RobotFileParser] = None
        self._last_request_time = 0.0

        # Rendering method used
        self.render_method: str = "requests"  # or "playwright"

    # ── robots.txt ────────────────────────────────────────────────────────────
    def _load_robots(self) -> urllib.robotparser.RobotFileParser:
        if self._rp is not None:
            return self._rp
        rp = urllib.robotparser.RobotFileParser()
        robots_url = urljoin(self.base_url, "/robots.txt")
        try:
            resp = self.session.get(robots_url, timeout=10)
            rp.parse(resp.text.splitlines())
            self.log.info(f"robots.txt loaded from {robots_url}")
        except Exception as e:
            self.log.warning(f"Could not load robots.txt ({robots_url}): {e} — proceeding")
        self._rp = rp
        return rp

    def is_allowed(self, url: str) -> bool:
        rp = self._load_robots()
        allowed = rp.can_fetch(self.USER_AGENT, url)
        if not allowed:
            self.log.warning(f"robots.txt disallows: {url}")
        return allowed

    # ── Rate-limited fetch ────────────────────────────────────────────────────
    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        delay = self.MIN_DELAY + random.uniform(*self.JITTER)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self._last_request_time = time.time()

    def fetch(self, url: str, **kwargs) -> Optional[requests.Response]:
        """Fetch URL with rate limiting, retry, robots.txt check, raw HTML save."""
        if not self.is_allowed(url):
            return None

        self._rate_limit()
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                resp = self.session.get(url, timeout=30, **kwargs)
                if resp.status_code in (429, 503):
                    wait = 2 ** attempt
                    self.log.warning(f"{resp.status_code} on {url}, retry {attempt}/{self.MAX_RETRIES} in {wait}s")
                    time.sleep(wait)
                    continue
                if resp.status_code == 403:
                    self.log.error(f"403 Forbidden: {url} — skipping")
                    return None
                if resp.status_code >= 400:
                    self.log.warning(f"HTTP {resp.status_code}: {url}")
                    return None
                resp.encoding = resp.apparent_encoding or "utf-8"
                self._save_raw(url, resp.text)
                return resp
            except requests.RequestException as e:
                self.log.warning(f"Request error attempt {attempt}/{self.MAX_RETRIES}: {e}")
                if attempt < self.MAX_RETRIES:
                    time.sleep(2 ** attempt)
        self.log.error(f"All retries exhausted for {url}")
        return None

    def _save_raw(self, url: str, html: str):
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        path = self.raw_dir / f"{ts}_{url_hash}.html"
        path.write_text(html, encoding="utf-8")

    # ── Playwright fallback ───────────────────────────────────────────────────
    def fetch_playwright(self, url: str) -> Optional[str]:
        """Render JS-heavy page via Playwright, return HTML string."""
        if not self.is_allowed(url):
            return None
        self._rate_limit()
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=self.USER_AGENT)
                page.goto(url, wait_until="networkidle", timeout=30000)
                html = page.content()
                browser.close()
            self._save_raw(url, html)
            self.render_method = "playwright"
            return html
        except Exception as e:
            self.log.error(f"Playwright error for {url}: {e}")
            return None

    def needs_playwright(self, url: str) -> bool:
        """
        Heuristic: fetch with requests, check if meaningful Thai content appears.
        Returns True if the page appears JS-rendered.
        """
        resp = self.fetch(url)
        if resp is None:
            return False
        soup = BeautifulSoup(resp.text, "lxml")
        # Check for substantive body text
        text = soup.get_text(" ", strip=True)
        has_thai = bool(re.search(r"[฀-๿]{5,}", text))
        has_table = bool(soup.find("table"))
        if not (has_thai or has_table):
            self.log.info(f"No Thai text/tables found with requests — will try Playwright for {url}")
            return True
        self.log.info(f"Static HTML sufficient for {url}")
        return False

    # ── PDF text extraction ───────────────────────────────────────────────────
    def extract_pdf_text(self, pdf_url: str) -> Optional[str]:
        if not self.is_allowed(pdf_url):
            return None
        try:
            import io
            import pdfplumber
            resp = self.fetch(pdf_url)
            if resp is None:
                return None
            with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
                return "\n".join(p.extract_text() or "" for p in pdf.pages)
        except Exception as e:
            self.log.warning(f"PDF extraction failed ({pdf_url}): {e}")
            return None

    # ── To be implemented by subclasses ──────────────────────────────────────
    def scrape(self) -> list[TenderRecord]:
        raise NotImplementedError

    def run(self) -> list[TenderRecord]:
        self.log.info(f"=== Starting scrape: {self.source_name} ({self.base_url}) ===")
        records = self.scrape()
        self.log.info(f"=== Done: {self.source_name} — {len(records)} records ===")
        return records
