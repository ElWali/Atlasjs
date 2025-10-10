from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:8000/Atlasonajs.html")

        # Wait for at least one map tile to be loaded
        expect(page.locator(".atlas-tile-loaded").first).to_be_visible(timeout=10000)

        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)