from .core import crawl, map_site, scrape
from .search import SearchError
from .search import search as search_web


def extract_data(*args, **kwargs):
    """Markdown → Claude ile yapılandırılmış veri; ayrıntı için kazi.extract.extract (kazi[extract] gerekir)."""
    try:
        from .extract import extract
    except ModuleNotFoundError as e:
        if e.name != "anthropic":
            raise
        raise RuntimeError("extract için: pip install 'kazi[extract]'") from e
    return extract(*args, **kwargs)


__all__ = ["scrape", "crawl", "map_site", "extract_data", "search_web", "SearchError"]
