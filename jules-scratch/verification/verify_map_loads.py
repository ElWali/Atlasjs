from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    try:
        page.goto("http://localhost:8000/Atlasonajs.html", wait_until="domcontentloaded")

        # Wait for at least one map tile to be loaded and visible
        page.wait_for_selector(".atlas-tile-loaded", timeout=10000)

        print("Map tile loaded successfully.")

        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)