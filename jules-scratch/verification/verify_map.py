from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Listen for console events and print them
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    # Listen for page errors and print them
    page.on("pageerror", lambda exc: print(f"Page error: {exc}"))

    page.goto("http://localhost:8000/Atlasonajs.html")

    try:
        # Wait for the map to be loaded by checking for a loaded tile
        page.wait_for_selector(".atlas-tile-loaded", timeout=15000)
        page.screenshot(path="jules-scratch/verification/verification.png")
    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)