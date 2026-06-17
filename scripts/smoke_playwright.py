from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect


BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:3000")
OUT_DIR = Path("test-results")


def main():
    OUT_DIR.mkdir(exist_ok=True)
    console_errors = []
    failed_responses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(60_000)
        page.set_default_navigation_timeout(60_000)
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda response: failed_responses.append(f"{response.status} {response.url}") if response.status >= 500 else None)

        for path, heading, screenshot in [
            ("/login", "Entrar para continuar", "login.png"),
            ("/dashboard", "Dashboard", "dashboard.png"),
            ("/orders", "Pedidos", "orders.png"),
            ("/post-sales", "Pós-venda", "post-sales.png"),
        ]:
            page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            expect(page.get_by_text(heading).first).to_be_visible()
            content = page.content()
            assert "Campanhas" not in content
            assert "Estoque" not in content
            page.screenshot(path=str(OUT_DIR / screenshot), full_page=True)

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.set_default_timeout(60_000)
        mobile.set_default_navigation_timeout(60_000)
        mobile.on("response", lambda response: failed_responses.append(f"{response.status} {response.url}") if response.status >= 500 else None)
        mobile.goto(f"{BASE_URL}/post-sales", wait_until="domcontentloaded")
        mobile.wait_for_load_state("networkidle")
        expect(mobile.get_by_text("Pós-venda").first).to_be_visible()
        mobile.screenshot(path=str(OUT_DIR / "post-sales-mobile.png"), full_page=True)

        browser.close()

    if failed_responses or console_errors:
        raise AssertionError("\n".join([*failed_responses, *console_errors]))


if __name__ == "__main__":
    main()
